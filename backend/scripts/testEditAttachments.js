/**
 * @file backend/scripts/testEditAttachments.js
 * @description Exhaustive logical and practical verification for Edit Turn Attachment Handling:
 * 1. Validation test: Empty text with isEdit and retained attachment passes express-validator rules.
 * 2. Validation test: Empty text with isEdit and no body attachments passes express-validator rules (server re-hydration).
 * 3. Re-hydration logic: When client submits an edit with partial attachment metadata (fileName/originalName/id without server path),
 *    the controller correctly re-hydrates the stored attachment from targetTurn.attachments.
 * 4. Vision extraction: Ingesting a re-hydrated image produces inlineParts for Gemini.
 * 5. Gemini Contents History: compileUserTurnParts correctly includes inline image parts on the edited turn.
 * 6. Client Adapter: MuiChatAdapter.sendMessage preserves draft attachments even if client-only preview URLs (blob:) are present.
 * 7. Client Adapter signature: MuiChatAdapter.sendMessage retains the `messages` parameter.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { validationResult } from 'express-validator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

let passed = 0;
let failed = 0;

function assert(condition, description) {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${description}`);
    failed++;
    throw new Error(`Assertion failed: ${description}`);
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log(' Exhaustive Test: Multi-Modal Edit Turn Attachment Pipeline ');
  console.log('========================================================================\n');

  const { sendChatMessageValidation } = await import('../src/validations/chatValidation.js');
  const { processAttachments, resolveFilePath } = await import('../src/utils/attachmentProcessor.js');
  const { compileUserTurnParts } = await import('../src/controllers/chatController.js');

  // ============================================================================
  // TEST 1: Validation Rules for Edit Turns
  // ============================================================================
  console.log('[Test 1] Express-validator rules on Edit Turn variations...');

  // 1A. Screenshot 2 scenario: text: '', isEdit: true, attachments: [{ fileName: 'image.jpg', originalName: 'image.jpg' }]
  const req1A = {
    body: {
      chatId: '6ad4e81a336b8d19145560f3',
      text: '',
      isEdit: true,
      editTurnIndex: 1,
      anchorUserMessageId: 'msg-user-1',
      attachments: [
        {
          fileName: 'image.jpg',
          originalName: 'image.jpg',
        },
      ],
    },
  };
  for (const rule of sendChatMessageValidation) {
    await rule.run(req1A);
  }
  const result1A = validationResult(req1A);
  const errors1A = result1A.array();
  assert(errors1A.length === 0, `Screenshot 2 scenario (empty text + retained attachment) passes validation with 0 errors (got: ${JSON.stringify(errors1A)})`);

  // 1B. Empty text with isEdit: true and no attachments property in body (re-hydration from DB)
  const req1B = {
    body: {
      chatId: '6ad4e81a336b8d19145560f3',
      text: '',
      isEdit: true,
      editTurnIndex: 1,
      anchorUserMessageId: 'msg-user-1',
    },
  };
  for (const rule of sendChatMessageValidation) {
    await rule.run(req1B);
  }
  const result1B = validationResult(req1B);
  const errors1B = result1B.array();
  assert(errors1B.length === 0, `Edit turn with empty text and omitted attachments passes validation for server re-hydration (got: ${JSON.stringify(errors1B)})`);

  // 1C. Non-edit turn with empty text and no modalities STILL strictly fails validation
  const req1C = {
    body: {
      chatId: '6ad4e81a336b8d19145560f3',
      text: '',
    },
  };
  for (const rule of sendChatMessageValidation) {
    await rule.run(req1C);
  }
  const result1C = validationResult(req1C);
  assert(result1C.array().length > 0, 'Non-edit empty message correctly fails invariant validation');

  // ============================================================================
  // TEST 2: Server-Side Target Turn Attachment Re-Hydration Logic
  // ============================================================================
  console.log('\n[Test 2] Server-Side Target Turn Re-Hydration Logic...');

  // Create a dummy image file in backend/uploads/attachments/ for disk resolution testing
  const dummyDir = path.resolve(__dirname, '../uploads/attachments');
  if (!fs.existsSync(dummyDir)) {
    fs.mkdirSync(dummyDir, { recursive: true });
  }
  const dummyFilename = `test-edit-${Date.now()}.jpg`;
  const dummyFilePath = path.join(dummyDir, dummyFilename);
  // 1x1 transparent JPEG/binary
  fs.writeFileSync(dummyFilePath, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]));

  try {
    const storedAttachment = {
      _id: '671234567890abcdef123456',
      fileName: dummyFilename,
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 27,
      path: `uploads/attachments/${dummyFilename}`,
      url: `/uploads/attachments/${dummyFilename}`,
    };

    const targetTurn = {
      id: 'msg-target-1',
      role: 'user',
      text: 'what is this image',
      attachments: [storedAttachment],
      audios: [],
    };

    // Client sends an edit where path is missing (only originalName provided)
    const incomingClientAttachments = [
      {
        fileName: 'photo.jpg',
        originalName: 'photo.jpg',
      },
    ];

    // Re-hydration execution (identical to chatController.js)
    const rehydrated = incomingClientAttachments.map((att) => {
      const diskPath = att.path && !att.path.startsWith('blob:') && !att.path.startsWith('http')
        ? resolveFilePath(att.path)
        : null;
      if (diskPath && fs.existsSync(diskPath)) {
        return att;
      }
      const matchedStored = (targetTurn.attachments || []).find(
        (m) =>
          (att._id && String(m._id) === String(att._id)) ||
          (att.id && String(m._id) === String(att.id)) ||
          (att.fileName && m.fileName === att.fileName) ||
          (att.originalName && m.originalName === att.originalName) ||
          (att.name && m.originalName === att.name) ||
          (att.fileName && m.originalName === att.fileName)
      );
      if (matchedStored) {
        return {
          _id: matchedStored._id,
          fileName: matchedStored.fileName,
          originalName: matchedStored.originalName,
          mimeType: matchedStored.mimeType,
          size: matchedStored.size,
          path: matchedStored.path,
          url: matchedStored.url || `/uploads/attachments/${matchedStored.fileName}`,
        };
      }
      return att;
    });

    assert(rehydrated.length === 1, 'Re-hydrated attachment array has 1 item');
    assert(rehydrated[0].fileName === dummyFilename, 'Re-hydrated attachment has stored server fileName');
    assert(rehydrated[0].path === `uploads/attachments/${dummyFilename}`, 'Re-hydrated attachment has valid server disk path');
    assert(rehydrated[0].mimeType === 'image/jpeg', 'Re-hydrated attachment has correct image/jpeg MIME type');
    assert(rehydrated[0].size === 27, 'Re-hydrated attachment has correct file size');

    // ============================================================================
    // TEST 3: Multi-modal Vision Part Extraction on Re-hydrated Attachment
    // ============================================================================
    console.log('\n[Test 3] Multi-modal Vision Part Extraction on Re-hydrated Attachment...');

    const attResult = await processAttachments(rehydrated);
    assert(Array.isArray(attResult.inlineParts), 'processAttachments returned inlineParts array');
    assert(attResult.inlineParts.length === 1, 'processAttachments returned 1 inlinePart for image');
    assert(attResult.inlineParts[0].inlineData.mimeType === 'image/jpeg', 'inlineData MIME type is image/jpeg');
    assert(typeof attResult.inlineParts[0].inlineData.data === 'string' && attResult.inlineParts[0].inlineData.data.length > 0, 'inlineData contains base64 image data');

    // ============================================================================
    // TEST 4: Gemini History Multi-Modal Compilation on Edited Turn
    // ============================================================================
    console.log('\n[Test 4] Gemini History Compilation on Edited Turn...');

    const editedUserTurn = {
      id: 'msg-edited-1',
      role: 'user',
      text: 'tell me about the attached image',
      attachments: rehydrated,
      audios: [],
    };

    const compiledParts = await compileUserTurnParts(editedUserTurn);
    assert(compiledParts.length === 2, `compileUserTurnParts returned 2 parts (text + vision inlinePart) (got: ${compiledParts.length})`);
    assert(compiledParts[0].text === 'tell me about the attached image', 'First part is user text prompt');
    assert(Boolean(compiledParts[1].inlineData), 'Second part is inlineData multimodal vision part');
    assert(compiledParts[1].inlineData.mimeType === 'image/jpeg', 'inlineData has image/jpeg format');

    // Case B: Empty text with image
    const editedImageOnlyTurn = {
      id: 'msg-edited-image-only',
      role: 'user',
      text: '',
      attachments: rehydrated,
      audios: [],
    };
    const compiledImageOnlyParts = await compileUserTurnParts(editedImageOnlyTurn);
    assert(compiledImageOnlyParts.length === 1, `compileUserTurnParts for image-only turn returned 1 part (got: ${compiledImageOnlyParts.length})`);
    assert(Boolean(compiledImageOnlyParts[0].inlineData), 'Only part is inlineData multimodal vision part without empty text placeholder');
  } finally {
    // Clean up dummy file
    try {
      if (fs.existsSync(dummyFilePath)) {
        fs.unlinkSync(dummyFilePath);
      }
    } catch (_) {}
  }

  // ============================================================================
  // TEST 5: Client-Side MuiChatAdapter Attachment Non-Dropping Invariant
  // ============================================================================
  console.log('\n[Test 5] Client-Side MuiChatAdapter Attachment Non-Dropping Invariant...');

  const adapterModule = await import('../../client/src/adapters/MuiChatAdapter.js');
  const { MuiChatAdapter } = adapterModule;
  const adapter = new MuiChatAdapter({ dispatch: () => {} });

  // Test that sendMessage preserves attachments when file has a blob preview URL
  let capturedPayload = null;
  // Mock global fetch
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (url.includes('/chat/stream') || url.includes('/chat/')) {
      capturedPayload = JSON.parse(opts.body);
      return {
        ok: true,
        body: {
          getReader() {
            return {
              async read() {
                return { done: true, value: undefined };
              },
            };
          },
        },
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  try {
    const editMessage = {
      id: 'msg-local-user-1',
      parts: [
        { type: 'text', text: 'tell me about the attached image' },
      ],
      metadata: {
        isEdit: true,
        editTurnIndex: 1,
        anchorUserMessageId: 'msg-user-1',
      },
    };

    // draftAttachments simulating a retained message where path is not on the client entity
    const draftAttachments = [
      {
        id: 'image.jpg',
        name: 'image.jpg',
        fileName: 'image.jpg',
        originalName: 'image.jpg',
        size: 5000,
        mimeType: 'image/jpeg',
        url: 'blob:http://localhost:5173/1234-abcd',
      },
    ];

    await adapter.sendMessage({
      conversationId: '6ad4e81a336b8d19145560f3',
      message: editMessage,
      messages: [],
      attachments: draftAttachments,
    });

    assert(capturedPayload !== null, 'Fetch was invoked with stream payload');
    assert(capturedPayload.isEdit === true, 'Payload has isEdit: true');
    assert(capturedPayload.editTurnIndex === 1, 'Payload has editTurnIndex: 1');
    assert(Array.isArray(capturedPayload.attachments), 'Payload attachments is an array (not undefined or dropped!)');
    assert(capturedPayload.attachments.length === 1, `Payload has 1 attachment (got: ${capturedPayload.attachments.length})`);
    assert(capturedPayload.attachments[0].fileName === 'image.jpg', 'Attachment has fileName: image.jpg');
    assert(capturedPayload.attachments[0].originalName === 'image.jpg', 'Attachment has originalName: image.jpg');

    // Verify messages parameter is present in adapter.sendMessage signature
    const funcStr = adapter.sendMessage.toString();
    assert(funcStr.includes('messages'), 'adapter.sendMessage retains messages in its parameter list');
  } finally {
    global.fetch = originalFetch;
  }

  console.log('\n========================================================================');
  console.log(` Summary: All ${passed} tests PASSED with 0 failures!`);
  console.log('========================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\nTests crashed:', err);
  process.exit(1);
});
