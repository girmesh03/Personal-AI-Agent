/**
 * @file testPhase14DChatPaginationAndGrowth.js
 * @description Comprehensive automated verification test for Phase 14E Point 31:
 * Four-layer chat growth architecture, centralized pagination governance,
 * reverse cursor pagination, deduplication, historical document cache short-circuit,
 * and decoupled agent context integrity.
 */

import mongoose from 'mongoose';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import env from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Chat } from '../src/models/Chat.js';
import { CHAT_PAGINATION as BACKEND_PAGINATION } from '../src/utils/constants.js';
import { buildGeminiHistory } from '../src/controllers/chatController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

async function runTest() {
  console.log('='.repeat(80));
  console.log('PHASE 14E POINT 31: FOUR-LAYER CHAT GROWTH & PAGINATION INTEGRITY TEST');
  console.log('='.repeat(80));

  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB Atlas.');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  const testSuffix = Date.now();
  let testUser = null;
  let testChat = null;

  try {
    testUser = await User.create({
      email: `pagination_test_${testSuffix}@example.com`,
      password: 'Password123!',
      firstName: 'TestPagination',
      lastName: 'Supervisor',
      role: 'supervisor',
    });

    // 1. Verify Centralized Constants Across Backend and Client
    await test('Centralized pagination constants defined and synchronized across backend and client', () => {
      assert.strictEqual(typeof BACKEND_PAGINATION.DEFAULT_MESSAGES_LIMIT, 'number', 'Backend DEFAULT_MESSAGES_LIMIT must be number');
      assert.strictEqual(typeof BACKEND_PAGINATION.MIN_MESSAGES_LIMIT, 'number', 'Backend MIN_MESSAGES_LIMIT must be number');
      assert.strictEqual(typeof BACKEND_PAGINATION.MAX_MESSAGES_LIMIT, 'number', 'Backend MAX_MESSAGES_LIMIT must be number');
      assert.strictEqual(BACKEND_PAGINATION.DEFAULT_MESSAGES_LIMIT, 30, 'Backend default limit must be 30');

      const clientConstantsPath = path.join(ROOT_DIR, 'client/src/utils/constants.js');
      assert.ok(fs.existsSync(clientConstantsPath), 'Client constants.js must exist');
      const clientContent = fs.readFileSync(clientConstantsPath, 'utf8');
      assert.ok(clientContent.includes('MESSAGES_PAGE_SIZE: 30'), 'Client MESSAGES_PAGE_SIZE must be 30');
    });

    // 2. Seed 15 Sequential Conversational Turns
    const messages = [];
    const baseTime = Date.now() - 100000;
    for (let i = 0; i < 15; i++) {
      const isUser = i % 2 === 0;
      messages.push({
        id: `turn-${testSuffix}-${i}`,
        role: isUser ? 'user' : 'assistant',
        text: isUser ? `User prompt turn ${i}` : `Assistant response turn ${i}`,
        thought: isUser ? null : `Reasoning step for turn ${i}`,
        documentTextContext: isUser && i === 2 ? 'Cached document text context from report scan.' : null,
        toolCalls: !isUser && i === 3 ? [{ toolName: 'inspect_branch', args: { branch: 'Bole' } }] : [],
        createdAt: new Date(baseTime + i * 2000),
      });
    }

    testChat = await Chat.create({
      user: testUser._id,
      title: 'Pagination & Growth Test Session',
      messages,
      config: {
        model: 'gemini-3.1-flash-lite',
        thinkingBudget: 2048,
        language: 'am',
      },
    });

    // 3. Initial Reverse Pagination Fetch (limit = 5)
    let batch1 = null;
    let cursor1 = null;
    let hasMore1 = null;
    await test('Initial fetch with limit = 5 returns strictly newest 5 messages with valid cursor', async () => {
      const limit = 5;
      const rawChat = await Chat.findOne({ _id: testChat._id, user: testUser._id, isArchived: false }).select('messages._id');
      const totalMessages = rawChat.messages.length;
      assert.strictEqual(totalMessages, 15, 'Total messages must be 15');

      const startIndex = Math.max(0, totalMessages - limit);
      const count = totalMessages - startIndex;
      assert.strictEqual(startIndex, 10, 'startIndex must be 10');
      assert.strictEqual(count, 5, 'count must be 5');

      const chat = await Chat.findOne({ _id: testChat._id, user: testUser._id, isArchived: false })
        .slice('messages', [startIndex, count]);

      batch1 = chat.messages;
      hasMore1 = startIndex > 0;
      cursor1 = hasMore1 ? String(startIndex) : null;

      assert.strictEqual(batch1.length, 5, 'Batch 1 must contain exactly 5 messages');
      assert.strictEqual(batch1[0].text, 'User prompt turn 10', 'First message of Batch 1 must be turn 10');
      assert.strictEqual(batch1[4].text, 'User prompt turn 14', 'Last message of Batch 1 must be turn 14');
      assert.strictEqual(hasMore1, true, 'hasMore1 must be true');
      assert.strictEqual(cursor1, '10', 'cursor1 must be "10"');
    });

    // 4. Upward Scroll Batch 2 (before = 10, limit = 5)
    let batch2 = null;
    let cursor2 = null;
    let hasMore2 = null;
    await test('Upward scroll with before = 10 and limit = 5 returns previous 5 messages (turns 5..9)', async () => {
      const limit = 5;
      const beforeIdx = parseInt(cursor1, 10);
      const startIndex = Math.max(0, beforeIdx - limit);
      const count = beforeIdx - startIndex;
      assert.strictEqual(startIndex, 5, 'startIndex must be 5');
      assert.strictEqual(count, 5, 'count must be 5');

      const chat = await Chat.findOne({ _id: testChat._id, user: testUser._id, isArchived: false })
        .slice('messages', [startIndex, count]);

      batch2 = chat.messages;
      hasMore2 = startIndex > 0;
      cursor2 = hasMore2 ? String(startIndex) : null;

      assert.strictEqual(batch2.length, 5, 'Batch 2 must contain exactly 5 messages');
      assert.strictEqual(batch2[0].text, 'Assistant response turn 5', 'First message of Batch 2 must be turn 5');
      assert.strictEqual(batch2[4].text, 'Assistant response turn 9', 'Last message of Batch 2 must be turn 9');
      assert.strictEqual(hasMore2, true, 'hasMore2 must be true');
      assert.strictEqual(cursor2, '5', 'cursor2 must be "5"');
    });

    // 5. Upward Scroll Final Batch 3 (before = 5, limit = 5)
    let batch3 = null;
    let cursor3 = null;
    let hasMore3 = null;
    await test('Final upward scroll with before = 5 and limit = 5 returns remaining 5 messages (turns 0..4)', async () => {
      const limit = 5;
      const beforeIdx = parseInt(cursor2, 10);
      const startIndex = Math.max(0, beforeIdx - limit);
      const count = beforeIdx - startIndex;
      assert.strictEqual(startIndex, 0, 'startIndex must be 0');
      assert.strictEqual(count, 5, 'count must be 5');

      const chat = await Chat.findOne({ _id: testChat._id, user: testUser._id, isArchived: false })
        .slice('messages', [startIndex, count]);

      batch3 = chat.messages;
      hasMore3 = startIndex > 0;
      cursor3 = hasMore3 ? String(startIndex) : null;

      assert.strictEqual(batch3.length, 5, 'Batch 3 must contain exactly 5 messages');
      assert.strictEqual(batch3[0].text, 'User prompt turn 0', 'First message of Batch 3 must be turn 0');
      assert.strictEqual(batch3[4].text, 'User prompt turn 4', 'Last message of Batch 3 must be turn 4');
      assert.strictEqual(hasMore3, false, 'hasMore3 must be false because startIndex is 0');
      assert.strictEqual(cursor3, null, 'cursor3 must be null when reached top');
    });

    // 6. Deduplication & Chronological Integrity
    await test('Combined prepended messages preserve strict ascending order with zero duplicate IDs', () => {
      // Re-create the frontend prepend sequence: batch3 + batch2 + batch1
      const combined = [...batch3, ...batch2, ...batch1];
      assert.strictEqual(combined.length, 15, 'Combined messages count must be 15');

      const seenIds = new Set();
      for (let i = 0; i < combined.length; i++) {
        const msg = combined[i];
        assert.ok(!seenIds.has(msg.id), `Duplicate message ID detected: ${msg.id}`);
        seenIds.add(msg.id);

        if (i > 0) {
          const prevTime = new Date(combined[i - 1].createdAt).getTime();
          const currTime = new Date(msg.createdAt).getTime();
          assert.ok(currTime >= prevTime, `Messages out of chronological order at index ${i}`);
        }
      }
      assert.strictEqual(seenIds.size, 15, 'Must contain exactly 15 unique message IDs');
    });

    // 7. Decoupled Context Invariant
    await test('Decoupled Context Invariant: buildGeminiHistory compiles all 15 turns regardless of UI pagination', async () => {
      // Fetch full chat without slicing (the way /api/v1/chat/stream fetches it)
      const fullChat = await Chat.findOne({ _id: testChat._id, user: testUser._id, isArchived: false });
      assert.strictEqual(fullChat.messages.length, 15, 'Full chat must contain all 15 turns');

      const activeUserTurn = fullChat.messages[14];
      const geminiContents = await buildGeminiHistory({
        chat: fullChat,
        userTurn: activeUserTurn,
        isContinue: false,
      });

      assert.strictEqual(geminiContents.length, 15, 'geminiContents must contain all 15 historical turns');
      // Assert alternation invariant: U -> M -> U -> M...
      for (let i = 0; i < geminiContents.length; i++) {
        const expectedRole = i % 2 === 0 ? 'user' : 'model';
        assert.strictEqual(geminiContents[i].role, expectedRole, `Turn ${i} role must be ${expectedRole}`);
      }
    });

    // 8. Historical Document Text Context Cache Short-Circuit
    await test('Historical document text context cache is preserved without redundant processing', async () => {
      const fullChat = await Chat.findOne({ _id: testChat._id, user: testUser._id, isArchived: false });
      const historicalDocTurn = fullChat.messages[2];
      assert.ok(historicalDocTurn.documentTextContext, 'Turn 2 must have documentTextContext');

      const activeUserTurn = fullChat.messages[14];
      const geminiContents = await buildGeminiHistory({
        chat: fullChat,
        userTurn: activeUserTurn,
        isContinue: false,
      });

      const turn2Content = geminiContents[2];
      assert.strictEqual(turn2Content.role, 'user', 'Turn 2 must have user role');
      const textPart = turn2Content.parts.find((p) => p.text && p.text.includes('Cached document text context'));
      assert.ok(textPart, 'Historical turn 2 must contain cached document text section');
    });

    // 9. Point 32 Verification: Sidebar Recent Chats Pagination & Chat.paginate Mechanics
    const extraChats = [];
    try {
      for (let c = 1; c <= 25; c++) {
        extraChats.push({
          user: testUser._id,
          title: `Automated Test Chat ${c}`,
          messages: [],
          isPinned: c === 1,
        });
      }
      await Chat.insertMany(extraChats);

      await test('Chat.paginate with default limit returns Page 1 with hasNextPage=true', async () => {
        const query = { user: testUser._id, isArchived: false };
        const options = {
          page: 1,
          limit: BACKEND_PAGINATION.DEFAULT_RECENT_CHATS_LIMIT,
          sort: { isPinned: -1, updatedAt: -1 },
          select: '_id title isPinned config updatedAt createdAt',
          lean: true,
        };
        const page1Result = await Chat.paginate(query, options);
        // We have 1 initial testChat + 25 extraChats = 26 total chats
        assert.strictEqual(page1Result.docs.length, BACKEND_PAGINATION.DEFAULT_RECENT_CHATS_LIMIT, `Page 1 must contain ${BACKEND_PAGINATION.DEFAULT_RECENT_CHATS_LIMIT} chats`);
        assert.strictEqual(page1Result.hasNextPage, true, 'Page 1 must have hasNextPage=true');
        assert.strictEqual(page1Result.page, 1, 'Page number must be 1');

        // Page 2
        const page2Options = { ...options, page: 2 };
        const page2Result = await Chat.paginate(query, page2Options);
        const remainingExpected = page1Result.totalDocs - BACKEND_PAGINATION.DEFAULT_RECENT_CHATS_LIMIT;
        assert.strictEqual(page2Result.docs.length, remainingExpected, `Page 2 must contain ${remainingExpected} remaining chats`);
        assert.strictEqual(page2Result.hasNextPage, false, 'Page 2 must have hasNextPage=false');
        assert.strictEqual(page2Result.page, 2, 'Page number must be 2');
      });

      await test('Chat.paginate with limit=5 supports fine-grained test paging', async () => {
        const testLimit = 5;
        const query = { user: testUser._id, isArchived: false };
        const options = {
          page: 1,
          limit: testLimit,
          sort: { isPinned: -1, updatedAt: -1 },
          lean: true,
        };
        const res1 = await Chat.paginate(query, options);
        assert.strictEqual(res1.docs.length, 5, 'Page 1 with limit=5 must return 5 chats');
        assert.strictEqual(res1.hasNextPage, true, 'Page 1 must have hasNextPage=true');

        const res2 = await Chat.paginate(query, { ...options, page: 2 });
        assert.strictEqual(res2.docs.length, 5, 'Page 2 with limit=5 must return 5 chats');
        assert.strictEqual(res2.hasNextPage, true, 'Page 2 must have hasNextPage=true');
      });
    } finally {
      await Chat.deleteMany({ user: testUser._id, title: /^Automated Test Chat/ });
    }

    // 10. Point 32 Static Architecture Audit: chatSlice.js and Component Bindings
    await test('Point 32 Static Invariants: chatSlice forwards before, merges getChats, and MuiRecentChat paginates', () => {
      const chatSlicePath = path.join(ROOT_DIR, 'client/src/redux/features/chatSlice.js');
      const chatSliceSrc = fs.readFileSync(chatSlicePath, 'utf8');

      // Assert getChatById forwards before
      assert.ok(chatSliceSrc.includes('before'), 'chatSlice.js getChatById must accept before');
      assert.ok(chatSliceSrc.includes('params: {'), 'chatSlice.js getChatById must construct params');
      assert.ok(chatSliceSrc.includes('before !== undefined'), 'chatSlice.js getChatById must forward before in params');

      // Assert getChats has serializeQueryArgs and merge
      assert.ok(chatSliceSrc.includes('serializeQueryArgs:'), 'chatSlice.js getChats must have serializeQueryArgs');
      assert.ok(chatSliceSrc.includes('merge: (currentCache, newItems'), 'chatSlice.js getChats must have merge function');

      // Assert MuiRecentChat.jsx has pagination
      const recentChatPath = path.join(ROOT_DIR, 'client/src/components/chat/MuiRecentChat.jsx');
      const recentChatSrc = fs.readFileSync(recentChatPath, 'utf8');
      assert.ok(recentChatSrc.includes('onScroll={handleListScroll}'), 'MuiRecentChat.jsx must attach handleListScroll to onScroll');
      assert.ok(recentChatSrc.includes('hasNextPage'), 'MuiRecentChat.jsx must track hasNextPage');
      assert.ok(recentChatSrc.includes('RECENT_CHATS_PAGE_SIZE'), 'MuiRecentChat.jsx must use RECENT_CHATS_PAGE_SIZE');

      // Assert MuiChatMessageListContent.jsx exists and binds to loadMoreHistory
      const msgListContentPath = path.join(ROOT_DIR, 'client/src/components/chat/MuiChatMessageListContent.jsx');
      assert.ok(fs.existsSync(msgListContentPath), 'MuiChatMessageListContent.jsx must exist');
      const msgListContentSrc = fs.readFileSync(msgListContentPath, 'utf8');
      assert.ok(msgListContentSrc.includes('hasMoreHistory'), 'MuiChatMessageListContent.jsx must check hasMoreHistory');
      assert.ok(msgListContentSrc.includes('loadMoreHistory'), 'MuiChatMessageListContent.jsx must invoke loadMoreHistory');
    });

  } finally {
    if (testChat) {
      await Chat.deleteOne({ _id: testChat._id });
    }
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
    }
    await mongoose.disconnect();
    console.log('Test data cleaned up and disconnected.');
  }

  console.log('='.repeat(80));
  console.log(`PHASE 14E POINT 31 RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('='.repeat(80));

  if (passed !== total) {
    process.exit(1);
  }
}

runTest();
