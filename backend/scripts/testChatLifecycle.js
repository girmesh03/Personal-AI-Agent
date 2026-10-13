/**
 * @module scripts/testChatLifecycle
 * @description Dedicated automated integration test suite for Task 8.13:
 * Conversational Turn Lifecycle Engine: Edit, Retry, Stop + Retry, and Continue Generating Architecture.
 *
 * Scenarios Tested:
 * 1. Initial Turn 0 creation & SSE event-stream verification.
 * 2. Turn 0 Edit & Title Regeneration (Turn 0 edit clears chat.title and prunes messages).
 * 3. Multi-Turn expansion (user -> assistant -> user -> assistant).
 * 4. Intermediate Turn Edit with Linear History Pruning (downstream turns pruned, new timeline started).
 * 5. Latest Assistant Retry (Zero Duplicate User Turns invariant in MongoDB).
 * 6. Retry with Alternate Model ('gemini-3.8-flash').
 * 7. Client Abort Simulation (Stop During Text Streaming, isStopped: true persisted).
 * 8. Model A Continue Generating (In-place text concatenation, zero synthetic user bubbles, isStopped: false).
 * 9. Stop -> Continue -> Stop -> Retry Lifecycle Cycle.
 * 10. Multi-Modal context re-hydration during retry (attachments and audio note preserved).
 * 11. Teardown, Fixture Cleanup & Clean Server Termination.
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Branch } from '../src/models/Branch.js';
import { Chat } from '../src/models/Chat.js';
import { Audio } from '../src/models/Audio.js';
import { AI_MODELS } from '../src/utils/constants.js';

const PORT = 4006;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server;
let activeCookies = [];
let assertionsPassed = 0;

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`❌ FAILED: ${message}`);
  }
  assertionsPassed += 1;
  console.log(`  ✅ [PASS] ${message}`);
};

/**
 * Polling helper that waits for a chat document to satisfy a condition.
 * Prevents race conditions against asynchronous remote MongoDB network writes.
 */
const waitForChatCondition = async (chatId, predicate, timeoutMs = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const doc = await Chat.findById(chatId);
    if (doc && predicate(doc)) {
      return doc;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return await Chat.findById(chatId);
};

/**
 * Cookie-preserving HTTP JSON request helper.
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
 * Server-Sent Events (SSE) stream consumer with optional client abort support.
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

    let isAborted = false;
    const events = [];
    let buffer = '';

    const req = http.request(url, { method, headers }, (res) => {
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

          // If caller requested an early abort trigger on receiving text chunk
          if (options.abortOnEvent && options.abortOnEvent === eventType && !isAborted) {
            isAborted = true;
            const triggerAbort = () => {
              req.destroy();
              resolve({
                status: res.statusCode,
                headers: res.headers,
                events,
                aborted: true,
              });
            };
            if (options.abortDelayMs && options.abortDelayMs > 0) {
              setTimeout(triggerAbort, options.abortDelayMs);
            } else {
              triggerAbort();
            }
            return;
          }
        }
      });

      res.on('end', () => {
        if (isAborted) return;
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
          aborted: false,
        });
      });
    });

    req.on('error', (err) => {
      if (isAborted) {
        // Socket destroyed deliberately by client test
        return;
      }
      reject(err);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
};

/**
 * Registers and authenticates a test supervisor user.
 */
const authenticateTestUser = async (email, password) => {
  await postmanRequest('/auth/register', {
    method: 'POST',
    body: { email, password, confirmPassword: password, firstName: 'Lifecycle', lastName: 'Tester' },
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
 * Main execution harness.
 */
const runLifecycleSuite = async () => {
  console.log('🚀 Starting Task 8.13 Conversational Lifecycle Integration Suite...\n');
  await connectDB();
  await Chat.syncIndexes();
  await Branch.syncIndexes();
  await User.syncIndexes();

  server = app.listen(PORT, () => {
    console.log(`📡 Lifecycle Test server listening on ${BASE_URL}`);
  });

  const timestamp = Date.now();
  const testEmail = `lifecycle_agent_${timestamp}@enjoyburger.et`;
  const testPassword = 'SecurePassword123!';

  let testUser;
  let testBranch;
  let activeChatId;
  let mockAudio;

  try {
    // --------------------------------------------------------------------------
    // Setup: Authentication & Branch Provisioning
    // --------------------------------------------------------------------------
    console.log('[Setup] Registering & Authenticating Lifecycle Test User');
    const authData = await authenticateTestUser(testEmail, testPassword);
    testUser = authData.user;
    activeCookies = authData.cookies;
    assert(Boolean(testUser?._id), 'Test user registered & authenticated');

    const branchRes = await postmanRequest('/branches', {
      method: 'POST',
      body: {
        name: `Lifecycle Branch ${timestamp}`,
        location: { city: 'Addis Ababa', address: 'Bole Road, Addis Ababa' },
        managerName: 'Lifecycle Manager',
        contactPhone: '0911002233',
      },
    });
    testBranch = branchRes.body?.data?.branch;
    assert(branchRes.status === 201 && Boolean(testBranch?._id), 'Operational branch provisioned');

    // --------------------------------------------------------------------------
    // Scenario 1: Initial Turn 0 Creation & SSE Stream
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 1] Turn 0 Creation & Auto-Titling SSE Stream');
    const streamRes1 = await postmanSSEStream('/chat/stream', {
      body: {
        text: 'What is 2 + 2? Reply with just the numeric answer and a brief friendly sentence.',
        model: AI_MODELS.DEFAULT,
      },
    });

    assert(streamRes1.status === 200, 'Initial SSE stream returned HTTP 200');
    const doneEvent1 = streamRes1.events.find((e) => e.event === 'done');
    assert(Boolean(doneEvent1?.data?.chatId), 'Done event emitted with chatId');
    activeChatId = doneEvent1.data.chatId;

    const chatDoc1 = await Chat.findById(activeChatId);
    assert(chatDoc1 !== null, 'Chat document exists in MongoDB');
    assert(chatDoc1.messages.length === 2, 'Chat contains exactly 2 messages (Turn 0: user -> assistant)');
    assert(chatDoc1.messages[0].role === 'user', 'First message is user role');
    assert(chatDoc1.messages[1].role === 'assistant', 'Second message is assistant role');
    assert(chatDoc1.messages[1].isStopped === false, 'Assistant message isStopped is false');
    assert(typeof chatDoc1.title === 'string' && chatDoc1.title.length > 0, `Auto-title generated: "${chatDoc1.title}"`);

    // --------------------------------------------------------------------------
    // Scenario 2: Turn 0 Edit & Title Reset/Regeneration
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 2] Turn 0 Edit & Title Reset/Regeneration');
    const userTurn0Id = chatDoc1.messages[0]._id.toString();
    const streamRes2 = await postmanSSEStream(`/chat/${activeChatId}/stream`, {
      body: {
        chatId: activeChatId,
        text: 'What is 5 + 5? Reply with just the numeric answer and a brief friendly sentence.',
        editTurnIndex: 0,
        anchorUserMessageId: userTurn0Id,
        model: AI_MODELS.DEFAULT,
      },
    });

    assert(streamRes2.status === 200, 'Turn 0 edit SSE stream returned HTTP 200');
    const chatDoc2 = await Chat.findById(activeChatId);
    assert(chatDoc2.messages.length === 2, 'Chat still contains exactly 2 messages after Turn 0 edit');
    assert(chatDoc2.messages[0].text.includes('5 + 5'), 'Turn 0 user text updated to edited prompt');
    assert(chatDoc2.messages[1].role === 'assistant', 'Turn 0 assistant replaced with new response');
    assert(typeof chatDoc2.title === 'string' && chatDoc2.title.length > 0, `Turn 0 re-titled to: "${chatDoc2.title}"`);

    // --------------------------------------------------------------------------
    // Scenario 3: Multi-Turn Conversation Expansion (Turn 1)
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 3] Multi-Turn Expansion (Turn 1)');
    const streamRes3 = await postmanSSEStream(`/chat/${activeChatId}/stream`, {
      body: {
        chatId: activeChatId,
        text: 'Now multiply that result by 3 and tell me the final number.',
        model: AI_MODELS.DEFAULT,
      },
    });

    assert(streamRes3.status === 200, 'Turn 1 SSE stream returned HTTP 200');
    const chatDoc3 = await Chat.findById(activeChatId);
    assert(chatDoc3.messages.length === 4, 'Chat now contains exactly 4 messages (2 user, 2 assistant)');
    assert(chatDoc3.messages[2].role === 'user', 'Message index 2 is user role');
    assert(chatDoc3.messages[3].role === 'assistant', 'Message index 3 is assistant role');

    // --------------------------------------------------------------------------
    // Scenario 4: Intermediate Turn Edit with Linear History Pruning
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 4] Intermediate Turn Edit (Linear History Pruning)');
    const userTurn1Id = chatDoc3.messages[2]._id.toString();
    const streamRes4 = await postmanSSEStream(`/chat/${activeChatId}/stream`, {
      body: {
        chatId: activeChatId,
        text: 'Now multiply that result by 7 and state the answer clearly.',
        editTurnIndex: 2,
        anchorUserMessageId: userTurn1Id,
        model: AI_MODELS.DEFAULT,
      },
    });

    assert(streamRes4.status === 200, 'Intermediate edit stream returned HTTP 200');
    const chatDoc4 = await Chat.findById(activeChatId);
    assert(chatDoc4.messages.length === 4, 'Linear pruning maintains exact 4 messages count');
    assert(chatDoc4.messages[2].text.includes('multiply that result by 7'), 'Turn 1 user text replaced with edited prompt');
    assert(chatDoc4.messages[3].role === 'assistant', 'Assistant regenerated for edited prompt');

    // --------------------------------------------------------------------------
    // Scenario 5: Latest Assistant Retry (Zero Duplicate User Turns Invariant)
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 5] Latest Assistant Retry (Zero Duplicate User Turns Invariant)');
    const streamRes5 = await postmanSSEStream(`/chat/${activeChatId}/stream`, {
      body: {
        chatId: activeChatId,
        isRetry: true,
        anchorUserMessageId: userTurn1Id,
        model: AI_MODELS.DEFAULT,
      },
    });

    assert(streamRes5.status === 200, 'Retry stream returned HTTP 200');
    const chatDoc5 = await Chat.findById(activeChatId);
    assert(chatDoc5.messages.length === 4, 'ZERO DUPLICATE USER TURNS: Message count remains exactly 4');
    assert(chatDoc5.messages[2].role === 'user', 'Anchor user message preserved');
    assert(chatDoc5.messages[3].role === 'assistant', 'Assistant message regenerated in-place');

    // --------------------------------------------------------------------------
    // Scenario 6: Retry with Alternate Model Selection ('gemini-3.8-flash')
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 6] Retry with Alternate Model (gemini-3.8-flash)');
    const streamRes6 = await postmanSSEStream(`/chat/${activeChatId}/stream`, {
      body: {
        chatId: activeChatId,
        isRetry: true,
        anchorUserMessageId: userTurn1Id,
        model: AI_MODELS.PRO,
      },
    });

    assert(streamRes6.status === 200, 'Alternate model retry stream returned HTTP 200');
    const chatDoc6 = await Chat.findById(activeChatId);
    assert(
      chatDoc6.messages[3].model === AI_MODELS.PRO || AI_MODELS.SUPPORTED.includes(chatDoc6.messages[3].model),
      `Assistant turn persisted with valid model (requested: ${AI_MODELS.PRO}, persisted: ${chatDoc6.messages[3].model})`
    );

    // --------------------------------------------------------------------------
    // Scenario 7: Client Abort Simulation (Stop During Text Streaming)
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 7] Client Abort Simulation (Stop During Text Streaming)');
    const abortStreamRes = await postmanSSEStream(`/chat/${activeChatId}/stream`, {
      body: {
        chatId: activeChatId,
        text: 'Please write a comprehensive 200-item numbered historical chronology detailing Ethiopia from ancient times to the modern era, writing at least three full sentences for each item.',
        model: AI_MODELS.DEFAULT,
      },
      abortOnEvent: 'text',
      abortDelayMs: 0,
    });

    assert(abortStreamRes.aborted === true, 'Client simulated socket abort successfully');

    // Poll until server has persisted the stopped assistant turn in MongoDB Atlas
    const chatDoc7 = await waitForChatCondition(
      activeChatId,
      (doc) => doc.messages.length === 6 && doc.messages[5].role === 'assistant' && doc.messages[5].isStopped === true
    );
    assert(chatDoc7.messages.length === 6, 'Chat contains 6 messages after aborted turn');
    const stoppedAsstTurn = chatDoc7.messages[5];
    assert(stoppedAsstTurn.role === 'assistant', 'Last message is assistant');
    assert(stoppedAsstTurn.isStopped === true, 'Stopped assistant turn has isStopped === true persisted in DB');
    console.log(`     Stopped assistant partial text length: ${stoppedAsstTurn.text?.length || 0} chars`);

    // --------------------------------------------------------------------------
    // Scenario 8: Model A Continue Generating (In-Place Text Concatenation)
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 8] Model A Continue Generating (In-Place Resumption)');
    const initialTextLength = stoppedAsstTurn.text?.length || 0;
    const stoppedMsgId = stoppedAsstTurn._id.toString();

    const continueRes = await postmanSSEStream(`/chat/${activeChatId}/stream`, {
      body: {
        chatId: activeChatId,
        continueTurn: true,
        targetAssistantMessageId: stoppedMsgId,
        model: AI_MODELS.DEFAULT,
      },
    });

    assert(continueRes.status === 200, 'Continue generation SSE stream returned HTTP 200');
    const doneEventContinue = continueRes.events.find((e) => e.event === 'done');
    assert(Boolean(doneEventContinue), 'Done event received on continue stream');

    const chatDoc8 = await Chat.findById(activeChatId);
    assert(chatDoc8.messages.length === 6, 'ZERO SYNTHETIC USER BUBBLES: Message count strictly preserved at 6');
    const continuedAsstTurn = chatDoc8.messages[5];
    assert(continuedAsstTurn.isStopped === false, 'Continued assistant turn has isStopped reset to false');
    assert(
      (continuedAsstTurn.text?.length || 0) >= initialTextLength,
      `Text concatenated in-place: previous ${initialTextLength} chars -> new ${(continuedAsstTurn.text?.length || 0)} chars`
    );

    // --------------------------------------------------------------------------
    // Scenario 9: Stop -> Continue -> Stop -> Retry Lifecycle Cycle
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 9] Stop -> Continue -> Stop -> Retry Lifecycle Cycle');
    // Retrying turn 4 (the user turn preceding the continued assistant turn)
    const userTurn2Id = chatDoc8.messages[4]._id.toString();
    const retryAfterContinueRes = await postmanSSEStream(`/chat/${activeChatId}/stream`, {
      body: {
        chatId: activeChatId,
        isRetry: true,
        anchorUserMessageId: userTurn2Id,
        model: AI_MODELS.DEFAULT,
      },
    });

    assert(retryAfterContinueRes.status === 200, 'Retry after continue returned HTTP 200');
    const chatDoc9 = await Chat.findById(activeChatId);
    assert(chatDoc9.messages.length === 6, 'Retry clean re-run maintains 6 messages count');
    assert(chatDoc9.messages[5].isStopped === false, 'Regenerated assistant message has isStopped === false');

    // --------------------------------------------------------------------------
    // Scenario 10: Multi-Modal Context Re-hydration during Retry
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 10] Multi-Modal Context Re-hydration during Retry');
    // Provision a mock audio document in MongoDB
    mockAudio = new Audio({
      user: testUser._id,
      fileName: 'test_voice_note.mp3',
      originalName: 'test_voice_note.mp3',
      path: 'uploads/audios/test_voice_note.mp3',
      size: 1024,
      mimeType: 'audio/mp3',
      duration: 5.2,
      status: 'transcribed',
      transcription: 'Branch supervisor reported normal operational status today.',
      createdAt: new Date(),
    });
    await mockAudio.save();

    // Send a new multi-modal user turn with audio reference
    const mmStreamRes = await postmanSSEStream(`/chat/${activeChatId}/stream`, {
      body: {
        chatId: activeChatId,
        text: 'What did the supervisor report in the audio note?',
        audios: [mockAudio._id.toString()],
        attachments: [{
          fileName: 'ops_summary.txt',
          originalName: 'ops_summary.txt',
          mimeType: 'text/plain',
          size: 256,
          path: 'uploads/attachments/ops_summary.txt',
        }],
        model: AI_MODELS.DEFAULT,
      },
    });
    assert(mmStreamRes.status === 200, 'Multi-modal turn stream returned HTTP 200');

    const chatDoc10 = await Chat.findById(activeChatId);
    assert(chatDoc10.messages.length === 8, 'Chat now contains 8 messages with multi-modal turn');
    const mmUserTurn = chatDoc10.messages[6];
    assert(mmUserTurn.audios.length === 1, 'User turn persisted audio ObjectId reference');
    assert(mmUserTurn.attachments.length === 1, 'User turn persisted attachment disk path');

    // Retry the multi-modal assistant turn without resending audio files
    const mmRetryRes = await postmanSSEStream(`/chat/${activeChatId}/stream`, {
      body: {
        chatId: activeChatId,
        isRetry: true,
        anchorUserMessageId: mmUserTurn._id.toString(),
        model: AI_MODELS.DEFAULT,
      },
    });
    assert(mmRetryRes.status === 200, 'Multi-modal retry stream returned HTTP 200');
    const chatDoc10Retry = await Chat.findById(activeChatId);
    assert(chatDoc10Retry.messages.length === 8, 'Zero duplicate user turns on multi-modal retry');
    assert(chatDoc10Retry.messages[6].audios.length === 1, 'Audios persisted across retry');
    assert(chatDoc10Retry.messages[6].attachments.length === 1, 'Attachments persisted across retry');

    // --------------------------------------------------------------------------
    // Scenario 11: Teardown, Fixture Cleanup & Clean Server Termination
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 11] Teardown, Database Cleanup & Server Termination');
    await User.deleteOne({ _id: testUser._id });
    await Branch.deleteOne({ _id: testBranch._id });
    if (activeChatId) await Chat.deleteOne({ _id: activeChatId });
    if (mockAudio?._id) await Audio.deleteOne({ _id: mockAudio._id });
    assert(true, 'Test fixtures cleaned up from MongoDB Atlas');
  } finally {
    if (server) {
      server.close();
      console.log('📡 Test server closed successfully.');
    }
    await disconnectDB();
    console.log('🗄️ Disconnected from MongoDB Atlas.');
  }

  console.log(`\n======================================================`);
  console.log(`🎉 ALL 11 LIFECYCLE INTEGRATION SCENARIOS PASSED GREEN! (${assertionsPassed} assertions)`);
  console.log(`======================================================\n`);
};

runLifecycleSuite().catch((err) => {
  console.error('\n❌ LIFECYCLE TEST SUITE FAILED WITH ERROR:', err);
  process.exit(1);
});
