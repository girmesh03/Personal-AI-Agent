/**
 * @module scripts/testPhase14TurnEditLifecycle
 * @description Dedicated automated test suite verifying Point 9:
 * Full-Lifecycle User Message Turn Edit, Multimodal Ingestion, In-Flight Cancellation,
 * Delta Asset Accounting (Attachments & Audios), and Downstream Asset Pruning.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Chat } from '../src/models/Chat.js';
import { Audio } from '../src/models/Audio.js';
import * as storageService from '../src/services/storageService.js';
import { AI_MODELS, UPLOADS_CONFIG } from '../src/utils/constants.js';

const PORT = 4007;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

function createValidWavBuffer(sampleRate = 16000, numChannels = 1, durationSec = 1) {
  const numSamples = sampleRate * durationSec;
  const blockAlign = numChannels * 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

const VALID_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const VALID_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 0>>endobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n99\n%%EOF'
);

let server;
let userCookies = [];
let testUserId = null;
let testChatId = null;

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
      if (typeof options.body === 'object') {
        req.write(JSON.stringify(options.body));
      } else {
        req.write(options.body);
      }
    }
    req.end();
  });
}

function sseStreamRequest(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const postData = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Content-Length': Buffer.byteLength(postData),
    };
    if (userCookies.length > 0) {
      headers['Cookie'] = userCookies.join('; ');
    }

    const req = http.request(url, { method: 'POST', headers }, (res) => {
      let rawData = '';
      const events = [];

      res.on('data', (chunk) => {
        const str = chunk.toString('utf8');
        rawData += str;
        const lines = str.split('\n');
        let currentEvent = null;

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.replace('event: ', '').trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.replace('data: ', '').trim());
              events.push({ event: currentEvent, data });
            } catch {
              events.push({ event: currentEvent, data: line.replace('data: ', '').trim() });
            }
            currentEvent = null;
          }
        }
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          events,
          raw: rawData,
        });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTurnEditLifecycleSuite() {
  console.log('\n===============================================================');
  console.log('PHASE 14 POINT 9: USER MESSAGE TURN EDIT & LIFECYCLE AUDIT');
  console.log('===============================================================\n');

  try {
    await connectDB();
    server = app.listen(PORT, () => {
      console.log(`📡 Verification server running on ${BASE_URL}`);
    });

    const testEmail = `turn-edit-${Date.now()}@operon.test`;

    // 1. User Setup
    console.log('\n--- STEP 1: Provisioning Test User with BYOK Keys ---');
    const regRes = await httpRequest('/auth/register', {
      method: 'POST',
      body: {
        name: 'Jordan Operational Lead',
        email: testEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      },
    });
    assert(regRes.status === 201, 'User registration succeeds (HTTP 201)');

    const loginRes = await httpRequest('/auth/login', {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'Password123!',
      },
    });
    assert(loginRes.status === 200, 'User login succeeds and session cookie set (HTTP 200)');
    testUserId = loginRes.body?.data?.user?.id || loginRes.body?.data?.user?._id;

    // Seed BYOK credentials
    await User.findByIdAndUpdate(testUserId, {
      $set: {
        'settings.apiKeys.geminiApiKey': process.env.TEST_GEMINI_API_KEY || process.env.GEMINI_API_KEY || 'test-gemini-key',
        'settings.apiKeys.addisApiKey': process.env.TEST_ADDIS_API_KEY || process.env.ADDIS_API_KEY || 'test-addis-key',
      },
    });
    console.log('  ✓ Configured User BYOK credentials');

    // 2. Provisioning Mock Audio Documents & Files with Real Physical Files on Disk
    console.log('\n--- STEP 2: Creating Test Audio and Attachment Records with Physical Disk Files ---');
    const audio1File = `test-audio-1-${Date.now()}.wav`;
    const audio2File = `test-audio-2-${Date.now()}.wav`;
    const downstreamAudioFile = `test-audio-downstream-${Date.now()}.wav`;
    const menuDocFile = `menu-inventory-${Date.now()}.png`;

    const audio1DiskPath = path.join(UPLOADS_CONFIG.AUDIOS_DIR, audio1File);
    const audio2DiskPath = path.join(UPLOADS_CONFIG.AUDIOS_DIR, audio2File);
    const downstreamAudioDiskPath = path.join(UPLOADS_CONFIG.AUDIOS_DIR, downstreamAudioFile);
    const menuDocDiskPath = path.join(UPLOADS_CONFIG.ATTACHMENTS_DIR, menuDocFile);

    // Create physical dummy files on disk to verify dual-tier cleanup parity
    if (!fs.existsSync(UPLOADS_CONFIG.AUDIOS_DIR)) fs.mkdirSync(UPLOADS_CONFIG.AUDIOS_DIR, { recursive: true });
    if (!fs.existsSync(UPLOADS_CONFIG.ATTACHMENTS_DIR)) fs.mkdirSync(UPLOADS_CONFIG.ATTACHMENTS_DIR, { recursive: true });
    if (!fs.existsSync(UPLOADS_CONFIG.IMAGES_DIR)) fs.mkdirSync(UPLOADS_CONFIG.IMAGES_DIR, { recursive: true });

    fs.writeFileSync(audio1DiskPath, createValidWavBuffer());
    fs.writeFileSync(audio2DiskPath, createValidWavBuffer());
    fs.writeFileSync(downstreamAudioDiskPath, createValidWavBuffer());
    fs.writeFileSync(menuDocDiskPath, VALID_1X1_PNG);

    const audioDoc1 = await Audio.create({
      user: testUserId,
      fileName: audio1File,
      originalName: 'shift-brief-part1.wav',
      mimeType: 'audio/wav',
      size: 10240,
      path: `uploads/audios/${audio1File}`,
      publicId: `audios/test-public-1-${Date.now()}`,
      purpose: 'chat_voice_input',
      transcription: 'First shift briefing note',
      status: 'transcribed',
    });

    const audioDoc2 = await Audio.create({
      user: testUserId,
      fileName: audio2File,
      originalName: 'shift-brief-part2.wav',
      mimeType: 'audio/wav',
      size: 15360,
      path: `uploads/audios/${audio2File}`,
      publicId: `audios/test-public-2-${Date.now()}`,
      purpose: 'chat_voice_input',
      transcription: 'Second shift briefing note',
      status: 'transcribed',
    });

    const downstreamAudioDoc = await Audio.create({
      user: testUserId,
      fileName: downstreamAudioFile,
      originalName: 'downstream-turn.wav',
      mimeType: 'audio/wav',
      size: 20480,
      path: `uploads/audios/${downstreamAudioFile}`,
      publicId: `audios/test-public-downstream-${Date.now()}`,
      purpose: 'chat_voice_input',
      transcription: 'Downstream note that should be pruned',
      status: 'transcribed',
    });

    assert(Boolean(audioDoc1._id && audioDoc2._id && downstreamAudioDoc._id), 'Audio records provisioned in MongoDB');
    assert(fs.existsSync(audio1DiskPath) && fs.existsSync(audio2DiskPath) && fs.existsSync(downstreamAudioDiskPath) && fs.existsSync(menuDocDiskPath), 'Physical disk files verified on local filesystem');

    // 3. Create Multi-Turn Conversation
    console.log('\n--- STEP 3: Establishing Multi-Turn Conversation with Audio & Attachments ---');
    const turn1Payload = {
      message: 'Initial Turn 0 with 2 voice notes and 1 document',
      audios: [audioDoc1._id.toString(), audioDoc2._id.toString()],
      attachments: [
        {
          fileName: menuDocFile,
          originalName: 'menu-inventory.png',
          mimeType: 'image/png',
          size: 51200,
          publicId: `chat-attachments/menu-doc-${Date.now()}`,
          path: `uploads/attachments/${menuDocFile}`,
        },
      ],
      model: AI_MODELS.DEFAULT,
    };

    const stream1 = await sseStreamRequest('/chat/stream', turn1Payload);
    assert(stream1.status === 200, 'Turn 0 created successfully via SSE (HTTP 200)');
    const doneEvent = stream1.events.find((e) => e.event === 'done');
    testChatId = doneEvent?.data?.chatId;
    assert(Boolean(testChatId), `Chat session established (chatId: ${testChatId})`);

    // Add Turn 1 (downstream turn)
    const turn2Payload = {
      chatId: testChatId,
      message: 'Downstream Turn 1 with audio note',
      audios: [downstreamAudioDoc._id.toString()],
      model: AI_MODELS.DEFAULT,
    };
    const stream2 = await sseStreamRequest(`/chat/${testChatId}/stream`, turn2Payload);
    assert(stream2.status === 200, 'Downstream Turn 1 created (HTTP 200)');

    const chatBeforeEdit = await Chat.findById(testChatId);
    assert(chatBeforeEdit.messages.length === 4, `Conversation has 4 turns before edit (got: ${chatBeforeEdit.messages.length})`);

    // 4. Test AC-23: Turn N Edit Delta Removal of Audio & Attachment
    console.log('\n--- STEP 4: Editing Turn 0 - Removing Audio 2 & Document, Keeping Audio 1 (AC-23) ---');
    // User edits Turn 0: Keeps audioDoc1, removes audioDoc2, removes the document, updates prompt text
    const editPayload = {
      chatId: testChatId,
      editTurnIndex: 0,
      isEdit: true,
      message: 'Edited Turn 0: Keeping only Audio 1, removed Audio 2 and Document',
      audios: [audioDoc1._id.toString()], // Kept
      attachments: [], // Removed all attachments
      model: AI_MODELS.DEFAULT,
    };

    const editStream = await sseStreamRequest(`/chat/${testChatId}/stream`, editPayload);
    assert(editStream.status === 200, 'Edit Turn 0 stream returns HTTP 200');

    // Verify Chat state after edit
    const chatAfterEdit = await Chat.findById(testChatId);
    assert(chatAfterEdit.messages.length === 2, `Downstream turns sliced: chat now has 2 messages (Turn 0 user + assistant)`);
    assert(chatAfterEdit.messages[0].text.includes('Edited Turn 0'), 'Turn 0 user text updated');
    assert(chatAfterEdit.messages[0].audios.length === 1, `Turn 0 now contains exactly 1 kept audio (got: ${chatAfterEdit.messages[0].audios.length})`);
    assert(chatAfterEdit.messages[0].audios[0].toString() === audioDoc1._id.toString(), 'Kept audio matches audioDoc1 ID');
    assert(chatAfterEdit.messages[0].attachments.length === 0, 'Turn 0 attachments cleanly emptied');

    // Verify AC-23: Audio 2 was deleted from MongoDB Atlas via delta calculation
    const audio2Check = await Audio.findById(audioDoc2._id);
    assert(audio2Check === null, 'Delta audio 2 was permanently destroyed from MongoDB Atlas (AC-23)');

    // Verify AC-23 & AC-33: Physical disk unlinking parity
    assert(!fs.existsSync(audio2DiskPath), 'Physical disk file for Audio 2 was unlinked from backend/uploads/audios/ (AC-33)');
    assert(!fs.existsSync(menuDocDiskPath), 'Physical disk file for Document was unlinked from backend/uploads/attachments/ (AC-33)');

    // Verify AC-23: Kept audio 1 is preserved
    const audio1Check = await Audio.findById(audioDoc1._id);
    assert(audio1Check !== null, 'Kept audio 1 is strictly preserved in MongoDB Atlas (AC-23)');
    assert(fs.existsSync(audio1DiskPath), 'Kept audio 1 physical disk file remains preserved on local disk');

    // 5. Test AC-24 & AC-34: Downstream Audio Destruction & Disk Unlink on Prune
    console.log('\n--- STEP 5: Verifying Downstream Pruned Audio Destruction & Disk Unlink (AC-24 & AC-34) ---');
    const downstreamAudioCheck = await Audio.findById(downstreamAudioDoc._id);
    assert(downstreamAudioCheck === null, 'Downstream Turn 1 audio was completely destroyed from MongoDB on prune (AC-24)');
    assert(!fs.existsSync(downstreamAudioDiskPath), 'Physical disk file for downstream pruned audio unlinked from backend/uploads/audios/ (AC-34)');

    // 6. Test AC-22 & AC-35: Abandoned Composer / Edit Attachment Dismissal Without Crash & Local Disk Unlink
    console.log('\n--- STEP 6: Testing In-Flight / Staged Attachment Dismissal & Disk Unlink (AC-22 & AC-35) ---');
    const noopDeleteRes = await httpRequest('/chat/attachment', {
      method: 'DELETE',
    });
    assert(noopDeleteRes.status === 200, 'Premature/empty attachment dismissal returns HTTP 200 without crashing (got 200)');
    assert(noopDeleteRes.body?.data?.result === 'noop', 'Premature dismissal cleanly responds with { result: "noop" }');

    // Create a real physical staged file on disk to test dismissal unlinking
    const mockStagedFileName = `mock_staged_composer_${Date.now()}.png`;
    const mockStagedDiskPath = path.join(UPLOADS_CONFIG.IMAGES_DIR, mockStagedFileName);
    fs.writeFileSync(mockStagedDiskPath, VALID_1X1_PNG);
    assert(fs.existsSync(mockStagedDiskPath), 'Staged mock file created on disk');

    const stagedDeleteRes = await httpRequest(`/chat/attachment?publicId=chat-attachments%2Fmock_orphaned&fileName=${mockStagedFileName}&mimeType=image%2Fpng`, {
      method: 'DELETE',
    });
    assert(stagedDeleteRes.status === 200, 'Staged attachment dismissal returns HTTP 200 OK');
    assert(!fs.existsSync(mockStagedDiskPath), 'Physical disk file for staged attachment unlinked from backend/uploads/images/ on dismissal (AC-35)');

    // 7. Test AC-25 & AC-26: Point 10 User Multimodal Edit Scenario (Audio Kept + Image Added)
    console.log('\n--- STEP 7: Replicating User Journey: Turn 0 "hi" -> Turn 1 Audio -> Edit Turn 1 with Image (AC-25 & AC-26) ---');
    // Start fresh chat session
    const userFlowStream1 = await sseStreamRequest('/chat/stream', {
      message: 'hi',
      model: AI_MODELS.DEFAULT,
    });
    assert(userFlowStream1.status === 200, 'User flow Turn 0 "hi" sent successfully');
    const userFlowDone1 = userFlowStream1.events.find((e) => e.event === 'done');
    const userFlowChatId = userFlowDone1?.data?.chatId;
    assert(Boolean(userFlowChatId), `User flow session allocated (chatId: ${userFlowChatId})`);

    // Turn 1: User sends audio recording
    const userFlowAudioFile = `audio-user-flow-${Date.now()}.wav`;
    const userFlowAudioDiskPath = path.join(UPLOADS_CONFIG.AUDIOS_DIR, userFlowAudioFile);
    fs.writeFileSync(userFlowAudioDiskPath, createValidWavBuffer());

    const userFlowAudio = await Audio.create({
      user: testUserId,
      fileName: userFlowAudioFile,
      originalName: userFlowAudioFile,
      mimeType: 'audio/wav',
      size: 32768,
      path: `uploads/audios/${userFlowAudioFile}`,
      publicId: `personal-agent/audios/test-flow-audio-${Date.now()}`,
      purpose: 'chat_voice_input',
      transcription: 'Operational voice narration for turn 1',
      status: 'transcribed',
    });

    const userFlowStream2 = await sseStreamRequest(`/chat/${userFlowChatId}/stream`, {
      chatId: userFlowChatId,
      message: '', // voice only turn
      audios: [userFlowAudio._id.toString()],
      model: AI_MODELS.DEFAULT,
    });
    assert(userFlowStream2.status === 200, 'User flow Turn 1 voice audio sent successfully');

    const chatBeforeTurn1Edit = await Chat.findById(userFlowChatId);
    assert(chatBeforeTurn1Edit.messages.length === 4, 'Chat has 4 messages before edit (Turn 0 user+asst, Turn 1 user+asst)');
    assert(chatBeforeTurn1Edit.messages[2].audios.length === 1, 'Turn 1 user turn has audio attached in DB');

    // Turn 1 Edit: User adds image while keeping audio
    // We pass the audio descriptor in attachments array (replicating client serialization where ID is filename/UUID)
    const bezaImageFile = `beza_profile_pic_${Date.now()}.jpg`;
    const bezaPublicId = `chat-attachments/image-edit-${Date.now()}`;
    const bezaImageDiskPath = path.join(UPLOADS_CONFIG.ATTACHMENTS_DIR, bezaImageFile);
    fs.writeFileSync(bezaImageDiskPath, VALID_1X1_PNG);

    const editTurn1Payload = {
      chatId: userFlowChatId,
      editTurnIndex: 2,
      isEdit: true,
      message: 'Here is the photograph to go along with my audio recording',
      audios: [], // Client sent empty audios because rawId was filename
      attachments: [
        {
          fileName: userFlowAudio.fileName,
          originalName: userFlowAudio.originalName,
          mimeType: 'audio/wav',
          size: userFlowAudio.size,
          path: userFlowAudio.path,
          publicId: userFlowAudio.publicId,
          isAudio: true,
        },
        {
          fileName: bezaImageFile,
          originalName: 'beza_profile_pic.jpg',
          mimeType: 'image/jpeg',
          size: 65536,
          publicId: bezaPublicId,
          path: `uploads/attachments/${bezaImageFile}`,
        },
      ],
      model: AI_MODELS.DEFAULT,
    };

    const editTurn1Stream = await sseStreamRequest(`/chat/${userFlowChatId}/stream`, editTurn1Payload);
    assert(editTurn1Stream.status === 200, 'Edit Turn 1 with Audio + Image returns HTTP 200');

    // VERIFY CRITICAL INVARIANT AC-25: Audio was NOT purged!
    const audioAfterEditCheck = await Audio.findById(userFlowAudio._id);
    assert(audioAfterEditCheck !== null, 'CRITICAL (AC-25): Pre-existing audio was 100% PRESERVED in MongoDB Atlas after editing turn with image!');
    assert(fs.existsSync(userFlowAudioDiskPath), 'Pre-existing audio physical file remains preserved on local disk');

    // Verify Chat document has BOTH audio and image on edited Turn 1
    const chatAfterTurn1Edit = await Chat.findById(userFlowChatId);
    assert(chatAfterTurn1Edit.messages.length === 4, 'Chat has 4 messages after edit (downstream preserved at edit point)');
    const editedUserMsg = chatAfterTurn1Edit.messages[2];
    assert(editedUserMsg.audios.length === 1, `Edited user turn preserved audio reference in DB (got: ${editedUserMsg.audios.length})`);
    assert(editedUserMsg.audios[0].toString() === userFlowAudio._id.toString(), 'Edited user turn audio matches original audio ID');
    assert(editedUserMsg.attachments.length === 1, `Edited user turn contains newly attached image (got: ${editedUserMsg.attachments.length})`);
    assert(editedUserMsg.attachments[0].fileName === bezaImageFile, 'Newly attached image is persisted on user message turn');
    assert(editedUserMsg.text.includes('photograph to go along with my audio'), 'Edited user text updated');

    // VERIFY AC-27: Now explicitly remove the audio while keeping the image
    console.log('\n--- STEP 8: Explicitly Removing Audio from Turn 1 (AC-27 & AC-33) ---');
    const removeAudioEditPayload = {
      chatId: userFlowChatId,
      editTurnIndex: 2,
      isEdit: true,
      message: 'Now I have removed the audio note, keeping only the image',
      audios: [],
      attachments: [
        {
          fileName: bezaImageFile,
          originalName: 'beza_profile_pic.jpg',
          mimeType: 'image/jpeg',
          size: 65536,
          publicId: bezaPublicId,
          path: `uploads/attachments/${bezaImageFile}`,
        },
      ],
      model: AI_MODELS.DEFAULT,
    };
    const removeAudioStream = await sseStreamRequest(`/chat/${userFlowChatId}/stream`, removeAudioEditPayload);
    assert(removeAudioStream.status === 200, 'Turn 1 edit removing audio returns HTTP 200');

    const audioAfterExplicitRemoveCheck = await Audio.findById(userFlowAudio._id);
    assert(audioAfterExplicitRemoveCheck === null, 'AC-27: Audio was cleanly purged from DB when user explicitly removed it from message card');
    assert(!fs.existsSync(userFlowAudioDiskPath), 'AC-33: Explicitly removed audio physical disk file was unlinked from backend/uploads/audios/');
    assert(fs.existsSync(bezaImageDiskPath), 'Kept image physical file remains preserved on local disk');

    // 9. Cleanup
    console.log('\n--- STEP 9: Session Deletion & Dual-Tier Disk Cleanup Verification (AC-36) ---');
    await httpRequest(`/chat/${testChatId}`, { method: 'DELETE' });
    await httpRequest(`/chat/${userFlowChatId}`, { method: 'DELETE' });
    const finalChat = await Chat.findById(testChatId);
    assert(finalChat === null, 'Chat document deleted cleanly');
    assert(!fs.existsSync(bezaImageDiskPath), 'AC-36: Chat attachments unlinked from disk upon chat session deletion');

    await Audio.deleteMany({ user: testUserId });
    await User.findByIdAndDelete(testUserId);
    console.log('  ✓ Test user & assets cleared');

    console.log('\n===============================================================');
    console.log(`PHASE 14 POINT 9 VERIFICATION RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log('===============================================================\n');

    server.close();
    await disconnectDB();
    process.exit(testsFailed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    if (server) server.close();
    await disconnectDB();
    process.exit(1);
  }
}

runTurnEditLifecycleSuite();
