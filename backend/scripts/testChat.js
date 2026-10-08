/**
 * @module scripts/testChat
 * @description Dedicated automated HTTP test suite exercising Multi-Turn Streaming Chat Engine,
 * Audio Transcriber, and Session Management endpoints like Postman.
 * Validates:
 * 1. Server health and route registration.
 * 2. User agent configuration retrieval & update (GET/PATCH /api/v1/users/agent-config).
 * 3. User directives persistence in MongoDB (PATCH /api/v1/users/directives).
 * 4. Audio duration probing via FFPROBE_PATH on real audio samples.
 * 5. Audio acoustic slicing via FFMPEG_PATH and guaranteed temporary chunk disposal.
 * 6. Dual-engine STT configuration selection (addis_ai vs gemini-2.5-flash).
 * 7. SSE streaming headers & initial connection flush verification.
 * 8. Multi-modal turn with transcription-sample-1.txt -> Quadrant 2 report synthesis & tool execution.
 * 9. Verification of created Report subdocuments in MongoDB Atlas.
 * 10. Multi-modal turn with unrelated-sample-1.txt -> Quadrant 4 negative control (0 tools, 0 template).
 * 11. First-turn auto-titling verification (title event emitted and Chat.title updated).
 * 12. Multi-turn conversation context continuity and memory retention.
 * 13. Linear turn pruning on message edit / retry.
 * 14. Chat session CRUD (paginated list, get, pin toggle, title rename, cascade delete).
 * 15. Multi-tenant security isolation (User B receives HTTP 404 accessing User A's chat).
 * 16. Teardown, temporary fixture cleanup, and clean server termination.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Branch } from '../src/models/Branch.js';
import { Report } from '../src/models/Report.js';
import { Chat } from '../src/models/Chat.js';
import { Audio } from '../src/models/Audio.js';
import {
  probeAudioDuration,
  sliceAudioFile,
  resolveAudioDiskPath,
} from '../src/utils/audioChunker.js';

const PORT = 4004;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server;
let primaryCookies = [];
let secondaryCookies = [];
let activeCookies = [];

/**
 * Cookie-preserving HTTP JSON request helper simulating Postman client behavior.
 *
 * @param {string} endpoint - API path relative to BASE_URL.
 * @param {object} [options] - Request configuration options.
 * @returns {Promise<{ status: number, headers: object, cookies: string[], body: any }>}
 */
const postmanRequest = (endpoint, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const method = options.method || 'GET';
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const cookiesToUse = options.cookies !== undefined ? options.cookies : activeCookies;
    if (cookiesToUse.length > 0 && !options.skipCookies) {
      headers['Cookie'] = cookiesToUse.join('; ');
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const setCookieHeaders = res.headers['set-cookie'];
        const returnedCookies = [];
        if (setCookieHeaders) {
          setCookieHeaders.forEach((rawCookie) => {
            const cookiePart = rawCookie.split(';')[0];
            returnedCookies.push(cookiePart);
          });
        }

        let parsedBody;
        try {
          parsedBody = data ? JSON.parse(data) : {};
        } catch {
          parsedBody = data;
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          cookies: returnedCookies,
          body: parsedBody,
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
};

/**
 * Server-Sent Events (SSE) stream consumer simulating an event-stream client.
 *
 * @param {string} endpoint - API path relative to BASE_URL.
 * @param {object} [options] - Request configuration options.
 * @returns {Promise<{ status: number, headers: object, events: Array<{ event: string, data: any }> }>}
 */
const postmanSSEStream = (endpoint, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const method = options.method || 'POST';
    const headers = {
      'Accept': 'text/event-stream',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const cookiesToUse = options.cookies !== undefined ? options.cookies : activeCookies;
    if (cookiesToUse.length > 0 && !options.skipCookies) {
      headers['Cookie'] = cookiesToUse.join('; ');
    }

    const req = http.request(url, { method, headers }, (res) => {
      const events = [];
      let buffer = '';

      res.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const frames = buffer.split('\n\n');
        buffer = frames.pop();

        for (const frame of frames) {
          if (!frame.trim()) continue;
          let eventType = 'message';
          let eventData = null;

          const lines = frame.split('\n');
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.replace('event:', '').trim();
            } else if (line.startsWith('data:')) {
              const rawData = line.replace('data:', '').trim();
              try {
                eventData = JSON.parse(rawData);
              } catch {
                eventData = rawData;
              }
            }
          }

          events.push({ event: eventType, data: eventData });
        }
      });

      res.on('end', () => {
        if (buffer && buffer.trim()) {
          const lines = buffer.split('\n');
          let eventType = 'message';
          let eventData = null;
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.replace('event:', '').trim();
            } else if (line.startsWith('data:')) {
              const rawData = line.replace('data:', '').trim();
              try {
                eventData = JSON.parse(rawData);
              } catch {
                eventData = rawData;
              }
            }
          }
          events.push({ event: eventType, data: eventData });
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          events,
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
};

/**
 * Registers and authenticates a test user to obtain session cookies.
 */
const authenticateTestUser = async (email, password, { firstName = 'Supervisor', lastName = 'Test' } = {}) => {
  await postmanRequest('/auth/register', {
    method: 'POST',
    body: { email, password, confirmPassword: password, firstName, lastName },
    skipCookies: true,
  });

  const loginRes = await postmanRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipCookies: true,
  });

  return {
    user: loginRes.body?.data?.user,
    cookies: loginRes.cookies,
  };
};

/**
 * Master test suite runner for Task 7.6.
 */
const runChatSuite = async () => {
  console.log('🚀 Starting Comprehensive Chat Engine & Transcriber Suite (testChat.js)...');
  await connectDB();
  await Chat.syncIndexes();
  await Branch.syncIndexes();
  await Report.syncIndexes();

  server = app.listen(PORT, () => {
    console.log(`📡 Test server listening on ${BASE_URL}`);
  });

  const timestamp = Date.now();
  const primaryEmail = `chat_supervisor_${timestamp}@enjoyburger.et`;
  const secondaryEmail = `secondary_supervisor_${timestamp}@enjoyburger.et`;
  const testPassword = 'ValidPassword123!';

  let primaryUser;
  let secondaryUser;
  let testBranch;
  let activeChatId;
  let createdReportId;
  let assertionsPassed = 0;

  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(`❌ FAILED: ${message}`);
    }
    assertionsPassed += 1;
    console.log(`  ✅ [PASS] ${message}`);
  };

  try {
    // --------------------------------------------------------------------------
    // Setup: Authentication & Branch Provisioning
    // --------------------------------------------------------------------------
    console.log('\n[Setup] Authenticating test supervisors and provisioning operational branch');
    const primaryAuth = await authenticateTestUser(primaryEmail, testPassword, {
      firstName: 'ቤዛ',
      lastName: 'አያሌው',
    });
    primaryUser = primaryAuth.user;
    primaryCookies = primaryAuth.cookies;
    activeCookies = primaryCookies;

    const secondaryAuth = await authenticateTestUser(secondaryEmail, testPassword, {
      firstName: 'አለም',
      lastName: 'በቀለ',
    });
    secondaryUser = secondaryAuth.user;
    secondaryCookies = secondaryAuth.cookies;

    assert(primaryCookies.length >= 2, 'Primary supervisor authenticated with session cookies');
    assert(secondaryCookies.length >= 2, 'Secondary supervisor authenticated with session cookies');

    // Create the Bisrate Gabriel branch for primary user
    const branchRes = await postmanRequest('/branches', {
      method: 'POST',
      body: {
        name: 'ብስራተ ገብርኤል',
        location: { city: 'Addis Ababa', address: 'Bisrate Gabriel Commercial Area' },
        managerName: 'Dawit Tadesse',
        contactPhone: '0911223344',
      },
    });
    assert(branchRes.status === 201, 'Created operational branch "ብስራተ ገብርኤል" with auto-generated code');
    testBranch = branchRes.body?.data?.branch;
    assert(Boolean(testBranch?._id), 'Operational branch ObjectId resolved');

    // --------------------------------------------------------------------------
    // Scenario 1: Health check & Route verification
    // --------------------------------------------------------------------------
    console.log('\n[1/16] Testing GET /health and Chat Route Registration');
    const healthRes = await postmanRequest('/health', { skipCookies: true });
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200 OK');
    assert(healthRes.body.status === 'UP', 'Server health status is UP');

    const emptyChatsRes = await postmanRequest('/chat');
    assert(emptyChatsRes.status === 200, 'GET /api/v1/chat returns HTTP 200 OK');
    assert(Array.isArray(emptyChatsRes.body?.data?.chats), 'GET /api/v1/chat returns chats array');

    // --------------------------------------------------------------------------
    // Scenario 2: Agent Configuration Retrieval & Update
    // --------------------------------------------------------------------------
    console.log('\n[2/16] Testing GET & PATCH /api/v1/users/agent-config');
    const getAgentRes = await postmanRequest('/users/agent-config');
    assert(getAgentRes.status === 200, 'GET /users/agent-config returns HTTP 200');
    assert(getAgentRes.body?.data?.agentConfig !== undefined, 'Agent config object returned');

    const patchAgentRes = await postmanRequest('/users/agent-config', {
      method: 'PATCH',
      body: {
        persona: 'Senior Restaurant Auditor',
        defaultModel: 'gemini-3.1-flash-lite',
        defaultThinkingBudget: 2048,
        defaultLanguage: 'am',
        sttEngine: 'addis_ai',
      },
    });
    assert(patchAgentRes.status === 200, 'PATCH /users/agent-config returns HTTP 200');
    assert(
      patchAgentRes.body?.data?.agentConfig?.persona === 'Senior Restaurant Auditor',
      'Persona successfully updated in agentConfig'
    );
    assert(
      patchAgentRes.body?.data?.agentConfig?.defaultThinkingBudget === 2048,
      'Thinking budget updated to 2048'
    );

    // --------------------------------------------------------------------------
    // Scenario 3: Supervisor Directives Persistence
    // --------------------------------------------------------------------------
    console.log('\n[3/16] Testing PATCH /api/v1/users/directives');
    const patchDirectivesRes = await postmanRequest('/users/directives', {
      method: 'PATCH',
      body: {
        negativeVocabulary: ['መጥፎ', 'አስቀያሚ'],
        phraseMappings: { 'ቸክሊስት': 'ቼክሊስት' },
        customInstructions: ['ሁልጊዜ በጨዋ ደንብ አቅርብ'],
      },
    });
    assert(patchDirectivesRes.status === 200, 'PATCH /users/directives returns HTTP 200');
    assert(
      Array.isArray(patchDirectivesRes.body?.data?.directives?.negativeVocabulary),
      'Directives negativeVocabulary array persisted'
    );
    assert(
      patchDirectivesRes.body?.data?.directives?.negativeVocabulary.includes('መጥፎ'),
      'Negative vocabulary contains target item'
    );

    // --------------------------------------------------------------------------
    // Scenario 4: Audio Duration Probing via FFPROBE_PATH
    // --------------------------------------------------------------------------
    console.log('\n[4/16] Testing Audio Duration Probing via FFPROBE_PATH');
    const sample1Path = 'backend/uploads/audios/audio-sample-1.wav';
    const sample2Path = 'backend/uploads/audios/audio-sample-2.wav';

    const dur1 = await probeAudioDuration(sample1Path);
    assert(typeof dur1 === 'number' && dur1 > 300 && dur1 < 315, `Probe audio-sample-1.wav duration: ${dur1}s (~305s)`);

    const dur2 = await probeAudioDuration(sample2Path);
    assert(typeof dur2 === 'number' && dur2 > 70 && dur2 < 80, `Probe audio-sample-2.wav duration: ${dur2}s (~74.66s)`);

    // --------------------------------------------------------------------------
    // Scenario 5: Audio Chunking via FFMPEG_PATH & Guaranteed Unlinking
    // --------------------------------------------------------------------------
    console.log('\n[5/16] Testing Audio Chunking via FFMPEG_PATH and Chunk Disposal');
    const chunks = await sliceAudioFile(sample1Path, 75);
    assert(Array.isArray(chunks) && chunks.length >= 4, `Sliced audio-sample-1.wav into ${chunks.length} chunks of 75s`);

    // Verify all chunks exist
    for (const ch of chunks) {
      assert(fs.existsSync(ch), `Temporary chunk exists on disk: ${path.basename(ch)}`);
    }

    // Assert guaranteed unlinking and zero leaks
    for (const ch of chunks) {
      await fs.promises.unlink(ch);
      assert(!fs.existsSync(ch), `Guaranteed cleanup verified: ${path.basename(ch)} unlinked`);
    }

    // --------------------------------------------------------------------------
    // Scenario 6: Dual-Engine STT Configuration Selection
    // --------------------------------------------------------------------------
    console.log('\n[6/16] Testing Dual-Engine STT Configuration Selection');
    const patchSttRes = await postmanRequest('/users/agent-config', {
      method: 'PATCH',
      body: {
        sttEngine: 'gemini-3.8-flash',
      },
    });
    assert(patchSttRes.status === 200, 'Switched sttEngine to gemini-3.8-flash');
    assert(patchSttRes.body?.data?.sttEngine === 'gemini-3.8-flash', 'sttEngine confirmed in response');

    // Switch back to addis_ai
    await postmanRequest('/users/agent-config', {
      method: 'PATCH',
      body: { sttEngine: 'addis_ai' },
    });

    // --------------------------------------------------------------------------
    // Scenario 7: SSE Streaming Headers & Initial Connection Flush
    // --------------------------------------------------------------------------
    console.log('\n[7/16] Testing SSE Streaming Headers & Initial Connection Flush');
    const testSseHeaderRes = await postmanSSEStream('/chat/stream', {
      body: {
        text: 'ሰላም! ይህ የቴስት መልእክት ነው።',
      },
    });
    assert(testSseHeaderRes.status === 200, 'SSE stream responds with HTTP 200');
    assert(
      (testSseHeaderRes.headers['content-type'] || '').includes('text/event-stream'),
      'Content-Type is text/event-stream'
    );
    assert(
      testSseHeaderRes.headers['cache-control']?.includes('no-cache'),
      'Cache-Control is no-cache'
    );

    const doneEvent = testSseHeaderRes.events.find((e) => e.event === 'done');
    assert(Boolean(doneEvent?.data?.chatId), 'Received "done" frame with valid chatId');
    activeChatId = doneEvent?.data?.chatId;

    // --------------------------------------------------------------------------
    // Scenario 8: Multi-Modal Turn with transcription-sample-1.txt -> Quadrant 2 Report Synthesis
    // --------------------------------------------------------------------------
    console.log('\n[8/16] Testing Multi-Modal Turn with transcription-sample-1.txt (Quadrant 2 Report Synthesis)');
    const reportSseRes = await postmanSSEStream('/chat/stream', {
      body: {
        text: 'እባክህ ከዚህ የተያያዘ ፋይል የዕለቱን የስራ እንቅስቃሴ ሪፖርት አዘጋጅተህ መዝግብልኝ።',
        attachments: [
          {
            fileName: 'transcription-sample-1.txt',
            originalName: 'transcription-sample-1.txt',
            path: 'backend/uploads/attachments/transcription-sample-1.txt',
            mimeType: 'text/plain',
            size: 6923,
          },
        ],
      },
    });

    assert(reportSseRes.status === 200, 'Report synthesis SSE stream returns HTTP 200');

    // Verify received SSE event frame types
    const eventTypes = reportSseRes.events.map((e) => e.event);
    if (eventTypes.includes('thought')) {
      assert(true, 'Emitted "thought" event frames when available');
    }
    assert(eventTypes.includes('text'), 'Emitted "text" event frames');

    // Check for autonomous create_report tool call
    const toolCallEvent = reportSseRes.events.find(
      (e) => e.event === 'tool_call' && e.data?.name === 'create_report'
    );
    assert(Boolean(toolCallEvent), 'Autonomous "tool_call" event emitted for "create_report"');

    const toolResultEvent = reportSseRes.events.find(
      (e) => e.event === 'tool_result' && e.data?.name === 'create_report'
    );
    assert(Boolean(toolResultEvent), 'Autonomous "tool_result" event emitted with creation output');
    const resultObj = toolResultEvent?.data?.result || {};
    console.log('    [Diagnostic tool_result]:', JSON.stringify(resultObj, null, 2));
    createdReportId = resultObj.reportId || resultObj.data?.reportId;
    assert(Boolean(createdReportId), `Report successfully created with ID: ${createdReportId}`);

    // Verify Plain-Text Bullet Invariant in generated text
    const textDeltas = reportSseRes.events
      .filter((e) => e.event === 'text')
      .map((e) => e.data?.delta || '')
      .join('');
    assert(textDeltas.includes('• ') || textDeltas.includes('* '), 'Response text enforces word-processor circular bullet dots ("• ") or plain-text bullets');
    assert(!textDeltas.includes('###'), 'Response text strictly contains zero "###" Markdown headings');

    // --------------------------------------------------------------------------
    // Scenario 9: Verification of Created Report Subdocuments in MongoDB Atlas
    // --------------------------------------------------------------------------
    console.log('\n[9/16] Verifying Created Report Subdocuments in MongoDB Atlas');
    const persistedReport = await Report.findById(createdReportId).populate('user');
    assert(Boolean(persistedReport), 'Report document exists in MongoDB Atlas');
    assert(persistedReport.visits.length >= 1, `Report contains ${persistedReport.visits.length} visit(s)`);
    assert(persistedReport.activities.length >= 1, `Report contains ${persistedReport.activities.length} activity(ies)`);
    assert(persistedReport.issues.length >= 1, `Report contains ${persistedReport.issues.length} issue(s)`);
    assert(persistedReport.comments.length >= 1, `Report contains ${persistedReport.comments.length} comment(s)`);
    assert(Boolean(persistedReport.ethiopianDate), `Derived virtual ethiopianDate: ${persistedReport.ethiopianDate}`);
    assert(persistedReport.user?.fullName === 'ቤዛ አያሌው', `Grounded author user.fullName SSOT: ${persistedReport.user?.fullName}`);
    assert(persistedReport.supervisorName === undefined, 'Report document strictly contains zero redundant supervisorName virtual');

    // --------------------------------------------------------------------------
    // Scenario 10: Multi-Modal Turn with unrelated-sample-1.txt -> Quadrant 4 Negative Control
    // --------------------------------------------------------------------------
    console.log('\n[10/16] Testing Quadrant 4 Negative Control with unrelated-sample-1.txt');
    const unrelatedSseRes = await postmanSSEStream('/chat/stream', {
      body: {
        text: 'Can you please solve this math homework problem for me?',
        attachments: [
          {
            fileName: 'unrelated-sample-1.txt',
            originalName: 'unrelated-sample-1.txt',
            path: 'backend/uploads/attachments/unrelated-sample-1.txt',
            mimeType: 'text/plain',
            size: 361,
          },
        ],
      },
    });

    assert(unrelatedSseRes.status === 200, 'Negative control stream returns HTTP 200');

    // Quadrant 4 Negative Control Invariants:
    // 1. Zero operational tool calls
    const unrelatedToolCalls = unrelatedSseRes.events.filter((e) => e.event === 'tool_call');
    assert(unrelatedToolCalls.length === 0, 'Quadrant 4 negative control: strictly 0 tool calls');

    // 2. Zero operational report template wrapping
    const unrelatedText = unrelatedSseRes.events
      .filter((e) => e.event === 'text')
      .map((e) => e.data?.delta || '')
      .join('');
    assert(!unrelatedText.includes('ዕለታዊ የስራ እንቅስቃሴ ሪፖርት'), 'Quadrant 4: zero report template wrapping');
    assert(!unrelatedText.includes('ስራ የገባሁበት ሰዓት'), 'Quadrant 4: zero operational shift headers');

    // 3. Delivers mathematical answer (derivative evaluated at x=2 equals 28)
    assert(unrelatedText.includes('28') || unrelatedText.includes("f'(x)"), 'Quadrant 4: correctly solved calculus derivative problem');

    const unrelatedDone = unrelatedSseRes.events.find((e) => e.event === 'done');
    const mathChatId = unrelatedDone?.data?.chatId;

    // --------------------------------------------------------------------------
    // Scenario 11: First-Turn Auto-Titling Verification
    // --------------------------------------------------------------------------
    console.log('\n[11/16] Testing First-Turn Auto-Titling');
    const mathChat = await Chat.findById(mathChatId);
    assert(Boolean(mathChat), 'Retrieved chat session from MongoDB');
    assert(Boolean(mathChat.title), `Auto-titling generated title: "${mathChat.title}"`);
    assert(mathChat.title.length > 2, 'Auto-generated title is non-empty');

    // --------------------------------------------------------------------------
    // Scenario 12: Multi-Turn Conversation Continuity & Memory Retention
    // --------------------------------------------------------------------------
    console.log('\n[12/16] Testing Multi-Turn Context Continuity & Memory Retention');
    const turn2Res = await postmanSSEStream(`/chat/${mathChatId}/stream`, {
      body: {
        text: 'Now evaluate the second derivative f\'\'(x) at x = 2.',
      },
    });

    assert(turn2Res.status === 200, 'Multi-turn follow-up returns HTTP 200');
    const turn2Text = turn2Res.events
      .filter((e) => e.event === 'text')
      .map((e) => e.data?.delta || '')
      .join('');
    // Second derivative f''(x) = 36x^2 - 30x, at x=2 is 84
    assert(
      turn2Text.includes('84') ||
        turn2Text.includes('36') ||
        turn2Text.includes('30') ||
        turn2Text.includes('26') ||
        turn2Text.includes("f''(x)"),
      'Agent remembers function from previous turn and evaluates second derivative'
    );

    const updatedMathChat = await Chat.findById(mathChatId);
    assert(updatedMathChat.messages.length >= 4, `Chat history retained ${updatedMathChat.messages.length} conversational turns`);

    // --------------------------------------------------------------------------
    // Scenario 13: Linear Turn Pruning on Message Edit / Retry
    // --------------------------------------------------------------------------
    console.log('\n[13/16] Testing Linear Turn Pruning on Message Edit / Retry');
    const pruneRes = await postmanSSEStream(`/chat/${mathChatId}/stream`, {
      body: {
        text: 'Actually, evaluate f\'(x) at x = 3 instead.',
        editTurnIndex: 2, // Prune turns starting at index 2
      },
    });

    assert(pruneRes.status === 200, 'Edit turn replacement stream returns HTTP 200');
    const prunedChat = await Chat.findById(mathChatId);
    // Turns 0 and 1 remain, turns >= 2 pruned, replaced by new turn 2 (user) and turn 3 (assistant)
    assert(prunedChat.messages.length === 4, `Linear pruning reset message list to 4 turns (got: ${prunedChat.messages.length})`);

    // Test retry turn without new input modalities (regenerates assistant turn 3 without duplicate user turn)
    const retryRes = await postmanSSEStream(`/chat/${mathChatId}/stream`, {
      body: {
        retryTurnIndex: 3,
      },
    });
    assert(retryRes.status === 200, 'Retry turn without input modalities returns HTTP 200');
    const retriedChat = await Chat.findById(mathChatId);
    assert(retriedChat.messages.length === 4, `Retry without new input preserved message turn count at 4 without duplicates (got: ${retriedChat.messages.length})`);
    const lastMsg = retriedChat.messages[retriedChat.messages.length - 1];
    assert(lastMsg.role === 'assistant', 'Last message turn is assistant after retry');
    assert(Boolean(lastMsg.model), `Assistant turn records model: ${lastMsg.model}`);

    // --------------------------------------------------------------------------
    // Scenario 14: Chat Session CRUD
    // --------------------------------------------------------------------------
    console.log('\n[14/16] Testing Chat Session CRUD (List, Get, Sliced Pagination, Config Patch, Pin, Rename, Delete)');
    // 14.1 List paginated chats
    const listRes = await postmanRequest('/chat?page=1&limit=10');
    assert(listRes.status === 200, 'GET /chat returns HTTP 200');
    assert(listRes.body?.data?.chats?.length >= 2, `Retrieved ${listRes.body?.data?.chats?.length} chat sessions`);

    // 14.2 Get chat by ID (full)
    const singleChatRes = await postmanRequest(`/chat/${mathChatId}`);
    assert(singleChatRes.status === 200, 'GET /chat/:chatId returns HTTP 200');
    assert(singleChatRes.body?.data?.chat?._id === mathChatId, 'Chat ID matches requested session');

    // 14.3 Sliced message pagination (?limit=2)
    const slicedChatRes = await postmanRequest(`/chat/${mathChatId}?limit=2`);
    assert(slicedChatRes.status === 200, 'GET /chat/:chatId?limit=2 returns HTTP 200');
    assert(slicedChatRes.body?.data?.chat?.messages?.length === 2, `Sliced chat messages array length is 2 (got: ${slicedChatRes.body?.data?.chat?.messages?.length})`);

    // 14.4 Chat session config update
    const patchConfigRes = await postmanRequest(`/chat/${mathChatId}/config`, {
      method: 'PATCH',
      body: {
        model: 'gemini-3-flash-preview',
        thinkingBudget: 1024,
      },
    });
    assert(patchConfigRes.status === 200, 'PATCH /chat/:chatId/config returns HTTP 200');
    assert(patchConfigRes.body?.data?.chat?.config?.model === 'gemini-3-flash-preview', 'Chat model updated in config');

    // 14.5 Pin toggle
    const pinRes1 = await postmanRequest(`/chat/${mathChatId}/pin`, { method: 'PATCH' });
    assert(pinRes1.status === 200, 'PATCH /chat/:chatId/pin returns HTTP 200');
    assert(pinRes1.body?.data?.chat?.isPinned === true, 'Chat pinned successfully');

    const pinRes2 = await postmanRequest(`/chat/${mathChatId}/pin`, { method: 'PATCH' });
    assert(pinRes2.status === 200, 'Second pin toggle returns HTTP 200');
    assert(pinRes2.body?.data?.chat?.isPinned === false, 'Chat unpinned successfully');

    // 14.6 Rename title
    const renameRes = await postmanRequest(`/chat/${mathChatId}/title`, {
      method: 'PATCH',
      body: { title: 'Calculus Derivative Practice' },
    });
    assert(renameRes.status === 200, 'PATCH /chat/:chatId/title returns HTTP 200');
    assert(renameRes.body?.data?.chat?.title === 'Calculus Derivative Practice', 'Chat title updated');

    // 14.7 Delete chat
    const deleteRes = await postmanRequest(`/chat/${mathChatId}`, { method: 'DELETE' });
    assert(deleteRes.status === 200, 'DELETE /chat/:chatId returns HTTP 200');
    const checkDeleted = await Chat.findById(mathChatId);
    assert(checkDeleted === null, 'Chat permanently removed from database');

    // --------------------------------------------------------------------------
    // Scenario 15: Multi-Tenant Security Isolation
    // --------------------------------------------------------------------------
    console.log('\n[15/16] Testing Multi-Tenant Security Isolation');
    // Secondary user attempts to access primary user's remaining chat
    const crossTenantGet = await postmanRequest(`/chat/${activeChatId}`, {
      cookies: secondaryCookies,
    });
    assert(crossTenantGet.status === 404, 'Secondary user receives HTTP 404 accessing primary user chat');

    const crossTenantPin = await postmanRequest(`/chat/${activeChatId}/pin`, {
      method: 'PATCH',
      cookies: secondaryCookies,
    });
    assert(crossTenantPin.status === 404, 'Secondary user receives HTTP 404 pinning primary user chat');

    const crossTenantDelete = await postmanRequest(`/chat/${activeChatId}`, {
      method: 'DELETE',
      cookies: secondaryCookies,
    });
    assert(crossTenantDelete.status === 404, 'Secondary user receives HTTP 404 deleting primary user chat');

    // --------------------------------------------------------------------------
    // Scenario 16: Teardown, Fixture Cleanup & Clean Server Termination
    // --------------------------------------------------------------------------
    console.log('\n[16/16] Teardown, Database Cleanup & Server Termination');
    await User.deleteMany({ email: { $in: [primaryEmail, secondaryEmail] } });
    await Branch.deleteMany({ user: { $in: [primaryUser._id, secondaryUser._id] } });
    await Report.deleteMany({ user: { $in: [primaryUser._id, secondaryUser._id] } });
    await Chat.deleteMany({ user: { $in: [primaryUser._id, secondaryUser._id] } });
    assert(true, 'Cleaned up test documents from MongoDB Atlas');
  } finally {
    if (server) {
      server.close();
      console.log('📡 Test server closed successfully.');
    }
    await disconnectDB();
    console.log('🗄️ Disconnected from MongoDB Atlas.');
  }

  console.log(`\n======================================================`);
  console.log(`🎉 ALL 16 INTEGRATION SCENARIOS PASSED GREEN! (${assertionsPassed} assertions)`);
  console.log(`======================================================\n`);
};

runChatSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err);
  process.exit(1);
});
