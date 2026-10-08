/**
 * @file testTask8_8.js
 * @description Unit and contract test suite for Task 8.8: MuiChatAdapter powered by apiSlice.
 * Tests adapter methods: listConversations, listMessages, sendMessage, stop, and SSE stream decoding.
 */

import assert from 'node:assert/strict';
import { MuiChatAdapter } from '../src/adapters/MuiChatAdapter.js';

console.log('🧪 Starting Task 8.8: MuiChatAdapter Test Suite...\n');

let testsPassed = 0;
const runTest = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
};

(async () => {
  // Test 1: Instantiation and active conversation setting
  await runTest('Adapter instantiates cleanly with default settings', () => {
    const adapter = new MuiChatAdapter({
      dispatch: () => {},
      getCurrentUser: () => ({ id: 'usr-1', name: 'Supervisor BB' }),
    });
    assert.ok(adapter, 'Adapter instance exists');
    assert.equal(adapter.currentChatId, null);
    adapter.setActiveChatId('chat-123');
    assert.equal(adapter.currentChatId, 'chat-123');
  });

  // Test 2: listConversations dispatches getChats and formats conversations
  await runTest('listConversations queries RTK Query and formats conversations', async () => {
    let dispatchedAction = null;
    const mockDispatch = (action) => {
      dispatchedAction = action;
      return {
        unwrap: async () => ({
          chats: [
            { _id: 'c-1', title: 'Daily Shift Audit' },
            { _id: 'c-2', title: 'Bole Inspection' },
          ],
          pagination: { hasNextPage: false },
        }),
      };
    };

    const adapter = new MuiChatAdapter({ dispatch: mockDispatch });
    const result = await adapter.listConversations();

    assert.ok(dispatchedAction, 'Action was dispatched');
    assert.equal(result.conversations.length, 2);
    assert.equal(result.conversations[0].id, 'c-1');
    assert.equal(result.conversations[0].title, 'Daily Shift Audit');
    assert.equal(result.conversations[1].id, 'c-2');
    assert.equal(result.conversations[1].title, 'Bole Inspection');
    assert.equal(result.hasMore, false);
  });

  // Test 3: listMessages dispatches getChatById and formats author identities for side-by-side rendering
  await runTest('listMessages maps MongoDB turns to ChatMessage schema with author parity', async () => {
    const mockUser = { id: 'user-supervisor-99', name: 'Branch Supervisor' };
    const mockDispatch = () => ({
      unwrap: async () => ({
        chat: {
          _id: 'chat-abc',
          messages: [
            {
              id: 'm-1',
              role: 'user',
              text: 'Summarize today operations.',
              createdAt: '2026-10-07T05:00:00.000Z',
            },
            {
              id: 'm-2',
              role: 'assistant',
              text: 'All operations nominal.',
              createdAt: '2026-10-07T05:00:05.000Z',
            },
          ],
        },
        hasMore: false,
      }),
    });

    const adapter = new MuiChatAdapter({
      dispatch: mockDispatch,
      getCurrentUser: () => mockUser,
    });

    const result = await adapter.listMessages({ conversationId: 'chat-abc' });

    assert.equal(result.messages.length, 2);

    // User turn assertion: author.id must match currentUser.id for isOwnMessage = true (right alignment)
    const userMsg = result.messages[0];
    assert.equal(userMsg.role, 'user');
    assert.equal(userMsg.author.id, mockUser.id);
    assert.equal(userMsg.author.displayName, mockUser.name);
    assert.equal(userMsg.parts[0].text, 'Summarize today operations.');

    // Assistant turn assertion: author.id must be assistant for left alignment
    const asstMsg = result.messages[1];
    assert.equal(asstMsg.role, 'assistant');
    assert.equal(asstMsg.author.id, 'assistant');
    assert.equal(asstMsg.author.displayName, 'Operon');
    assert.equal(asstMsg.parts[0].text, 'All operations nominal.');
  });

  // Test 4: sendMessage decodes SSE thought, text, and done chunks into ReadableStream<ChatMessageChunk>
  await runTest('sendMessage processes SSE stream into structured ChatMessageChunks', async () => {
    const ssePayload = [
      'event: session\ndata: {"chatId":"session-new-1","title":"New Chat"}\n\n',
      'event: thought\ndata: {"delta":"Evaluating branch data..."}\n\n',
      'event: text\ndata: {"delta":"Branch audits "}\n\n',
      'event: text\ndata: {"delta":"completed successfully."}\n\n',
      'event: title\ndata: {"title":"Audits Completed"}\n\n',
      'event: done\ndata: {"chatId":"session-new-1","messageId":"asst-done-1","title":"Audits Completed"}\n\n',
    ].join('');

    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(encoder.encode(ssePayload));
        ctrl.close();
      },
    });

    // Mock global fetch for SSE stream
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      body: mockStream,
    });

    let sessionCreatedData = null;
    let titleGeneratedData = null;
    let turnCompletedData = null;

    const adapter = new MuiChatAdapter({
      dispatch: () => {},
      getCurrentUser: () => ({ id: 'usr-1', name: 'Supervisor' }),
      onSessionCreated: (data) => {
        sessionCreatedData = data;
      },
      onTitleGenerated: (data) => {
        titleGeneratedData = data;
      },
      onTurnCompleted: (data) => {
        turnCompletedData = data;
      },
    });

    try {
      const stream = await adapter.sendMessage({
        conversationId: null,
        message: { id: 'msg-user-1', parts: [{ type: 'text', text: 'Run audits' }] },
      });

      assert.ok(stream instanceof ReadableStream, 'sendMessage returns a ReadableStream');

      const reader = stream.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Verify chunk sequence
      assert.ok(chunks.length >= 6, 'Received all expected chunks');
      assert.equal(chunks[0].type, 'start');
      assert.equal(chunks[1].type, 'reasoning-start');
      assert.equal(chunks[2].type, 'reasoning-delta');
      assert.equal(chunks[2].delta, 'Evaluating branch data...');
      assert.equal(chunks[3].type, 'reasoning-end');
      assert.equal(chunks[4].type, 'text-start');
      assert.equal(chunks[5].type, 'text-delta');
      assert.equal(chunks[5].delta, 'Branch audits ');
      assert.equal(chunks[6].type, 'text-delta');
      assert.equal(chunks[6].delta, 'completed successfully.');

      const finishChunk = chunks.find((c) => c.type === 'finish');
      assert.ok(finishChunk, 'Received finish chunk');

      // Verify callbacks were invoked
      assert.equal(sessionCreatedData?.chatId, 'session-new-1');
      assert.equal(titleGeneratedData?.title, 'Audits Completed');
      assert.equal(turnCompletedData?.chatId, 'session-new-1');
      assert.equal(adapter.currentChatId, 'session-new-1');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // Test 5: stop() method cancels active stream controller
  await runTest('stop() cancels active stream controller', () => {
    const adapter = new MuiChatAdapter();
    const ac = new AbortController();
    adapter.activeAbortController = ac;
    assert.equal(ac.signal.aborted, false);
    adapter.stop();
    assert.equal(ac.signal.aborted, true);
    assert.equal(adapter.activeAbortController, null);
  });

  console.log(`\n🎉 All ${testsPassed} Task 8.8 tests passed successfully!`);
})();
