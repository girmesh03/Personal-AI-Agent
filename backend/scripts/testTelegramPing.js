/**
 * @file testTelegramPing.js
 * @description Pre-flight diagnostic utility for Telegram bot health, getMe verification,
 * getUpdates chat discovery, and live ping confirmation.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEST_CHAT_ID = process.env.TELEGRAM_MANAGEMENT_CHAT_ID || process.env.TELEGRAM_GENERAL_CHAT_ID;

if (!BOT_TOKEN) {
  console.error('[ERROR] TELEGRAM_BOT_TOKEN is not defined in backend/.env');
  process.exit(1);
}

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function runPingDiagnostic() {
  console.log('====================================================');
  console.log(' Operon Telegram Diagnostic & Pre-Flight Handshake ');
  console.log('====================================================\n');

  // Step 1: Verify Bot Identity (getMe)
  console.log('[1/4] Verifying bot identity with getMe...');
  const meRes = await fetch(`${TELEGRAM_API_BASE}/getMe`);
  const meData = await meRes.json();
  if (!meData.ok) {
    throw new Error(`getMe failed: ${JSON.stringify(meData)}`);
  }
  console.log(`[OK] Bot Authenticated:`);
  console.log(`     ID:       ${meData.result.id}`);
  console.log(`     Name:     ${meData.result.first_name}`);
  console.log(`     Username: @${meData.result.username}\n`);

  // Step 2: Poll Updates (getUpdates) for Chat Discovery
  console.log('[2/4] Checking recent updates with getUpdates...');
  const updatesRes = await fetch(`${TELEGRAM_API_BASE}/getUpdates?limit=10`);
  const updatesData = await updatesRes.json();
  let discoveredChat = null;

  if (updatesData.ok && Array.isArray(updatesData.result)) {
    console.log(`[OK] Retrieved ${updatesData.result.length} update(s).`);
    for (const update of updatesData.result) {
      const msg = update.message || update.edited_message || update.channel_post;
      if (msg && msg.chat) {
        console.log(`     - Update ${update.update_id}: Chat "${msg.chat.title || msg.chat.username}" (ID: ${msg.chat.id}, Type: ${msg.chat.type})`);
        if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
          discoveredChat = msg.chat;
        }
      }
    }
  }

  // Step 3: Determine Target Chat ID
  const targetChatId = DEST_CHAT_ID || (discoveredChat ? discoveredChat.id : null);
  console.log('\n[3/4] Resolving target chat ID...');
  if (!targetChatId) {
    console.warn('[WARN] No target chat ID found in .env or recent updates.');
    console.warn('       Please add the bot to a group and send a message, then re-run this script.');
    return;
  }
  console.log(`[OK] Target Chat ID: ${targetChatId}`);

  // Step 4: Dispatch Verification Ping
  console.log('\n[4/4] Sending live verification ping message...');
  const pingPayload = {
    chat_id: targetChatId,
    text: `<b>Operon Personal AI Agent</b>: Diagnostic ping successful!\nOperational dispatch pipeline is active and verified.`,
    parse_mode: 'HTML',
  };

  const sendRes = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pingPayload),
  });
  const sendData = await sendRes.json();

  if (!sendData.ok) {
    throw new Error(`sendMessage ping failed: ${JSON.stringify(sendData)}`);
  }

  console.log(`[OK] Ping dispatched successfully!`);
  console.log(`     Message ID: ${sendData.result.message_id}`);
  console.log(`     Delivered to: ${sendData.result.chat.title || sendData.result.chat.id}`);
  console.log('\n[COMPLETE] Telegram Pre-Flight Check Passed 100% Green.');
}

runPingDiagnostic().catch((err) => {
  console.error('\n[FATAL] Telegram Diagnostic Failed:', err.message);
  process.exit(1);
});
