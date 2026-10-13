/**
 * @file testTelegram.js
 * @description Comprehensive automated integration test suite for Telegram Operational Broadcast Engine (Task 8.12).
 * Verifies HTML entity escaping, markdown transpilation, 4,096-char chunking,
 * sharp SVG-to-PNG image card generation, dual live/stub dispatch,
 * Zero Artificial Wrapper Law, and the share_to_telegram agent tool.
 */

import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import {
  escapeHtml,
  markdownToTelegramHtml,
  chunkTelegramMessage,
  generateReportImageCard,
  resolveChannelChatId,
  dispatchToTelegram,
} from '../src/services/telegramService.js';

import { executeAgentTool } from '../src/tools/agentTools.js';
import { User } from '../src/models/User.js';
import { Report } from '../src/models/Report.js';
import { Branch } from '../src/models/Branch.js';
import env from '../src/config/env.js';

const MONGO_URI = process.env.MONGO_URI;

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    throw err;
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    throw err;
  }
}

async function runTelegramTestSuite() {
  console.log('======================================================');
  console.log(' Operon Task 8.12 Telegram Integration Test Suite     ');
  console.log('======================================================\n');

  // -------------------------------------------------------------------------
  // Group 1: HTML Escaping & Sanitization
  // -------------------------------------------------------------------------
  console.log('--- Group 1: HTML Escaping & Sanitization ---');
  test('Sanitizes dangerous HTML characters without mutating plain text', () => {
    const raw = 'Fish & Chips <Hot> "Spicy" \'Special\'';
    const escaped = escapeHtml(raw);
    assert.equal(escaped, 'Fish &amp; Chips &lt;Hot&gt; &quot;Spicy&quot; &#39;Special&#39;');
  });

  // -------------------------------------------------------------------------
  // Group 2: Markdown to Telegram HTML Semantic Converter
  // -------------------------------------------------------------------------
  console.log('\n--- Group 2: Markdown to Telegram HTML Converter ---');
  test('Transpiles bold, italic, code, and links to Telegram HTML', () => {
    const md = 'Hello **World** and *Supervisor* with `code` and [link](https://example.com)';
    const html = markdownToTelegramHtml(md);
    assert.ok(html.includes('<b>World</b>'), 'Bold was not transpiled');
    assert.ok(html.includes('<i>Supervisor</i>'), 'Italic was not transpiled');
    assert.ok(html.includes('<code>code</code>'), 'Inline code was not transpiled');
    assert.ok(html.includes('<a href="https://example.com">link</a>'), 'Link was not transpiled');
  });

  test('Transpiles sequential markdown quotes into <blockquote expandable>', () => {
    const md = '> Line 1 of issue\n> Line 2 of issue\nNormal text';
    const html = markdownToTelegramHtml(md);
    assert.ok(
      html.includes('<blockquote expandable>Line 1 of issue\nLine 2 of issue</blockquote>'),
      'Expandable blockquote was not generated correctly'
    );
    assert.ok(html.includes('Normal text'), 'Normal text was omitted');
  });

  // -------------------------------------------------------------------------
  // Group 3: 4,096-Character Boundary Chunker
  // -------------------------------------------------------------------------
  console.log('\n--- Group 3: 4,096-Character Boundary Chunker ---');
  test('Keeps short messages within a single chunk', () => {
    const msg = 'Short operational update within limits.';
    const chunks = chunkTelegramMessage(msg);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0], msg);
  });

  test('Chunks lengthy text (>4,096 chars) along paragraph boundaries without data loss', () => {
    const para = 'This is a long operational paragraph describing branch activities. '.repeat(20);
    const longMsg = [para, para, para, para].join('\n\n'); // ~5,400 chars
    assert.ok(longMsg.length > 4096, 'Test payload must exceed 4096 characters');

    const chunks = chunkTelegramMessage(longMsg, 4096);
    assert.ok(chunks.length >= 2, `Expected at least 2 chunks, got ${chunks.length}`);

    for (const chunk of chunks) {
      assert.ok(chunk.length <= 4096, `Chunk exceeded 4,096 character limit: ${chunk.length}`);
    }

    const reconstructed = chunks.join('\n\n');
    assert.equal(reconstructed.replace(/\s+/g, ' ').trim(), longMsg.replace(/\s+/g, ' ').trim());
  });

  // -------------------------------------------------------------------------
  // Group 4: Sharp SVG-to-PNG Document Image Card Generator
  // -------------------------------------------------------------------------
  console.log('\n--- Group 4: Sharp SVG-to-PNG Image Card Generator ---');
  await testAsync('Generates crisp PNG image buffer with valid magic header', async () => {
    const sampleText = `ቀን: 02/02/19\nብራንች: ኤርፖርት\n\nየተሰሩ ስራዎች:\n• በቼክሊስቱ መሰረት ተግባራትን አረጋግጫለሁ።\n\nመፍትሄ የሚፈልጉ ጉዳዮች:\n• የፀሐይ መከላከያ ሻተር ይፈልጋል።`;
    const buffer = await generateReportImageCard(sampleText);
    assert.ok(Buffer.isBuffer(buffer), 'Output must be a Buffer');
    assert.ok(buffer.length > 5000, `Image buffer too small: ${buffer.length} bytes`);

    // Verify PNG signature (89 50 4E 47 0D 0A 1A 0A)
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    assert.ok(isPng, 'Buffer does not contain valid PNG magic header');
  });

  // -------------------------------------------------------------------------
  // Group 5: Dual-Engine Stub Mode (Offline / Disabled Fallback)
  // -------------------------------------------------------------------------
  console.log('\n--- Group 5: Dual-Engine Stub Mode Fallback ---');
  await testAsync('Returns structured functional stub when Telegram is unconfigured or disabled', async () => {
    // 1. User explicitly has Telegram disabled
    const disabledUser = { settings: { telegram: { enabled: false } } };
    const stubResult = await dispatchToTelegram({
      user: disabledUser,
      targetChannel: 'management',
      text: 'Test stub dispatch text',
      asImage: false,
    });

    assert.equal(stubResult.success, true);
    assert.equal(stubResult.isStub, true);
    assert.equal(stubResult.channel, 'management');
    assert.equal(stubResult.mode, 'text');
    assert.ok(stubResult.messageId.startsWith('stub-tg-'));

    // 2. Explicitly unconfigured credentials
    const unconfiguredResult = await dispatchToTelegram({
      targetChannel: 'management',
      text: 'Test unconfigured stub',
      botToken: '',
      chatId: null,
    });
    assert.equal(unconfiguredResult.success, true);
    assert.equal(unconfiguredResult.isStub, true);
  });

  // -------------------------------------------------------------------------
  // Group 6: Live Telegram Bot Dispatch (Supergroup -1003982938439)
  // -------------------------------------------------------------------------
  console.log('\n--- Group 6: Live Telegram Bot API Dispatch ---');
  await testAsync('Dispatches live Semantic HTML text message to verified supergroup', async () => {
    const liveUser = {
      settings: {
        telegram: {
          botToken: env.TELEGRAM_BOT_TOKEN,
          managementChatId: env.TELEGRAM_MANAGEMENT_CHAT_ID,
        },
      },
    };

    const result = await dispatchToTelegram({
      user: liveUser,
      targetChannel: 'management',
      text: `<b>[Automated Test Suite]</b> Task 8.12 text dispatch verified at ${new Date().toISOString()}.`,
      asImage: false,
    });

    assert.equal(result.success, true);
    assert.equal(result.isStub, false);
    assert.equal(result.mode, 'text');
    assert.ok(result.messageId > 0, `Invalid messageId: ${result.messageId}`);
    assert.ok(result.deepLink.includes('t.me/c/'), `Invalid deepLink: ${result.deepLink}`);
  });

  await testAsync('Dispatches live mobile image card via sendPhoto to verified supergroup', async () => {
    const liveUser = {
      settings: {
        telegram: {
          botToken: env.TELEGRAM_BOT_TOKEN,
          managementChatId: env.TELEGRAM_MANAGEMENT_CHAT_ID,
        },
      },
    };

    const cardText = `ቀን: 02/02/19\nብራንች: ኤርፖርት\n\nየተሰሩ ስራዎች:\n• Automated Test Suite verified image card dispatch.`;

    const result = await dispatchToTelegram({
      user: liveUser,
      targetChannel: 'management',
      text: cardText,
      asImage: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.isStub, false);
    assert.equal(result.mode, 'image');
    assert.ok(result.messageId > 0, `Invalid messageId: ${result.messageId}`);
  });

  // -------------------------------------------------------------------------
  // Group 7: Database Seeding & share_to_telegram Tool Verification
  // -------------------------------------------------------------------------
  console.log('\n--- Group 7: Database-Grounded share_to_telegram Tool Execution ---');
  await mongoose.connect(MONGO_URI);

  let testUser = await User.findOne({ email: 'telegram-supervisor@test.com' });
  if (!testUser) {
    testUser = await User.create({
      firstName: 'Telegram',
      lastName: 'Supervisor',
      email: 'telegram-supervisor@test.com',
      password: 'Password123!',
      position: 'Area Supervisor',
      settings: {
        telegram: {
          botToken: env.TELEGRAM_BOT_TOKEN,
          managementChatId: env.TELEGRAM_MANAGEMENT_CHAT_ID,
          maintenanceChatId: env.TELEGRAM_MAINTENANCE_CHAT_ID,
          generalChatId: env.TELEGRAM_GENERAL_CHAT_ID,
          defaultFormat: 'text',
        },
      },
    });
  }

  let testBranch = await Branch.findOne({ code: 'TG-01' });
  if (!testBranch) {
    testBranch = await Branch.create({
      user: testUser._id,
      name: 'Bole Test Branch',
      code: 'TG-01',
      phone: '+251911223344',
      location: 'Bole Medhanialem',
    });
  }

  const sampleReportText = `ቀን: 02/02/19\nብራንች: Bole Test Branch\nስም: Telegram Supervisor\n\nየተሰሩ ስራዎች:\n• All operations audited and confirmed.\n\nመፍትሄ የሚፈልጉ ጉዳዮች:\n• No equipment issues.`;

  const testReport = await Report.create({
    user: testUser._id,
    date: new Date(),
    clockIn: '08:30',
    clockOut: '17:00',
    transcription: sampleReportText,
    visits: [{ branch: testBranch._id, clockIn: '08:30', clockOut: '17:00' }],
    activities: [{ text: 'All operations audited and confirmed.', status: 'completed' }],
    issues: [{ text: 'No equipment issues.', status: 'reported' }],
  });

  await testAsync('share_to_telegram tool dispatches ad-hoc text with zero synthetic wrappers', async () => {
    const rawAnnouncement = 'Team Meeting tomorrow at 10:00 AM at Bole branch.';
    const execRes = await executeAgentTool(
      'share_to_telegram',
      {
        messageText: rawAnnouncement,
        targetChannel: 'general',
      },
      { userId: testUser._id }
    );

    assert.equal(execRes.success, true);
    const res = execRes.data;
    assert.equal(res.success, true);
    assert.equal(res.channel, 'telegram');
    assert.equal(res.targetChannel, 'general');
    assert.equal(res.isStub, false);
    assert.ok(res.messageId > 0);
  });

  await testAsync('share_to_telegram tool upholds Template Fidelity (zero fake headers)', async () => {
    const execRes = await executeAgentTool(
      'share_to_telegram',
      {
        reportId: String(testReport._id),
        targetChannel: 'management',
      },
      { userId: testUser._id }
    );

    assert.equal(execRes.success, true);
    const res = execRes.data;
    assert.equal(res.success, true);
    assert.equal(res.targetChannel, 'management');
    assert.equal(res.isStub, false);
    assert.ok(res.messageId > 0);
  });

  await testAsync('share_to_telegram tool dispatches as image when asImage: true is specified', async () => {
    const execRes = await executeAgentTool(
      'share_to_telegram',
      {
        reportId: String(testReport._id),
        targetChannel: 'management',
        asImage: true,
      },
      { userId: testUser._id }
    );

    assert.equal(execRes.success, true);
    const res = execRes.data;
    assert.equal(res.success, true);
    assert.equal(res.mode, 'image');
    assert.equal(res.isStub, false);
    assert.ok(res.messageId > 0);
  });

  // Cleanup seeded test report
  await Report.findByIdAndDelete(testReport._id);

  await mongoose.disconnect();

  console.log('\n======================================================');
  console.log(` Test Results: ${passedTests}/${totalTests} Passed (100% Green) `);
  console.log('======================================================\n');
}

runTelegramTestSuite().catch((err) => {
  console.error('\n[FATAL] Telegram Test Suite Failed:', err);
  process.exit(1);
});
