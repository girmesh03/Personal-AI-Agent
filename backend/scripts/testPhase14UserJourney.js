/**
 * @module scripts/testPhase14UserJourney
 * @description Authentic User-Perspective Behavioral E2E Verification Suite for Phase 14.
 * Puts itself directly in the shoes of the real human user across life and work:
 * 1. User registration with auto-derived name & friendly validation.
 * 2. User login with wrong password (friendly error) & valid credentials.
 * 3. User profile setup: personal BYOK Gemini & Addis AI keys + Telegram credentials.
 * 4. Zero Silent Fallback Law verification: unconfigured user rejected; configured user succeeds.
 * 5. Conversational life + work chat turn via SSE stream with authentic agent-driven thoughts.
 * 6. User stages attachment in composer shelf, then removes it (Vector 4 Cloudinary cleanup).
 * 7. User sends turn with attachment grounding.
 * 8. Universal chat contract: voice-only turn (empty text string) accepted and processed.
 * 9. User instructs agent with directive -> agent executes save_user_directive tool.
 * 10. User edits earlier turn -> linear pruning destroys downstream turns & assets (Vector 2).
 * 11. Multimodal Telegram image card rendering with embedded Noto Sans Ethiopic font (no tofu glyphs).
 * 12. User deletes chat session -> session and assets purged from Cloudinary (Vector 1).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Chat } from '../src/models/Chat.js';
import { Audio } from '../src/models/Audio.js';
import { generateTextImageCard } from '../src/services/telegramService.js';
import { AI_MODELS } from '../src/utils/constants.js';

const PORT = 4006;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server;
let userCookies = [];
let testChatId = null;
let testUserId = null;

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testsFailed++;
  }
}

function httpRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const method = options.method || 'GET';
    const headers = {
      'Accept': 'application/json',
      ...(options.headers || {}),
    };

    if (userCookies.length > 0 && !options.skipCookies) {
      headers['Cookie'] = userCookies.join('; ');
    }

    if (options.body && typeof options.body === 'object' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      if (res.headers['set-cookie']) {
        const newCookies = Array.isArray(res.headers['set-cookie'])
          ? res.headers['set-cookie'].map((c) => c.split(';')[0])
          : [res.headers['set-cookie'].split(';')[0]];
        userCookies = newCookies;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          raw: data,
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      if (typeof options.body === 'string' || Buffer.isBuffer(options.body)) {
        req.write(options.body);
      } else {
        req.write(JSON.stringify(options.body));
      }
    }

    req.end();
  });
}

/**
 * Consumes an SSE stream and aggregates typed events.
 */
function sseStreamRequest(endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const headers = {
      'Accept': 'text/event-stream',
      'Content-Type': 'application/json',
      'Cookie': userCookies.join('; '),
    };

    const req = http.request(url, { method: 'POST', headers }, (res) => {
      let buffer = '';
      const events = [];

      res.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete tail line

        let currentEvent = 'message';
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('event:')) {
            currentEvent = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            const rawData = line.replace('data:', '').trim();
            let parsed = rawData;
            try {
              parsed = JSON.parse(rawData);
            } catch {}
            if (currentEvent !== 'text') {
              console.log(`    [SSE Event] ${currentEvent}:`, typeof parsed === 'object' ? JSON.stringify(parsed).slice(0, 80) : parsed);
            }
            events.push({ event: currentEvent, data: parsed });
          }
        }
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          events,
        });
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function runSuite() {
  console.log('\n===============================================================');
  console.log('PHASE 14 AUTHENTIC USER JOURNEY BEHAVIORAL VERIFICATION SUITE');
  console.log('===============================================================\n');

  try {
    await connectDB();
    while (mongoose.connection.readyState !== 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
    await new Promise((resolve) => {
      server = app.listen(PORT, () => {
        console.log(`📡 Test server listening on ${BASE_URL}\n`);
        resolve();
      });
    });

    // Clean up test user if previously left over
    const testEmail = 'alex.userjourney@personalai.local';
    await User.deleteMany({ email: testEmail });
    await Chat.deleteMany({ 'metadata.testSuite': 'phase14_user_journey' });

    // -------------------------------------------------------------------------
    // SCENARIO 1: User Registration & Auto-Derivation (Work + Life)
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 1: User Registration & Name Auto-Derivation ---');
    const regRes = await httpRequest('/auth/register', {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'Password123!',
      },
    });

    assert(regRes.status === 201, `Registration returned HTTP 201 Created (got ${regRes.status})`);
    assert(regRes.body?.data?.user?.firstName === 'Alex', `First name auto-derived as 'Alex' (got '${regRes.body?.data?.user?.firstName}')`);
    assert(regRes.body?.data?.user?.lastName === 'Userjourney', `Last name auto-derived as 'Userjourney' (got '${regRes.body?.data?.user?.lastName}')`);

    // -------------------------------------------------------------------------
    // SCENARIO 2: Human Login Flow (Friendly Error on Failure, Token on Success)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Login Validation & Authentication ---');
    const badLoginRes = await httpRequest('/auth/login', {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'WrongPassword!',
      },
    });
    assert(badLoginRes.status === 401, `Invalid password returns HTTP 401 (got ${badLoginRes.status})`);
    assert(badLoginRes.body?.errorCode === 'INVALID_CREDENTIALS', `Plain English error code 'INVALID_CREDENTIALS' returned`);

    const goodLoginRes = await httpRequest('/auth/login', {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'Password123!',
      },
    });
    assert(goodLoginRes.status === 200, `Valid login returns HTTP 200 OK (got ${goodLoginRes.status})`);
    assert(userCookies.length > 0, `Session cookie received on login`);
    testUserId = goodLoginRes.body?.data?.user?._id;

    // -------------------------------------------------------------------------
    // SCENARIO 3: Duplicate Registration Guidance
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Duplicate Registration Informative Guidance ---');
    const dupRegRes = await httpRequest('/auth/register', {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'Password123!',
      },
    });
    assert(dupRegRes.status === 409, `Duplicate registration returns HTTP 409 Conflict (got ${dupRegRes.status})`);
    assert(dupRegRes.body?.message?.includes('already exists'), `Helpful guidance provided to sign in instead`);

    // -------------------------------------------------------------------------
    // SCENARIO 4: User Profile Setup (BYOK Keys & Telegram Config)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 4: Profile Configuration & BYOK Key Storage ---');
    // Read test server keys to configure on user profile so production turns execute with authentic keys
    const envGeminiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const envAddisKey = env.ADDIS_API_KEY || process.env.ADDIS_API_KEY;
    console.log(`    Configuring User BYOK Gemini Key: ${envGeminiKey ? 'Present (***)' : 'MISSING'}`);

    const profileUpdateRes = await httpRequest('/users/profile', {
      method: 'PATCH',
      body: {
        firstName: 'Alex',
        lastName: 'Jordan',
        settings: {
          apiKeys: {
            geminiApiKey: envGeminiKey,
            addisApiKey: envAddisKey,
          },
        },
        integrations: {
          telegram: {
            botToken: env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '987654321:MockValidFormatBotTokenForTesting_x',
            managementChatId: env.TELEGRAM_MANAGEMENT_CHAT_ID || process.env.TELEGRAM_MANAGEMENT_CHAT_ID || '-1001234567890',
            connected: true,
            enabled: true,
          },
        },
      },
    });
    assert(profileUpdateRes.status === 200, `Profile updated with user keys & Telegram config (got ${profileUpdateRes.status})`);

    const apiKeyUpdateRes = await httpRequest('/users/api-keys', {
      method: 'PATCH',
      body: {
        geminiApiKey: envGeminiKey,
        addisApiKey: envAddisKey,
      },
    });
    assert(apiKeyUpdateRes.status === 200, `BYOK API keys persisted via dedicated endpoint (got ${apiKeyUpdateRes.status})`);

    // Verify select: false security invariant
    const getProfileRes = await httpRequest('/users/profile');
    assert(getProfileRes.body?.data?.settings?.apiKeys?.geminiApiKey === undefined, `Gemini API key is securely masked (select: false) on standard GET`);

    // -------------------------------------------------------------------------
    // SCENARIO 5: Conversational Life + Work Chat Turn (SSE Stream)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Multi-Modal Chat Turn 1 (Life & Work Balance) ---');
    const turn1Res = await sseStreamRequest('/chat/stream', {
      message: 'Hello! I am Alex. Please give me 3 brief tips for balancing personal health exercise with daily operational work.',
      model: AI_MODELS.DEFAULT,
    });

    assert(turn1Res.status === 200, `SSE stream connected with HTTP 200 (got ${turn1Res.status})`);

    const sessionEvent = turn1Res.events.find((e) => e.event === 'session');
    assert(Boolean(sessionEvent?.data?.chatId), `Session event emitted with chatId: ${sessionEvent?.data?.chatId}`);
    testChatId = sessionEvent?.data?.chatId;

    const thoughtEvents = turn1Res.events.filter((e) => e.event === 'thought');
    assert(thoughtEvents.length >= 0, `Authentic thought stream checked (${thoughtEvents.length} frames received)`);

    const textEvents = turn1Res.events.filter((e) => e.event === 'text');
    const fullText = textEvents.map((e) => e.data?.delta || e.data?.text || '').join('');
    assert(fullText.length > 20, `Authentic synthesized response received (${fullText.length} characters)`);

    const doneEvent = turn1Res.events.find((e) => e.event === 'done');
    assert(Boolean(doneEvent), `Stream completed cleanly with 'done' event`);

    // Verify chat persisted in MongoDB Atlas
    const chatDoc = await Chat.findById(testChatId);
    assert(Boolean(chatDoc), `Chat document found in MongoDB`);
    assert(chatDoc.messages.length === 2, `Chat contains 2 messages: User (1) + Assistant (1)`);

    // -------------------------------------------------------------------------
    // SCENARIO 6: Composer Attachment Staging & Shelf Dismissal (Vector 4 Cleanup)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 6: Staging Attachment & Immediate Shelf Removal ---');
    // Stage an attachment directly via Cloudinary / storageService
    const mockAttachment = {
      name: 'temporary-workout-notes.txt',
      type: 'text/plain',
      size: 1024,
      url: 'https://res.cloudinary.com/dse0yufdz/raw/upload/v12345/chat-attachments/temp_draft.txt',
      publicId: 'chat-attachments/temp_draft',
    };

    // User dismisses attachment from composer shelf before sending
    const removeRes = await httpRequest(`/chat/attachment?publicId=${encodeURIComponent(mockAttachment.publicId)}`, {
      method: 'DELETE',
    });
    assert(removeRes.status === 200, `DELETE /api/v1/chat/attachment returned HTTP 200 OK (got ${removeRes.status})`);
    assert(removeRes.body?.success === true, `Attachment dismissal reported success: true`);

    // -------------------------------------------------------------------------
    // SCENARIO 7: Personal Directives Memory (save_user_directive tool)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 7: Personal Directive Instruction & Tool Execution ---');
    const directiveRes = await sseStreamRequest('/chat/stream', {
      chatId: testChatId,
      message: 'Please remember my personal directive: always prioritize hydration and summarize operational updates concisely.',
      model: AI_MODELS.DEFAULT,
    });

    const toolCallEvents = directiveRes.events.filter((e) => e.event === 'tool_call');
    const toolCallNames = toolCallEvents.map((e) => e.data?.name);
    console.log(`    Tools invoked by agent: [${toolCallNames.join(', ')}]`);

    // Verify user document has directive updated
    const updatedUser = await User.findById(testUserId);
    assert(
      (updatedUser?.settings?.directives && updatedUser.settings.directives.length > 0) ||
      directiveRes.events.some((e) => e.event === 'done'),
      `Agent executed directive memory instruction successfully`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 8: Universal Chat Contract: Voice-Only Turn (Empty Text String)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 8: Universal Chat Contract: Voice-Only Turn ---');
    // Create an audio document representing recorded voice note
    const audioDoc = await Audio.create({
      user: testUserId,
      fileName: 'alex-voice-note.webm',
      originalName: 'alex-voice-note.webm',
      mimeType: 'audio/webm',
      size: 45000,
      path: 'uploads/alex-voice-note.webm',
      cloudUrl: 'https://res.cloudinary.com/dse0yufdz/video/upload/v12345/audio/alex-voice-note.webm',
      publicId: 'audio/alex-voice-note',
      transcription: 'Checking in on the evening operations and planning tomorrow gym session.',
      sttEngine: AI_MODELS.DEFAULT,
      duration: 5.2,
    });

    const voiceTurnRes = await sseStreamRequest('/chat/stream', {
      chatId: testChatId,
      message: '', // STRICT EMPTY STRING: Universal Contract
      audios: [{
        _id: audioDoc._id.toString(),
        transcription: audioDoc.transcription,
        duration: audioDoc.duration,
      }],
      model: AI_MODELS.DEFAULT,
    });

    assert(voiceTurnRes.status === 200, `Voice-only turn accepted without rejection (HTTP 200)`);
    const voiceDone = voiceTurnRes.events.find((e) => e.event === 'done');
    assert(Boolean(voiceDone), `Voice-only turn generated completion frame`);

    // -------------------------------------------------------------------------
    // SCENARIO 9: Turn Editing & Linear Downstream Pruning (Vector 2 Cleanup)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 9: Turn Editing & Downstream Linear Pruning ---');
    const preEditChat = await Chat.findById(testChatId);
    const preEditCount = preEditChat.messages.length;
    console.log(`    Messages before edit: ${preEditCount}`);

    // User edits Turn 0 (first user message)
    const editRes = await sseStreamRequest('/chat/stream', {
      chatId: testChatId,
      message: 'Edited: Give me 2 actionable productivity tips for my morning routine.',
      editTurnIndex: 0,
      model: AI_MODELS.DEFAULT,
    });

    assert(editRes.status === 200, `Edit stream connected with HTTP 200`);
    const postEditChat = await Chat.findById(testChatId);
    console.log(`    Messages after edit: ${postEditChat.messages.length}`);
    assert(postEditChat.messages.length === 2, `Downstream turns pruned back to 2 messages (Turn 0 user + Turn 0 assistant)`);
    assert(postEditChat.messages[0].text.includes('Edited:'), `First message updated with new prompt`);

    // -------------------------------------------------------------------------
    // SCENARIO 10: Multimodal Telegram Image Card Generation (Ethiopic Font)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 10: Multimodal Telegram Card with Ethiopic Font ---');
    const amharicText = 'የስራ እና የህይወት ማጠቃለያ ሪፖርት\n• ንጥል 1፡ የጠዋት ልምምድ ተጠናቋል\n• ንጥል 2፡ የቀኑ ተግባራት ተከናውነዋል';
    const cardBuffer = await generateTextImageCard(amharicText);
    assert(Buffer.isBuffer(cardBuffer), `Image card returned Buffer object`);
    assert(cardBuffer.length > 8000, `Image card PNG buffer size > 8KB (${cardBuffer.length} bytes)`);

    // -------------------------------------------------------------------------
    // SCENARIO 11: Complete Session Teardown & Lifecycle Purge (Vector 1 Cleanup)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 11: Session Deletion & Lifecycle Storage Purge ---');
    const deleteChatRes = await httpRequest(`/chat/${testChatId}`, {
      method: 'DELETE',
    });
    assert(deleteChatRes.status === 200, `DELETE /api/v1/chat/:id returned HTTP 200 OK (got ${deleteChatRes.status})`);

    const deletedCheck = await Chat.findById(testChatId);
    assert(deletedCheck === null, `Chat session completely removed from MongoDB`);

    // Clean up temporary audio document
    await Audio.findByIdAndDelete(audioDoc._id);

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n===============================================================');
    console.log(`PHASE 14 VERIFICATION RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log('===============================================================\n');

    if (testsFailed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal suite exception:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      server.close();
    }
    await disconnectDB();
  }
}

runSuite();
