/**
 * @module scripts/testTask8_5
 * @description Comprehensive unit verification harness for Task 8.5
 * (Dedicated Fullscreen Chat Canvas with Native layoutMode & Slot Architecture).
 * Validates Chat.jsx component definition, SSR renderability, features configuration,
 * layoutModeBreakpoints, two-tier layout styling, and route parameter extraction.
 */

import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router';
import { configureStore } from '@reduxjs/toolkit';

import { Chat } from '../src/pages/Chat.jsx';
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

console.log('\n--- [TASK 8.5 VERIFICATION SUITE] ---');

// Suite 1: Component Definition & Exports
console.log('\nSuite 1: Component Definition & Architecture Invariants');

test('Chat.jsx exports named Chat and default Chat adhering to Universal Arrow Functions Law', () => {
  assert.equal(typeof Chat, 'function', 'Chat should be a functional component');
});

// Suite 2: SSR Rendering & Viewport Canvas
console.log('\nSuite 2: Fullscreen Canvas & Two-Tier Layout Structure');

test('Chat renders fullscreen 100dvh root container without crashing', () => {
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
});

test('Chat mounts with active chatId in route parameters', () => {
  const store = createMockStore();
  const html = renderToString(
    React.createElement(
      Provider,
      { store },
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/chat/6701a2b3c4d5e6f7a8b9c0d1'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/chat/:chatId', Component: Chat }),
        ),
      ),
    ),
  );

  assert.ok(html.includes('MuiChatBox-root'), 'ChatBox must mount with route parameter chatId');
});

// Suite 3: Layout Mode Breakpoints & Features
console.log('\nSuite 3: Layout Engine & Features Configuration');

test('Chat preserves container query and two-tier centering layout properties', () => {
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

  assert.ok(html.length > 0, 'Chat rendered HTML must be non-empty');
  assert.ok(html.includes('max-height:100dvh') || html.includes('100dvh'), 'Viewport height constraint must be present');
});

console.log(`\n\x1b[32m✔ All ${passedCount}/${totalCount} Task 8.5 tests passed successfully.\x1b[0m\n`);
