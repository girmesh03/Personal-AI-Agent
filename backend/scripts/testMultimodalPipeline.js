import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { resolveFilePath, processAttachment, processAttachments } from '../src/utils/attachmentProcessor.js';
import { resolveAudioDiskPath } from '../src/utils/audioChunker.js';
import { compileUserTurnParts } from '../src/controllers/chatController.js';
import { UPLOADS_CONFIG } from '../src/utils/constants.js';

console.log('🧪 Starting Multi-Modal Attachment & Audio Pipeline Verification...');

// Ensure test attachment file exists in UPLOADS_CONFIG.ATTACHMENTS_DIR
if (!fs.existsSync(UPLOADS_CONFIG.ATTACHMENTS_DIR)) {
  fs.mkdirSync(UPLOADS_CONFIG.ATTACHMENTS_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_CONFIG.AUDIOS_DIR)) {
  fs.mkdirSync(UPLOADS_CONFIG.AUDIOS_DIR, { recursive: true });
}

const testImgName = `test-verify-${Date.now()}.png`;
const testImgPath = path.resolve(UPLOADS_CONFIG.ATTACHMENTS_DIR, testImgName);
// Create a 1x1 dummy PNG
const dummyPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
fs.writeFileSync(testImgPath, dummyPngBuffer);

const testTxtName = `test-verify-${Date.now()}.txt`;
const testTxtPath = path.resolve(UPLOADS_CONFIG.ATTACHMENTS_DIR, testTxtName);
fs.writeFileSync(testTxtPath, 'Hello world multimodal test content');

try {
  // Test 1: resolveFilePath with Linux root-slash path
  console.log('\n[1] Testing resolveFilePath across diverse path formats:');
  const linuxPath = `/uploads/attachments/${testImgName}`;
  const resolvedLinux = resolveFilePath(linuxPath);
  assert.strictEqual(fs.existsSync(resolvedLinux), true, `Failed to resolve Linux-style path: ${linuxPath}`);
  console.log('  ✅ Linux /uploads/ path resolved to:', resolvedLinux);

  // Test 2: resolveFilePath with relative path
  const relPath = `uploads/attachments/${testImgName}`;
  const resolvedRel = resolveFilePath(relPath);
  assert.strictEqual(fs.existsSync(resolvedRel), true, `Failed to resolve relative path: ${relPath}`);
  console.log('  ✅ Relative uploads/ path resolved to:', resolvedRel);

  // Test 3: resolveFilePath with basename only
  const resolvedBasename = resolveFilePath(testImgName);
  assert.strictEqual(fs.existsSync(resolvedBasename), true, `Failed to resolve basename: ${testImgName}`);
  console.log('  ✅ Basename resolved to:', resolvedBasename);

  // Test 4: resolveAudioDiskPath
  console.log('\n[2] Testing resolveAudioDiskPath:');
  const testAudioName = `test-audio-${Date.now()}.wav`;
  const testAudioPath = path.resolve(UPLOADS_CONFIG.AUDIOS_DIR, testAudioName);
  fs.writeFileSync(testAudioPath, Buffer.from('RIFF....WAVEfmt '));
  const resolvedAudio = resolveAudioDiskPath(`/uploads/audios/${testAudioName}`);
  assert.strictEqual(fs.existsSync(resolvedAudio), true, `Failed to resolve audio path`);
  console.log('  ✅ Audio /uploads/audios/ path resolved to:', resolvedAudio);
  fs.unlinkSync(testAudioPath);

  // Test 5: processAttachment with image
  console.log('\n[3] Testing processAttachment with image:');
  const imgResult = await processAttachment({
    fileName: testImgName,
    originalName: 'photo.png',
    mimeType: 'image/png',
    path: `/uploads/attachments/${testImgName}`,
  });
  assert.strictEqual(imgResult.type, 'inline');
  assert.strictEqual(imgResult.inlinePart.inlineData.mimeType, 'image/png');
  assert.strictEqual(Boolean(imgResult.inlinePart.inlineData.data), true);
  console.log('  ✅ Image processed into inlineData part with base64 length:', imgResult.inlinePart.inlineData.data.length);

  // Test 6: processAttachment with text document
  console.log('\n[4] Testing processAttachment with text document:');
  const txtResult = await processAttachment({
    fileName: testTxtName,
    originalName: 'notes.txt',
    mimeType: 'text/plain',
    path: `uploads/attachments/${testTxtName}`,
  });
  assert.strictEqual(txtResult.type, 'text');
  assert.strictEqual(txtResult.content.includes('Hello world multimodal test content'), true);
  console.log('  ✅ Text document processed into structured context XML block');

  // Test 7: compileUserTurnParts - Image ONLY without user text
  console.log('\n[5] Testing compileUserTurnParts with Image ONLY (No user text):');
  const imageOnlyTurn = {
    role: 'user',
    text: '',
    attachments: [
      {
        fileName: testImgName,
        originalName: 'dashboard.png',
        mimeType: 'image/png',
        path: `/uploads/attachments/${testImgName}`,
      },
    ],
  };
  const partsImgOnly = await compileUserTurnParts(imageOnlyTurn);
  assert.strictEqual(partsImgOnly.length >= 2, true, 'Must produce at least text prompt and inlineData');
  assert.strictEqual(partsImgOnly[0].text.includes('Please review and analyze'), true);
  assert.strictEqual(Boolean(partsImgOnly[1].inlineData), true);
  console.log('  ✅ Image-only turn generated guiding prompt:', partsImgOnly[0].text);
  console.log('  ✅ Image-only turn contains inlineData with mimeType:', partsImgOnly[1].inlineData.mimeType);

  // Test 8: compileUserTurnParts - Image WITH user text
  console.log('\n[6] Testing compileUserTurnParts with Image WITH user text:');
  const imageWithTextTurn = {
    role: 'user',
    text: 'What do you see in this screenshot?',
    attachments: [
      {
        fileName: testImgName,
        originalName: 'dashboard.png',
        mimeType: 'image/png',
        path: testImgName,
      },
    ],
  };
  const partsImgText = await compileUserTurnParts(imageWithTextTurn);
  assert.strictEqual(partsImgText[0].text, 'What do you see in this screenshot?');
  assert.strictEqual(Boolean(partsImgText[1].inlineData), true);
  console.log('  ✅ Image + text turn preserved user prompt and attached inlineData');

  // Test 9: compileUserTurnParts - Document ONLY without user text
  console.log('\n[7] Testing compileUserTurnParts with Document ONLY (No user text):');
  const docOnlyTurn = {
    role: 'user',
    text: '',
    attachments: [
      {
        fileName: testTxtName,
        originalName: 'notes.txt',
        mimeType: 'text/plain',
        path: testTxtName,
      },
    ],
  };
  const partsDocOnly = await compileUserTurnParts(docOnlyTurn);
  assert.strictEqual(partsDocOnly[0].text.includes('Please review the provided audio/document context'), true);
  assert.strictEqual(partsDocOnly[0].text.includes('Hello world multimodal test content'), true);
  console.log('  ✅ Document-only turn generated guiding prompt and injected document content');

  // Test 10: compileUserTurnParts - RETRY re-hydration
  console.log('\n[8] Testing compileUserTurnParts for RETRY turn:');
  const retryTurn = {
    role: 'user',
    text: 'Analyze the revenue numbers',
    documentTextContext: '<attachment name="notes.txt" type="text/plain">\nHello world multimodal test content\n</attachment>',
    attachments: [
      {
        fileName: testImgName,
        originalName: 'chart.png',
        mimeType: 'image/png',
        path: testImgName,
      },
    ],
  };
  const partsRetry = await compileUserTurnParts(retryTurn);
  assert.strictEqual(partsRetry[0].text.includes('Analyze the revenue numbers'), true);
  assert.strictEqual(partsRetry[0].text.includes('Hello world multimodal test content'), true);
  assert.strictEqual(Boolean(partsRetry[1].inlineData), true);
  console.log('  ✅ Retry turn successfully rehydrated documentTextContext AND image inlineData');

  console.log('\n🎉 ALL MULTIMODAL PIPELINE UNIT TESTS PASSED GREEN!\n');
} finally {
  // Cleanup test files
  if (fs.existsSync(testImgPath)) fs.unlinkSync(testImgPath);
  if (fs.existsSync(testTxtPath)) fs.unlinkSync(testTxtPath);
}
