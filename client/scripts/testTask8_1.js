/**
 * @module scripts/testTask8_1
 * @description Comprehensive unit mock verification harness for Task 8.1.
 * Tests validateChatAttachment gates, useAudioRecorder helpers, and chatSlice Redux state machine.
 */

import assert from 'node:assert/strict';
import {
  formatBytesToMb,
  isFileFormatAllowed,
  validateChatAttachments,
} from '../src/utils/validateChatAttachment.js';
import {
  formatDuration,
  getSupportedAudioMimeType,
} from '../src/hooks/useAudioRecorder.js';
import chatReducer, {
  setActiveChatId,
  toggleDrawer,
  setDrawerOpen,
  setActiveModel,
  setThinkingBudget,
  setLanguage,
  setSttEngine,
  setIsStreaming,
  setStreamingStatus,
  resetChatUiState,
  selectActiveChatId,
  selectIsDrawerOpen,
  selectActiveModel,
  selectThinkingBudget,
  selectLanguage,
  selectSttEngine,
  selectIsStreaming,
  selectStreamingStatus,
  chatApi,
} from '../src/redux/features/chatSlice.js';
import {
  ATTACHMENT_CONSTANTS,
  AUDIO_CONSTANTS,
  AI_MODELS,
  CHAT_CONSTANTS,
} from '../src/utils/constants.js';

let passedCount = 0;
let totalCount = 0;

function test(description, fn) {
  totalCount += 1;
  try {
    fn();
    passedCount += 1;
    console.log(`  \x1b[32m✔\x1b[0m ${description}`);
  } catch (err) {
    console.error(`  \x1b[31m✘\x1b[0m ${description}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log('\n--- [TASK 8.1 VERIFICATION SUITE] ---\n');

// ==========================================
// Suite 1: Attachment Pre-Validator Tests
// ==========================================
console.log('Suite 1: validateChatAttachment.js Pre-Send Gates');

test('formatBytesToMb formats bytes accurately', () => {
  assert.equal(formatBytesToMb(0), '0 MB');
  assert.equal(formatBytesToMb(1024 * 1024), '1.0 MB');
  assert.equal(formatBytesToMb(25 * 1024 * 1024), '25.0 MB');
  assert.equal(formatBytesToMb(50 * 1024 * 1024), '50.0 MB');
});

test('isFileFormatAllowed accepts valid MIME types and file extensions', () => {
  // Document tests
  assert.equal(isFileFormatAllowed({ name: 'audit.pdf', type: 'application/pdf' }), true);
  assert.equal(isFileFormatAllowed({ name: 'summary.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), true);
  assert.equal(isFileFormatAllowed({ name: 'data.xlsx', type: 'application/vnd.ms-excel' }), true);
  assert.equal(isFileFormatAllowed({ name: 'notes.txt', type: 'text/plain' }), true);
  assert.equal(isFileFormatAllowed({ name: 'report.csv', type: 'text/csv' }), true);

  // Image tests
  assert.equal(isFileFormatAllowed({ name: 'photo.jpg', type: 'image/jpeg' }), true);
  assert.equal(isFileFormatAllowed({ name: 'photo.png', type: 'image/png' }), true);
  assert.equal(isFileFormatAllowed({ name: 'photo.webp', type: 'image/webp' }), true);

  // Audio tests
  assert.equal(isFileFormatAllowed({ name: 'voice.webm', type: 'audio/webm' }), true);
  assert.equal(isFileFormatAllowed({ name: 'voice.mp3', type: 'audio/mpeg' }), true);
  assert.equal(isFileFormatAllowed({ name: 'voice.m4a', type: 'audio/m4a' }), true);

  // Extension fallback when MIME is empty
  assert.equal(isFileFormatAllowed({ name: 'report.pdf', type: '' }), true);
  assert.equal(isFileFormatAllowed({ name: 'data.xlsx', type: '' }), true);
  assert.equal(isFileFormatAllowed({ name: 'photo.png', type: '' }), true);
});

test('isFileFormatAllowed rejects unauthorized extensions/MIMEs', () => {
  assert.equal(isFileFormatAllowed({ name: 'malware.exe', type: 'application/x-msdownload' }), false);
  assert.equal(isFileFormatAllowed({ name: 'script.sh', type: 'application/x-sh' }), false);
  assert.equal(isFileFormatAllowed({ name: 'binary.bin', type: 'application/octet-stream' }), false);
  assert.equal(isFileFormatAllowed({ name: 'archive.zip', type: 'application/zip' }), false);
});

test('Gate 1: Rejects batch when total files count > 5', () => {
  const existingFiles = [
    { name: '1.pdf', size: 1000, type: 'application/pdf' },
    { name: '2.pdf', size: 1000, type: 'application/pdf' },
    { name: '3.pdf', size: 1000, type: 'application/pdf' },
  ];
  const incomingFiles = [
    { name: '4.pdf', size: 1000, type: 'application/pdf' },
    { name: '5.pdf', size: 1000, type: 'application/pdf' },
    { name: '6.pdf', size: 1000, type: 'application/pdf' }, // 3 + 3 = 6 > 5
  ];

  const result = validateChatAttachments(incomingFiles, existingFiles, { showToast: false });
  assert.equal(result.isValid, false);
  assert.ok(result.error.includes('maximum of 5 files'));
});

test('Gate 2: Rejects file exceeding 25MB single file limit', () => {
  const oversizedFile = {
    name: 'giant_video.pdf',
    size: 26 * 1024 * 1024, // 26MB > 25MB
    type: 'application/pdf',
  };

  const result = validateChatAttachments([oversizedFile], [], { showToast: false });
  assert.equal(result.isValid, false);
  assert.ok(result.error.includes('exceeds the 25.0 MB single file limit'));
});

test('Gate 3: Rejects batch exceeding 50MB cumulative batch limit', () => {
  const existing = [
    { name: 'f1.pdf', size: 24 * 1024 * 1024, type: 'application/pdf' },
    { name: 'f2.pdf', size: 20 * 1024 * 1024, type: 'application/pdf' },
  ]; // 44MB
  const incoming = [
    { name: 'f3.pdf', size: 10 * 1024 * 1024, type: 'application/pdf' }, // 44 + 10 = 54MB > 50MB
  ];

  const result = validateChatAttachments(incoming, existing, { showToast: false });
  assert.equal(result.isValid, false);
  assert.ok(result.error.includes('exceeds the 50.0 MB batch limit'));
});

test('Gate 4: Accepts valid batch within all 4 constraints', () => {
  const validFiles = [
    { name: 'report1.pdf', size: 2 * 1024 * 1024, type: 'application/pdf' },
    { name: 'report2.docx', size: 3 * 1024 * 1024, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { name: 'voice.webm', size: 1 * 1024 * 1024, type: 'audio/webm' },
  ];

  const result = validateChatAttachments(validFiles, [], { showToast: false });
  assert.equal(result.isValid, true);
  assert.equal(result.validFiles.length, 3);
  assert.equal(result.error, null);
  assert.equal(result.totalSizeBytes, 6 * 1024 * 1024);
});

// ==========================================
// Suite 2: Audio Recording Helpers Tests
// ==========================================
console.log('\nSuite 2: useAudioRecorder.js Helpers');

test('formatDuration formats seconds accurately into mm:ss', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(-5), '00:00');
  assert.equal(formatDuration(14), '00:14');
  assert.equal(formatDuration(59), '00:59');
  assert.equal(formatDuration(60), '01:00');
  assert.equal(formatDuration(65), '01:05');
  assert.equal(formatDuration(600), '10:00');
  assert.equal(formatDuration(725), '12:05');
});

test('getSupportedAudioMimeType executes safely in headless environment', () => {
  const mime = getSupportedAudioMimeType();
  assert.ok(typeof mime === 'string');
});

// ==========================================
// Suite 3: chatSlice Redux State Machine
// ==========================================
console.log('\nSuite 3: chatSlice Redux State Machine');

test('Initial state reflects system invariants', () => {
  const state = chatReducer(undefined, { type: '@@INIT' });
  assert.equal(state.activeChatId, null);
  assert.equal(state.isDrawerOpen, false);
  assert.equal(state.activeModel, AI_MODELS.DEFAULT);
  assert.equal(state.thinkingBudget, CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET);
  assert.equal(state.language, CHAT_CONSTANTS.DEFAULT_LANGUAGE);
  assert.equal(state.sttEngine, CHAT_CONSTANTS.DEFAULT_STT_ENGINE);
  assert.equal(state.isStreaming, false);
  assert.equal(state.streamingStatus, 'idle');
});

test('setActiveChatId updates activeChatId correctly', () => {
  let state = chatReducer(undefined, setActiveChatId('chat-12345'));
  assert.equal(state.activeChatId, 'chat-12345');
  state = chatReducer(state, setActiveChatId(null));
  assert.equal(state.activeChatId, null);
});

test('toggleDrawer and setDrawerOpen toggle drawer visibility', () => {
  let state = chatReducer(undefined, toggleDrawer());
  assert.equal(state.isDrawerOpen, true);
  state = chatReducer(state, toggleDrawer());
  assert.equal(state.isDrawerOpen, false);
  state = chatReducer(state, toggleDrawer(true));
  assert.equal(state.isDrawerOpen, true);
  state = chatReducer(state, setDrawerOpen(false));
  assert.equal(state.isDrawerOpen, false);
});

test('setActiveModel updates model preference', () => {
  let state = chatReducer(undefined, setActiveModel('gemini-2.5-pro'));
  assert.equal(state.activeModel, 'gemini-2.5-pro');
});

test('setThinkingBudget clamps values within bounds [0, 8192]', () => {
  let state = chatReducer(undefined, setThinkingBudget(4096));
  assert.equal(state.thinkingBudget, 4096);

  // Clamps upper bound
  state = chatReducer(state, setThinkingBudget(99999));
  assert.equal(state.thinkingBudget, 8192);

  // Clamps lower bound
  state = chatReducer(state, setThinkingBudget(-500));
  assert.equal(state.thinkingBudget, 0);
});

test('setLanguage and setSttEngine update correctly', () => {
  let state = chatReducer(undefined, setLanguage('en'));
  assert.equal(state.language, 'en');

  state = chatReducer(state, setSttEngine('gemini-2.5-flash'));
  assert.equal(state.sttEngine, 'gemini-2.5-flash');
});

test('setIsStreaming resets streamingStatus to idle when stopped', () => {
  let state = chatReducer(undefined, setIsStreaming(true));
  assert.equal(state.isStreaming, true);

  state = chatReducer(state, setStreamingStatus('reasoning'));
  assert.equal(state.streamingStatus, 'reasoning');

  state = chatReducer(state, setIsStreaming(false));
  assert.equal(state.isStreaming, false);
  assert.equal(state.streamingStatus, 'idle');
});

test('resetChatUiState clears transient state without touching model preferences', () => {
  let state = chatReducer(undefined, setActiveChatId('chat-999'));
  state = chatReducer(state, setIsStreaming(true));
  state = chatReducer(state, setStreamingStatus('answering'));
  state = chatReducer(state, setActiveModel('gemini-2.5-pro'));

  state = chatReducer(state, resetChatUiState());
  assert.equal(state.activeChatId, null);
  assert.equal(state.isStreaming, false);
  assert.equal(state.streamingStatus, 'idle');
  // Preferences retained
  assert.equal(state.activeModel, 'gemini-2.5-pro');
});

test('Selectors extract correctly from root state', () => {
  const rootState = {
    chat: {
      activeChatId: 'chat-abc',
      isDrawerOpen: true,
      activeModel: 'gemini-2.5-flash',
      thinkingBudget: 2048,
      language: 'am',
      sttEngine: 'addis_ai',
      isStreaming: true,
      streamingStatus: 'reasoning',
    },
  };

  assert.equal(selectActiveChatId(rootState), 'chat-abc');
  assert.equal(selectIsDrawerOpen(rootState), true);
  assert.equal(selectActiveModel(rootState), 'gemini-2.5-flash');
  assert.equal(selectThinkingBudget(rootState), 2048);
  assert.equal(selectLanguage(rootState), 'am');
  assert.equal(selectSttEngine(rootState), 'addis_ai');
  assert.equal(selectIsStreaming(rootState), true);
  assert.equal(selectStreamingStatus(rootState), 'reasoning');
});

test('chatApi endpoints are registered on apiSlice with Chat tag', () => {
  const endpoints = chatApi.endpoints;
  assert.ok(endpoints.getChats, 'getChats endpoint registered');
  assert.ok(endpoints.getChatById, 'getChatById endpoint registered');
  assert.ok(endpoints.transcribeAudio, 'transcribeAudio endpoint registered');
  assert.ok(endpoints.uploadAudio, 'uploadAudio endpoint registered');
  assert.ok(endpoints.uploadAttachments, 'uploadAttachments endpoint registered');
  assert.ok(endpoints.pinChat, 'pinChat endpoint registered');
  assert.ok(endpoints.renameChat, 'renameChat endpoint registered');
  assert.ok(endpoints.updateChatConfig, 'updateChatConfig endpoint registered');
  assert.ok(endpoints.deleteChat, 'deleteChat endpoint registered');
});

console.log(`\n\x1b[32m✔ All ${passedCount}/${totalCount} Task 8.1 tests passed successfully.\x1b[0m\n`);
