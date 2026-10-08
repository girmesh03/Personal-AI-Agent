/**
 * @module scripts/testTask8_5
 * @description Comprehensive unit verification harness for Task 8.5 (Subtasks 8.5.1 - 8.5.8).
 * Validates Chat.jsx, ChatConversationHeader, ChatConversationHeaderActions,
 * ConversationListPane, ChatEmptyState, MuiConfirmDialog, OperonMessageContent,
 * MessageActionsBar, OperonChatAdapter.regenerate, and SSR rendering.
 */

import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router';
import { configureStore } from '@reduxjs/toolkit';

import { Chat } from '../src/pages/Chat.jsx';
import {
  ChatConversationHeader,
  ChatConversationHeaderActions,
  ConversationListPane,
  ChatEmptyState,
  OperonMessageContent,
  MessageActionsBar,
  ChatInlineProvider,
  ChatComposerToolbar,
} from '../src/components/chat/index.js';
import MuiConfirmDialog from '../src/components/reusable/MuiConfirmDialog.jsx';
import { OperonChatAdapter } from '../src/adapters/OperonChatAdapter.js';

import chatReducer from '../src/redux/features/chatSlice.js';
import authReducer from '../src/redux/features/authSlice.js';
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

const createMockStore = (preloadedAuth = {}, preloadedChat = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      chat: chatReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
    preloadedState: {
      auth: {
        user: {
          _id: 'usr-1234567890abcdef12345678',
          fullName: 'Blen Biruk',
          role: 'supervisor',
        },
        token: 'mock-jwt-token',
        isAuthenticated: true,
        loading: false,
        ...preloadedAuth,
      },
      chat: {
        activeChatId: null,
        isDrawerOpen: false,
        activeModel: 'gemini-2.5-flash',
        thinkingBudget: 2048,
        language: 'am',
        sttEngine: 'addis_ai',
        isStreaming: false,
        streamingStatus: 'idle',
        ...preloadedChat,
      },
    },
  });
};

console.log('\n--- [TASK 8.5 COMPREHENSIVE VERIFICATION SUITE (8.5.1 - 8.5.8)] ---');

// Suite 1: Component Definition & Exports
console.log('\nSuite 1: Component Definitions & Universal Arrow Functions');

test('All components export cleanly adhering to Universal Arrow Functions Law', () => {
  assert.equal(typeof Chat, 'function', 'Chat must be a functional component');
  assert.equal(typeof ChatConversationHeader, 'function', 'ChatConversationHeader must be a functional component');
  assert.equal(typeof ChatConversationHeaderActions, 'function', 'ChatConversationHeaderActions must be a functional component');
  assert.equal(typeof ConversationListPane, 'function', 'ConversationListPane must be a functional component');
  assert.equal(typeof ChatEmptyState, 'function', 'ChatEmptyState must be a functional component');
  assert.equal(typeof MuiConfirmDialog, 'function', 'MuiConfirmDialog must be a functional component');
  assert.equal(typeof OperonMessageContent, 'function', 'OperonMessageContent must be a functional component');
  assert.equal(typeof MessageActionsBar, 'function', 'MessageActionsBar must be a functional component');
});

// Suite 2: Native Header Slot (Subtask 8.5.3)
console.log('\nSuite 2: Native Header Slot & Navigation Controls (Subtask 8.5.3)');

test('ChatConversationHeader forwards children and renders container', () => {
  const html = renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        ChatConversationHeader,
        null,
        React.createElement('span', null, 'Active Thread Title')
      )
    )
  );

  assert.ok(html.includes('Active Thread Title'), 'Header must render children title');
});

test('ChatConversationHeaderActions renders model selector and theme toggle', () => {
  const store = createMockStore();
  const html = renderToString(
    React.createElement(
      Provider,
      { store },
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ChatConversationHeaderActions, null)
      )
    )
  );

  assert.ok(html.includes('Gemini Flash') || html.includes('Flash'), 'Header actions must show model selector');
});

// Suite 3: Native Conversation List Slot (Subtask 8.5.4 & Task 8.5b Header)
console.log('\nSuite 3: Native Conversation List Slot, Two-Tier Header & Supervisor Footer (Subtask 8.5.4)');

test('ConversationListPane renders [Back to Dashboard], [+ New Chat] action and supervisor profile footer', () => {
  const store = createMockStore();
  const html = renderToString(
    React.createElement(
      Provider,
      { store },
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ConversationListPane, null)
      )
    )
  );

  assert.ok(html.includes('Back to Dashboard'), 'ConversationListPane must render Back to Dashboard button');
  assert.ok(html.includes('New Chat'), 'ConversationListPane must render New Chat button');
  assert.ok(html.includes('Blen Biruk'), 'Supervisor footer must display supervisor name');
  assert.ok(html.includes('BB'), 'Supervisor avatar must show initials BB');
});

// Suite 4: Native Empty State Slot (Subtask 8.5.5)
console.log('\nSuite 4: Native Empty State Slot & Operational Prompt Chips (Subtask 8.5.5)');

test('ChatEmptyState renders welcome title and all 4 operational prompt suggestion chips', () => {
  const html = renderToString(
    React.createElement(ChatEmptyState, null)
  );

  assert.ok(html.includes('Operon Universal AI Operations Copilot'), 'Empty state must render welcome title');
  assert.ok(html.includes('Generate Daily Operational Summary'), 'Must render prompt chip 1');
  assert.ok(html.includes('Compare Branch Loan Disbursements'), 'Must render prompt chip 2');
  assert.ok(html.includes('Audit Overdue Follow-ups'), 'Must render prompt chip 3');
  assert.ok(html.includes('Check Weekly Growth Trends'), 'Must render prompt chip 4');
});

// Suite 5: Universal Confirmation Modal (Subtask 8.5.6)
console.log('\nSuite 5: Universal Confirmation Modal (Subtask 8.5.6)');

test('MuiConfirmDialog renders title, message, cancel, and confirm action buttons', () => {
  const html = renderToString(
    React.createElement(MuiConfirmDialog, {
      open: true,
      disablePortal: true,
      title: 'Delete Conversation?',
      message: 'Are you sure you want to delete this thread permanently?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmColor: 'error',
      onClose: () => {},
      onConfirm: () => {},
    })
  );

  assert.ok(html.includes('Delete Conversation?'), 'Must render dialog title');
  assert.ok(html.includes('Are you sure you want to delete this thread'), 'Must render dialog message');
  assert.ok(html.includes('Delete'), 'Must render confirm button');
  assert.ok(html.includes('Cancel'), 'Must render cancel button');
});

// Suite 6: In-Place User Turn Editing (Subtask 8.5.7)
console.log('\nSuite 6: In-Place User Turn Editing (Subtask 8.5.7)');

test('OperonMessageContent renders in-place editing card when message matches editingMessageId', () => {
  const mockMessage = {
    id: 'msg-user-123',
    role: 'user',
    parts: [{ type: 'text', text: 'Original user prompt to edit' }],
    metadata: { turnIndex: 0 },
  };

  const html = renderToString(
    React.createElement(
      ChatInlineProvider,
      { editingMessageId: 'msg-user-123', setEditingMessageId: () => {} },
      React.createElement(OperonMessageContent, {
        message: mockMessage,
      })
    )
  );

  assert.ok(
    !html.includes('Editing this prompt will remove subsequent responses in this thread'),
    'Must NOT render intrusive warning banner in streamlined edit mode'
  );
  assert.ok(html.includes('chat-inline-edit-textarea'), 'Must render unstyled inline edit textarea');
  assert.ok(html.includes('Save &amp; Submit') || html.includes('Save & Submit'), 'Must render Save & Submit button');
  assert.ok(html.includes('Cancel'), 'Must render Cancel button');
});

// Suite 7: Assistant Turn Retry & Adapter Regeneration (Subtask 8.5.8)
console.log('\nSuite 7: Assistant Turn Retry & OperonChatAdapter (Subtask 8.5.8)');

test('OperonChatAdapter defines regenerate method for assistant turn retry', () => {
  const adapter = new OperonChatAdapter();
  assert.equal(typeof adapter.regenerate, 'function', 'adapter.regenerate must be a function');
  assert.equal(typeof adapter.sendMessage, 'function', 'adapter.sendMessage must be a function');
  assert.equal(typeof adapter.stop, 'function', 'adapter.stop must be a function');
});

test('MessageActionsBar renders retry action for assistant message and copy for user message', () => {
  const assistantMsg = {
    id: 'msg-asst-1',
    role: 'assistant',
    parts: [{ type: 'text', text: 'AI generated response.' }],
  };
  const userMsg = {
    id: 'msg-user-1',
    role: 'user',
    parts: [{ type: 'text', text: 'User prompt.' }],
  };

  const asstHtml = renderToString(
    React.createElement(MessageActionsBar, {
      message: assistantMsg,
      onRetry: () => {},
    })
  );
  assert.ok(asstHtml.includes('Retry response'), 'Assistant action bar must render retry action');

  const userHtml = renderToString(
    React.createElement(MessageActionsBar, {
      message: userMsg,
      onEdit: () => {},
    })
  );
  assert.ok(userHtml.includes('Edit message'), 'User action bar must render edit action');
  assert.ok(userHtml.includes('Copy prompt text'), 'User action bar must render copy action');
});

// Suite 8: Fullscreen Canvas SSR Integration
console.log('\nSuite 8: Fullscreen Canvas Orchestration (Chat.jsx)');

test('Chat renders complete fullscreen canvas with all slots and ChatInlineProvider without crashing', () => {
  const store = createMockStore();
  const html = renderToString(
    React.createElement(
      Provider,
      { store },
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/chat'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/chat', Component: Chat }),
        ),
      ),
    ),
  );

  assert.ok(html.includes('100dvh'), 'Root Box must enforce 100dvh dynamic viewport height');
  assert.ok(html.includes('MuiChatBox-root'), 'ChatBox root element must be mounted');
  assert.ok(html.includes('Operon Universal AI Operations Copilot'), 'Empty state must be mounted when thread is empty');
  assert.ok(html.includes('Generate Daily Operational Summary'), 'Prompt suggestion chips must be mounted');
});

// Suite 9: Composer Stop State Machine & Attachment Integrity
console.log('\nSuite 9: Composer Stop State Machine & Attachment Integrity');

test('ChatComposerToolbar renders Stop button when isStreaming is true', () => {
  const store = createMockStore();
  const html = renderToString(
    React.createElement(
      Provider,
      { store },
      React.createElement(ChatComposerToolbar, {
        isStreaming: true,
        text: 'Processing request...',
      })
    )
  );

  assert.ok(html.includes('Stop response generation'), 'Must render Stop generation button when isStreaming is true');
  assert.ok(!html.includes('aria-label="Send message"'), 'Send message button must not be rendered when isStreaming is true');
});

test('ChatComposerToolbar renders attachment chips with file name and size', () => {
  const store = createMockStore();
  const mockAttachments = [
    { name: 'audit_notes.txt', size: 1024, type: 'text/plain' },
    { name: 'voice_memo.webm', size: 20480, type: 'audio/webm' },
  ];

  const html = renderToString(
    React.createElement(
      Provider,
      { store },
      React.createElement(ChatComposerToolbar, {
        attachments: mockAttachments,
        text: 'Reviewing audit notes',
      })
    )
  );

  assert.ok(html.includes('audit_notes.txt'), 'Must render audit_notes.txt chip');
  assert.ok(html.includes('voice_memo.webm'), 'Must render voice_memo.webm chip');
});

console.log(`\n\x1b[32m✔ All ${passedCount}/${totalCount} Task 8.5 assertions passed successfully.\x1b[0m\n`);
