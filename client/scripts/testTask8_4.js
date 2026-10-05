/**
 * @module scripts/testTask8_4
 * @description Comprehensive unit verification harness for Task 8.4
 * (Multi-Modal Composer Integration, Compact HUD & Model Governance).
 * Validates barrel exports, AudioRecordingHud compact states, icon-only loaders,
 * zero-loss in-memory retry, InferenceSettingsSheet governance & 429 recovery card,
 * and ChatComposerToolbar dual-cluster layout with Send/Stop state machine.
 */

import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import {
  AudioRecordingHud,
  InferenceSettingsSheet,
  ChatComposerToolbar,
} from '../src/components/chat/index.js';
import chatReducer from '../src/redux/features/chatSlice.js';
import { apiSlice } from '../src/redux/app/apiSlice.js';

let passedCount = 0;
let totalCount = 0;

const test = (description, fn) => {
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
};

const createMockStore = (preloadedChatState = {}) => {
  return configureStore({
    reducer: {
      chat: chatReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
    preloadedState: {
      chat: {
        activeChatId: null,
        isDrawerOpen: false,
        activeModel: 'gemini-2.5-flash',
        thinkingBudget: 2048,
        language: 'am',
        sttEngine: 'addis_ai',
        isStreaming: false,
        streamingStatus: 'idle',
        ...preloadedChatState,
      },
    },
  });
};

console.log('\n--- [TASK 8.4 VERIFICATION SUITE] ---\n');

// ==========================================
// Suite 1: Barrel Exports & Module Integrity
// ==========================================
console.log('Suite 1: Barrel Exports & Component Definitions');

test('index.js exports AudioRecordingHud, InferenceSettingsSheet, and ChatComposerToolbar', () => {
  assert.equal(typeof AudioRecordingHud, 'function', 'AudioRecordingHud is exported as a component');
  assert.equal(typeof InferenceSettingsSheet, 'function', 'InferenceSettingsSheet is exported as a component');
  assert.equal(typeof ChatComposerToolbar, 'function', 'ChatComposerToolbar is exported as a component');
});

// ==========================================
// Suite 2: AudioRecordingHud Lifecycle States
// ==========================================
console.log('\nSuite 2: AudioRecordingHud Compact States & Zero-Loss Retry');

test('AudioRecordingHud returns null when idle without active recording, transcription, or cached audio', () => {
  const idleHtml = renderToString(
    React.createElement(AudioRecordingHud, {
      recorder: { isRecording: false, cachedAudioBlob: null },
      isTranscribing: false,
      hasError: false,
    })
  );
  assert.equal(idleHtml, '', 'Returns empty string when inactive');
});

test('AudioRecordingHud renders compact recording HUD with pulsing dot, timer, and discard/accept actions', () => {
  const recordingHtml = renderToString(
    React.createElement(AudioRecordingHud, {
      recorder: {
        isRecording: true,
        formattedDuration: '00:14',
        audioLevel: 0.5,
        cachedAudioBlob: null,
      },
      isTranscribing: false,
      hasError: false,
      onAccept: () => {},
      onDiscard: () => {},
    })
  );

  assert.ok(recordingHtml.includes('00:14'), 'Displays formatted duration mm:ss');
  assert.ok(recordingHtml.includes('aria-label="Discard recording"'), 'Renders accessible discard button');
  assert.ok(recordingHtml.includes('aria-label="Stop and transcribe"'), 'Renders accessible accept/stop button');
  assert.ok(recordingHtml.includes('audioPulse'), 'Contains audio pulse animation for pulsing dot');
});

test('AudioRecordingHud renders icon-only loader during transcription to prevent toolbar wrapping', () => {
  const transcribingHtml = renderToString(
    React.createElement(AudioRecordingHud, {
      recorder: { isRecording: false },
      isTranscribing: true,
      hasError: false,
    })
  );

  assert.ok(transcribingHtml.includes('MuiCircularProgress-root'), 'Renders CircularProgress icon loader');
  assert.ok(transcribingHtml.includes('Transcribing...'), 'Includes transcribing indicator');
});

test('AudioRecordingHud renders zero-loss retry affordance when transcription fails with cached audio', () => {
  const retryHtml = renderToString(
    React.createElement(AudioRecordingHud, {
      recorder: {
        isRecording: false,
        formattedDuration: '01:25',
        cachedAudioBlob: { size: 1024 },
      },
      isTranscribing: false,
      hasError: true,
      onRetry: () => {},
      onDiscard: () => {},
    })
  );

  assert.ok(retryHtml.includes('aria-label="Retry transcription"'), 'Renders accessible retry button');
  assert.ok(retryHtml.includes('aria-label="Discard recorded audio"'), 'Renders accessible discard button for cached audio');
  assert.ok(retryHtml.includes('01:25'), 'Preserves recorded duration for retry');
});

// ==========================================
// Suite 3: InferenceSettingsSheet Governance
// ==========================================
console.log('\nSuite 3: InferenceSettingsSheet Model Governance & 429 Recovery');

test('InferenceSettingsSheet renders Gemini model options, thinking slider, language switcher, and STT options', () => {
  const store = createMockStore();

  const sheetHtml = renderToString(
    React.createElement(
      Provider,
      { store },
      React.createElement(InferenceSettingsSheet, {
        open: true,
        onClose: () => {},
      })
    )
  );

  assert.ok(sheetHtml.includes('Gemini 2.5 Flash'), 'Renders Gemini 2.5 Flash card');
  assert.ok(sheetHtml.includes('Gemini 2.5 Flash-Lite'), 'Renders Gemini 2.5 Flash-Lite card');
  assert.ok(sheetHtml.includes('Gemini 2.5 Pro'), 'Renders Gemini 2.5 Pro card');
  assert.ok(sheetHtml.includes('Thinking Budget'), 'Renders Thinking Budget section');
  assert.ok(sheetHtml.includes('2048 tokens'), 'Renders active budget token count');
  assert.ok(sheetHtml.includes('Synthesis Language'), 'Renders Synthesis Language section');
  assert.ok(sheetHtml.includes('Amharic'), 'Renders Amharic language option');
  assert.ok(sheetHtml.includes('English'), 'Renders English language option');
  assert.ok(sheetHtml.includes('Speech-to-Text Engine'), 'Renders Speech-to-Text Engine section');
  assert.ok(sheetHtml.includes('Addis AI'), 'Renders Addis AI engine option');
});

test('InferenceSettingsSheet renders 429 Quota Exhaustion Alert Card when isQuotaExhausted is true', () => {
  const store = createMockStore();

  const quotaHtml = renderToString(
    React.createElement(
      Provider,
      { store },
      React.createElement(InferenceSettingsSheet, {
        open: true,
        isQuotaExhausted: true,
        onClose: () => {},
        onQuotaRecover: () => {},
      })
    )
  );

  assert.ok(quotaHtml.includes('Quota exhausted on active model'), 'Renders quota exhaustion notice');
  assert.ok(quotaHtml.includes('Switch to Flash-Lite'), 'Renders 1-click fallback button');
});

// ==========================================
// Suite 4: ChatComposerToolbar Dual-Cluster
// ==========================================
console.log('\nSuite 4: ChatComposerToolbar Dual-Cluster Layout & Send/Stop Toggle');

test('ChatComposerToolbar renders Left Cluster (Attach + Model) and Right Cluster (Mic + Send)', () => {
  const store = createMockStore();

  const toolbarHtml = renderToString(
    React.createElement(
      Provider,
      { store },
      React.createElement(ChatComposerToolbar, {
        text: '',
        onTextChange: () => {},
        onSend: () => {},
        onStop: () => {},
        isStreaming: false,
      })
    )
  );

  // Left Cluster
  assert.ok(toolbarHtml.includes('aria-label="Attach files"'), 'Renders attach files button in Left Cluster');
  assert.ok(toolbarHtml.includes('Gemini Flash'), 'Renders model selector in Left Cluster');

  // Right Cluster
  assert.ok(toolbarHtml.includes('aria-label="Voice dictation"'), 'Renders voice dictation mic button in Right Cluster');
  assert.ok(toolbarHtml.includes('aria-label="Send message"'), 'Renders Send button in Right Cluster');
});

test('ChatComposerToolbar Send button is disabled when prompt text and attachments are empty', () => {
  const store = createMockStore();

  const emptyToolbarHtml = renderToString(
    React.createElement(
      Provider,
      { store },
      React.createElement(ChatComposerToolbar, {
        text: '',
        attachments: [],
        isStreaming: false,
      })
    )
  );

  assert.ok(emptyToolbarHtml.includes('disabled'), 'Send button is disabled when draft is empty');
});

test('ChatComposerToolbar morphs Send button into Stop button when isStreaming is true', () => {
  const store = createMockStore();

  const streamingToolbarHtml = renderToString(
    React.createElement(
      Provider,
      { store },
      React.createElement(ChatComposerToolbar, {
        text: 'Review today audits',
        isStreaming: true,
        onStop: () => {},
      })
    )
  );

  assert.ok(streamingToolbarHtml.includes('aria-label="Stop response generation"'), 'SendIcon morphs into Stop button during active stream');
});

test('ChatComposerToolbar renders attachment preview chips with file name and size', () => {
  const store = createMockStore();
  const mockFile = {
    name: 'audit_checklist.pdf',
    size: 2048576,
    type: 'application/pdf',
  };

  const chipsToolbarHtml = renderToString(
    React.createElement(
      Provider,
      { store },
      React.createElement(ChatComposerToolbar, {
        text: '',
        attachments: [mockFile],
        isStreaming: false,
      })
    )
  );

  assert.ok(chipsToolbarHtml.includes('audit_checklist.pdf'), 'Renders attachment file name');
  assert.ok(chipsToolbarHtml.includes('2.0 MB'), 'Renders formatted attachment size in MB');
});

console.log(`\n\x1b[32m✔ All ${passedCount}/${totalCount} Task 8.4 tests passed successfully.\x1b[0m\n`);
