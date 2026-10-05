/**
 * @module scripts/testTask8_2
 * @description Comprehensive unit mock verification harness for Task 8.2 (OperonChatAdapter).
 * Tests Two-Phase Ingestion, SSE chunk decoding sequence, AbortController cancellation,
 * listMessages mapping, and listConversations pagination.
 */

import assert from 'node:assert/strict';
import { OperonChatAdapter, createOperonChatAdapter } from '../src/adapters/OperonChatAdapter.js';

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

async function asyncTest(description, fn) {
  totalCount += 1;
  try {
    await fn();
    passedCount += 1;
    console.log(`  \x1b[32m✔\x1b[0m ${description}`);
  } catch (err) {
    console.error(`  \x1b[31m✘\x1b[0m ${description}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log('\n--- [TASK 8.2 VERIFICATION SUITE] ---\n');

// ==========================================
// Suite 1: Initialization & Contract
// ==========================================
console.log('Suite 1: Adapter Initialization & Contract');

test('OperonChatAdapter instantiates with default and custom options', () => {
  const defaultAdapter = new OperonChatAdapter();
  assert.ok(defaultAdapter.baseUrl.length > 0);
  assert.equal(typeof defaultAdapter.sendMessage, 'function');
  assert.equal(typeof defaultAdapter.stop, 'function');
  assert.equal(typeof defaultAdapter.listMessages, 'function');
  assert.equal(typeof defaultAdapter.listConversations, 'function');

  const customAdapter = createOperonChatAdapter({
    baseUrl: 'http://test-server:4000/api/v1/',
  });
  assert.equal(customAdapter.baseUrl, 'http://test-server:4000/api/v1');
});

// ==========================================
// Suite 2: SSE Stream Chunk Decoder
// ==========================================
console.log('\nSuite 2: SSE Stream Chunk Decoder');

await asyncTest('Decodes complete SSE sequence (thought -> tool -> text -> done)', async () => {
  let titleReceived = null;
  let sessionCreatedData = null;

  const adapter = new OperonChatAdapter({
    onTitleGenerated: ({ title }) => {
      titleReceived = title;
    },
    onSessionCreated: (data) => {
      sessionCreatedData = data;
    },
  });

  // Simulated SSE payload frames
  const ssePayload = [
    'event: thought\ndata: {"delta":"Analyzing supervisor instructions..."}\n\n',
    'event: tool_call\ndata: {"name":"create_report","args":{"visits":[{"branch":"Bole"}]}}\n\n',
    'event: tool_result\ndata: {"name":"create_report","result":{"reportId":"rep-101","summary":"Bole visit logged"}}\n\n',
    'event: text\ndata: {"delta":"ሪፖርቱ በተሳካ ሁኔታ ተዘጋጅቷል፡"}\n\n',
    'event: text\ndata: {"delta":" • ቦሌ ቅርንጫፍ ተጎብኝቷል።"}\n\n',
    'event: title\ndata: {"title":"Bole Branch Audit Summary"}\n\n',
    'event: done\ndata: {"chatId":"chat-555","messageId":"asst-1","model":"gemini-2.5-flash","usage":{"promptTokens":120,"completionTokens":45}}\n\n',
  ].join('');

  const encoder = new TextEncoder();
  const mockByteStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(ssePayload));
      controller.close();
    },
  });

  const abortController = new AbortController();
  const chunkStream = adapter.createChunkStreamFromSSE(mockByteStream, abortController.signal);
  const reader = chunkStream.getReader();

  const receivedChunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedChunks.push(value);
  }

  // Verify chunk types in sequence
  const types = receivedChunks.map((c) => c.type);
  assert.ok(types.includes('start'), 'Should contain start chunk');
  assert.ok(types.includes('reasoning-start'), 'Should contain reasoning-start');
  assert.ok(types.includes('reasoning-delta'), 'Should contain reasoning-delta');
  assert.ok(types.includes('reasoning-end'), 'Should contain reasoning-end before tool/text');
  assert.ok(types.includes('tool-input-start'), 'Should contain tool-input-start');
  assert.ok(types.includes('tool-input-available'), 'Should contain tool-input-available');
  assert.ok(types.includes('tool-output-available'), 'Should contain tool-output-available');
  assert.ok(types.includes('text-start'), 'Should contain text-start');
  assert.ok(types.includes('text-delta'), 'Should contain text-delta');
  assert.ok(types.includes('text-end'), 'Should contain text-end');
  assert.ok(types.includes('message-metadata'), 'Should contain message-metadata');
  assert.ok(types.includes('finish'), 'Should contain finish chunk');

  // Verify callbacks fired
  assert.equal(titleReceived, 'Bole Branch Audit Summary');
  assert.equal(sessionCreatedData?.chatId, 'chat-555');
  assert.equal(sessionCreatedData?.model, 'gemini-2.5-flash');

  // Verify report metadata extraction
  const metadataChunk = receivedChunks.find((c) => c.type === 'message-metadata');
  assert.ok(metadataChunk?.metadata?.report, 'Report data extracted from tool_result');
  assert.equal(metadataChunk.metadata.report.reportId, 'rep-101');
});

await asyncTest('Handles SSE error frame and aborts stream cleanly', async () => {
  let capturedError = null;
  const adapter = new OperonChatAdapter({
    onError: (err) => {
      capturedError = err;
    },
  });

  const sseErrorPayload = [
    'event: thought\ndata: {"delta":"Thinking..."}\n\n',
    'event: error\ndata: {"message":"Model quota limit reached for gemini-2.5-flash"}\n\n',
  ].join('');

  const encoder = new TextEncoder();
  const mockByteStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseErrorPayload));
      controller.close();
    },
  });

  const chunkStream = adapter.createChunkStreamFromSSE(mockByteStream, new AbortController().signal);
  const reader = chunkStream.getReader();

  const receivedChunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedChunks.push(value);
  }

  const types = receivedChunks.map((c) => c.type);
  assert.ok(types.includes('abort'), 'Stream enqueues abort on error');
  assert.ok(capturedError?.message.includes('Model quota limit reached'));
});

// ==========================================
// Suite 3: Stream Cancellation & Stop
// ==========================================
console.log('\nSuite 3: Stream Cancellation (stop)');

test('stop() triggers AbortController.abort cleanly', () => {
  const adapter = new OperonChatAdapter();
  adapter.activeAbortController = new AbortController();

  let aborted = false;
  adapter.activeAbortController.signal.addEventListener('abort', () => {
    aborted = true;
  });

  adapter.stop();
  assert.equal(aborted, true);
  assert.equal(adapter.activeAbortController, null);
});

// ==========================================
// Suite 4: Two-Phase Ingestion & sendMessage
// ==========================================
console.log('\nSuite 4: Two-Phase Ingestion (sendMessage)');

await asyncTest('sendMessage uploads audio/attachments before streaming JSON', async () => {
  const originalFetch = globalThis.fetch;
  const networkCalls = [];

  // Mock globalThis.fetch
  globalThis.fetch = async (url, opts = {}) => {
    networkCalls.push({ url, method: opts.method, body: opts.body });

    if (url.includes('/chat/upload-audio')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { audios: [{ _id: 'audio-id-123', originalName: 'voice.webm' }] },
        }),
      };
    }

    if (url.includes('/chat/upload-attachments')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            attachments: [
              { fileName: 'audit.pdf', originalName: 'audit.pdf', mimeType: 'application/pdf' },
            ],
          },
        }),
      };
    }

    if (url.includes('/chat/stream')) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode('event: text\ndata: {"delta":"Acknowledged."}\n\n')
          );
          controller.enqueue(
            encoder.encode('event: done\ndata: {"chatId":"chat-new-1"}\n\n')
          );
          controller.close();
        },
      });

      return {
        ok: true,
        body: stream,
      };
    }

    return { ok: false, status: 404 };
  };

  try {
    const adapter = new OperonChatAdapter({ baseUrl: 'http://test-server/api/v1' });

    // Mock dummy File objects
    const fakeAudio = { name: 'voice.webm', type: 'audio/webm', size: 1024 };
    const fakeDoc = { name: 'audit.pdf', type: 'application/pdf', size: 2048 };

    const message = {
      id: 'user-msg-1',
      role: 'user',
      parts: [
        { type: 'text', text: 'Here is today review' },
        { type: 'file', file: fakeAudio },
        { type: 'file', file: fakeDoc },
      ],
      metadata: {
        model: 'gemini-2.5-flash',
        thinkingBudget: 2048,
        language: 'am',
      },
    };

    const chunkStream = await adapter.sendMessage({ message });
    const reader = chunkStream.getReader();

    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // Assert Phase 1 network calls occurred first
    assert.equal(networkCalls.length, 3);
    assert.ok(networkCalls[0].url.includes('/chat/upload-audio'), 'Phase 1.1: Audio uploaded');
    assert.ok(networkCalls[1].url.includes('/chat/upload-attachments'), 'Phase 1.2: Document uploaded');

    // Assert Phase 2 stream call received collected IDs
    assert.ok(networkCalls[2].url.includes('/chat/stream'), 'Phase 2: Stream initiated');
    const sentStreamBody = JSON.parse(networkCalls[2].body);
    assert.deepEqual(sentStreamBody.audios, ['audio-id-123']);
    assert.equal(sentStreamBody.attachments.length, 1);
    assert.equal(sentStreamBody.attachments[0].fileName, 'audit.pdf');
    assert.equal(sentStreamBody.text, 'Here is today review');
    assert.equal(sentStreamBody.model, 'gemini-2.5-flash');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await asyncTest('sendMessage resolves conversationId via resilient multi-tier fallback hierarchy', async () => {
  const originalFetch = globalThis.fetch;
  const targetEndpoints = [];

  globalThis.fetch = async (url) => {
    targetEndpoints.push(url);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: text\ndata: {"delta":"ok"}\n\n'));
        controller.enqueue(encoder.encode('event: done\ndata: {"chatId":"c-1"}\n\n'));
        controller.close();
      },
    });
    return { ok: true, body: stream };
  };

  try {
    const adapter = new OperonChatAdapter({ baseUrl: 'http://test-server/api/v1' });
    const dummyMsg = { id: 'm-1', role: 'user', parts: [{ type: 'text', text: 'test' }] };

    // Case 1: input.conversationId (standard headless contract)
    const s1 = await adapter.sendMessage({ conversationId: 'conv-101', message: dummyMsg });
    await s1.getReader().read();
    assert.ok(targetEndpoints[0].endsWith('/chat/conv-101/stream'), 'Resolves input.conversationId');

    // Case 2: input.chatId (Operon Invariant 2 convention)
    const s2 = await adapter.sendMessage({ chatId: 'chat-202', message: dummyMsg });
    await s2.getReader().read();
    assert.ok(targetEndpoints[1].endsWith('/chat/chat-202/stream'), 'Resolves input.chatId');

    // Case 3: message.conversationId
    const s3 = await adapter.sendMessage({ message: { ...dummyMsg, conversationId: 'conv-303' } });
    await s3.getReader().read();
    assert.ok(targetEndpoints[2].endsWith('/chat/conv-303/stream'), 'Resolves message.conversationId');

    // Case 4: message.chatId
    const s4 = await adapter.sendMessage({ message: { ...dummyMsg, chatId: 'chat-404' } });
    await s4.getReader().read();
    assert.ok(targetEndpoints[3].endsWith('/chat/chat-404/stream'), 'Resolves message.chatId');

    // Case 5: metadata.chatId
    const s5 = await adapter.sendMessage({ metadata: { chatId: 'chat-505' }, message: dummyMsg });
    await s5.getReader().read();
    assert.ok(targetEndpoints[4].endsWith('/chat/chat-505/stream'), 'Resolves metadata.chatId');

    // Case 6: explicit 'new' session boundary
    const s6 = await adapter.sendMessage({ conversationId: 'new', message: dummyMsg });
    await s6.getReader().read();
    assert.ok(targetEndpoints[5].endsWith('/chat/stream'), 'Routes conversationId=new to /chat/stream');

    // Case 7: cold start / omitted conversationId
    const s7 = await adapter.sendMessage({ message: dummyMsg });
    await s7.getReader().read();
    assert.ok(targetEndpoints[6].endsWith('/chat/stream'), 'Routes undefined conversationId to /chat/stream');
  } finally {
    globalThis.fetch = originalFetch;
  }
});


// ==========================================
// Suite 5: listMessages & listConversations
// ==========================================
console.log('\nSuite 5: listMessages & listConversations');

await asyncTest('listMessages maps MongoDB chat turn history accurately', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (url.includes('/chat/chat-777')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            chat: {
              _id: 'chat-777',
              messages: [
                {
                  _id: 'msg-u1',
                  role: 'user',
                  text: 'Check Bole branch status',
                  createdAt: '2026-10-05T01:00:00Z',
                },
                {
                  _id: 'msg-a1',
                  role: 'assistant',
                  thought: 'Querying branches...',
                  text: 'Bole branch is operational.',
                  toolCalls: [
                    {
                      name: 'create_report',
                      args: { visits: [] },
                      result: { reportId: 'rep-777', summary: 'Audit done' },
                    },
                  ],
                  model: 'gemini-2.5-flash',
                  createdAt: '2026-10-05T01:00:05Z',
                },
              ],
            },
          },
        }),
      };
    }
    return { ok: false };
  };

  try {
    const adapter = new OperonChatAdapter();
    const result = await adapter.listMessages({ conversationId: 'chat-777' });

    assert.equal(result.messages.length, 2);
    // User message
    assert.equal(result.messages[0].id, 'msg-u1');
    assert.equal(result.messages[0].role, 'user');
    assert.equal(result.messages[0].parts[0].type, 'text');

    // Assistant message with reasoning, text, and extracted report metadata
    assert.equal(result.messages[1].id, 'msg-a1');
    assert.equal(result.messages[1].role, 'assistant');
    assert.equal(result.messages[1].parts[0].type, 'reasoning');
    assert.equal(result.messages[1].parts[1].type, 'tool');
    assert.equal(result.messages[1].parts[2].type, 'text');
    assert.equal(result.messages[1].metadata?.report?.reportId, 'rep-777');

    // Also verify chatId alias works seamlessly
    const resultByChatId = await adapter.listMessages({ chatId: 'chat-777' });
    assert.equal(resultByChatId.messages.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await asyncTest('listConversations maps session records and computes hasMore pagination', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (url.includes('/chat?page=1')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            chats: [
              {
                _id: 'c-1',
                title: 'Bole Audit',
                isPinned: true,
                updatedAt: '2026-10-05T00:00:00Z',
              },
              {
                _id: 'c-2',
                title: 'Piassa Inventory',
                isPinned: false,
                updatedAt: '2026-10-04T00:00:00Z',
              },
            ],
            pagination: { page: 1, totalPages: 3, total: 60 },
          },
        }),
      };
    }
    return { ok: false };
  };

  try {
    const adapter = new OperonChatAdapter();
    const result = await adapter.listConversations({ cursor: null });

    assert.equal(result.conversations.length, 2);
    assert.equal(result.conversations[0].id, 'c-1');
    assert.equal(result.conversations[0].isPinned, true);
    assert.equal(result.hasMore, true);
    assert.equal(result.cursor, '2');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log(`\n\x1b[32m✔ All ${passedCount}/${totalCount} Task 8.2 tests passed successfully.\x1b[0m\n`);
