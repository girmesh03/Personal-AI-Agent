/**
 * @file verifyDynamicSttStatus.js
 * @description Targeted verification script testing dynamic STT engine status resolution,
 * SSOT label mapping, validation chains, and Server-Sent Event status emissions.
 */

import http from 'node:http';
import assert from 'node:assert';
import mongoose from 'mongoose';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { connectDB, disconnectDB } from '../src/config/db.js';
import logger from '../src/config/logger.js';
import { User } from '../src/models/User.js';
import { Chat } from '../src/models/Chat.js';
import { Audio } from '../src/models/Audio.js';
import {
  AI_MODELS,
  STT_ENGINE_LABELS,
  formatSttEngineDisplayName,
} from '../src/utils/constants.js';
import chatRoutes from '../src/routes/chatRoutes.js';
import { generateAccessToken } from '../src/utils/token.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

let server;
let testUser;
let testAudio;
let authToken;
const PORT = 4009;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

function makePostRequest(path, payload, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const bodyStr = JSON.stringify(payload);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c.toString('utf-8')));
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function captureInitialSSEStatus(path, payload, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const bodyStr = JSON.stringify(payload);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let buffer = '';
        const events = [];

        res.on('data', (chunk) => {
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n\n');
          buffer = lines.pop(); // keep remainder

          for (const frame of lines) {
            if (!frame.trim()) continue;
            let eventType = 'message';
            let eventData = null;
            for (const line of frame.split('\n')) {
              if (line.startsWith('event:')) {
                eventType = line.replace('event:', '').trim();
              } else if (line.startsWith('data:')) {
                const raw = line.replace('data:', '').trim();
                try {
                  eventData = JSON.parse(raw);
                } catch {
                  eventData = raw;
                }
              }
            }
            events.push({ event: eventType, data: eventData });

            // Once we capture the transcribing status event, abort stream immediately
            if (eventType === 'status' && eventData?.stage === 'transcribing') {
              req.destroy();
              resolve({ status: res.statusCode, transcribingEvent: eventData, events });
              return;
            }
          }
        });

        res.on('end', () => {
          resolve({ status: res.statusCode, transcribingEvent: null, events });
        });
      }
    );

    req.on('error', (err) => {
      // If destroyed by us on receiving status, don't fail
      if (err.code === 'ECONNRESET') return;
      reject(err);
    });
    req.write(bodyStr);
    req.end();
  });
}

async function runDynamicSttSuite() {
  console.log('🧪 Starting Dynamic STT Engine Verification Suite...\n');

  // Test 1: Unit tests for formatSttEngineDisplayName
  console.log('[Test 1] SSOT STT Engine Label Mapping');
  assert.strictEqual(formatSttEngineDisplayName('addis_ai'), 'Addis AI');
  assert.strictEqual(formatSttEngineDisplayName('gemini-3.8-flash'), 'Gemini 3.8 Flash');
  assert.strictEqual(formatSttEngineDisplayName('gemini-3.1-flash-lite'), 'Gemini 3.1 Flash Lite');
  assert.strictEqual(formatSttEngineDisplayName(null), 'Addis AI');
  assert.strictEqual(formatSttEngineDisplayName(undefined), 'Addis AI');
  assert.strictEqual(formatSttEngineDisplayName('unknown-engine'), 'unknown-engine');
  console.log('  ✅ [PASS] formatSttEngineDisplayName correctly maps SSOT labels\n');

  // Connect to DB and start lightweight Express test instance
  await connectDB();
  console.log('  ✅ [PASS] Connected to MongoDB');

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/chat', chatRoutes);
  app.use(errorHandler);

  await new Promise((res) => {
    server = app.listen(PORT, res);
  });
  console.log(`  ✅ [PASS] Test server listening on http://localhost:${PORT}`);

  try {
    // Provision test user and audio fixture
    await User.deleteMany({ email: 'stt_tester@personalai.local' });
    testUser = await User.create({
      firstName: 'STT',
      lastName: 'Tester',
      email: 'stt_tester@personalai.local',
      password: 'Password123!',
      role: 'area_supervisor',
      status: 'active',
      settings: {
        sttEngine: 'addis_ai',
      },
    });
    authToken = generateAccessToken(testUser._id);

    testAudio = await Audio.create({
      user: testUser._id,
      fileName: 'sample_stt.mp3',
      originalName: 'sample_stt.mp3',
      path: 'uploads/audios/sample_stt.mp3',
      size: 512,
      mimeType: 'audio/mp3',
      status: 'transcribed',
      transcription: 'Operational status is normal.',
    });
    console.log('  ✅ [PASS] Provisioned test user and audio document\n');

    // Test 2: Validation rejection of invalid sttEngine
    console.log('[Test 2] Chat Validation Chain Rejection');
    const invalidRes = await makePostRequest(
      '/chat/stream',
      {
        text: 'Hello test',
        sttEngine: 'invalid_malicious_engine_123',
      },
      authToken
    );
    assert.strictEqual(invalidRes.status, 422, 'Invalid sttEngine rejected with HTTP 422');
    assert.ok(
      JSON.stringify(invalidRes.data).includes("sttEngine 'invalid_malicious_engine_123' is not supported"),
      'Error message identifies unsupported sttEngine'
    );
    console.log('  ✅ [PASS] Express-validator rejected unsupported sttEngine with HTTP 422\n');

    // Test 3: Multi-modal stream with explicit sttEngine: 'gemini-3.8-flash'
    console.log('[Test 3] Dynamic SSE Status with gemini-3.8-flash');
    const flashRes = await captureInitialSSEStatus(
      '/chat/stream',
      {
        text: 'Please review audio',
        audios: [testAudio._id.toString()],
        sttEngine: 'gemini-3.8-flash',
        model: AI_MODELS.DEFAULT,
      },
      authToken
    );
    assert.ok(flashRes.transcribingEvent, 'Captured transcribing status event');
    assert.strictEqual(
      flashRes.transcribingEvent.message,
      'Transcribing audio note with Gemini 3.8 Flash...',
      'Status message dynamically displayed Gemini 3.8 Flash'
    );
    console.log(`  ✅ [PASS] Emitted dynamic message: "${flashRes.transcribingEvent.message}"\n`);

    // Test 4: Multi-modal stream with explicit sttEngine: 'addis_ai'
    console.log('[Test 4] Dynamic SSE Status with addis_ai');
    const addisRes = await captureInitialSSEStatus(
      '/chat/stream',
      {
        text: 'Please review audio',
        audios: [testAudio._id.toString()],
        sttEngine: 'addis_ai',
        model: AI_MODELS.DEFAULT,
      },
      authToken
    );
    assert.ok(addisRes.transcribingEvent, 'Captured transcribing status event');
    assert.strictEqual(
      addisRes.transcribingEvent.message,
      'Transcribing audio note with Addis AI...',
      'Status message dynamically displayed Addis AI'
    );
    console.log(`  ✅ [PASS] Emitted dynamic message: "${addisRes.transcribingEvent.message}"\n`);

    // Test 5: Multi-modal stream fallback to user settings
    console.log('[Test 5] Dynamic SSE Status fallback to user settings');
    await User.updateOne({ _id: testUser._id }, { 'settings.sttEngine': 'gemini-3.1-flash-lite' });
    const userFallbackRes = await captureInitialSSEStatus(
      '/chat/stream',
      {
        text: 'Please review audio',
        audios: [testAudio._id.toString()],
        model: AI_MODELS.DEFAULT,
      },
      authToken
    );
    assert.ok(userFallbackRes.transcribingEvent, 'Captured transcribing status event');
    assert.strictEqual(
      userFallbackRes.transcribingEvent.message,
      'Transcribing audio note with Gemini 3.1 Flash Lite...',
      'Status message dynamically displayed Gemini 3.1 Flash Lite from user settings'
    );
    console.log(`  ✅ [PASS] Emitted dynamic message: "${userFallbackRes.transcribingEvent.message}"\n`);

    console.log('🎉 ALL DYNAMIC STT STATUS TESTS PASSED PERFECTLY!\n');
  } finally {
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
      await Chat.deleteMany({ user: testUser._id });
    }
    if (testAudio) {
      await Audio.deleteOne({ _id: testAudio._id });
    }
    if (server) {
      await new Promise((res) => server.close(res));
    }
    await disconnectDB();
    console.log('🗄️ Database cleaned up and test server closed.');
  }
}

runDynamicSttSuite().catch((err) => {
  console.error('❌ DYNAMIC STT TEST FAILED:', err);
  if (server) server.close();
  disconnectDB();
  process.exit(1);
});
