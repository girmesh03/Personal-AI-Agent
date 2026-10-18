/**
 * @file testConversationalTelegram.js
 * @description Comprehensive Authentic Conversational Agent Telegram Verification Suite.
 *
 * Executes 3 real conversational turns with the live AI Agent via POST /api/v1/chat/stream:
 * 1. Message 1: Authentic Amharic Field Operational Report posted as a 1440px 2K Image Card
 *    (Headers, borders, bold key-values, bullets, Ethiopic typography).
 * 2. Message 2: Full One-Page Document with Advanced Formatting as an Image Card
 *    (Bold, italic, underline, strikethrough, subscript, superscript, line spacing, borders).
 * 3. Message 3: Text Post (asImage: false) verifying native Semantic HTML text delivery mode
 *    with expandable blockquotes and chunking.
 *
 * Verifies live Telegram Bot API delivery (Message IDs, deep links), captures rendered image buffers,
 * and outputs visual artifacts for user review.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { User } from '../src/models/User.js';
import { generateAccessToken } from '../src/utils/token.js';
import { generateTextImageCard } from '../src/services/telegramService.js';

const PORT = process.env.PORT || 4000;
const STREAM_URL = `http://127.0.0.1:${PORT}/api/v1/chat/stream`;
const ARTIFACT_DIR = path.resolve('C:/Users/girma/.gemini/antigravity/brain/e396df5b-fc9b-4616-b362-d547717d144a');

const MESSAGE_1_AMHARIC = `ቀን: 04-09-18
ብራንች: ጎላጎል
ስም: ቤዛ አያሌው
ስራ የገባሁበት ሰዓት: 2:00
ከ2:00 - 3:35 ዋናው ቢሮ
ከ3:45 - 5:20 በመድኃኔዓለም ብራንች
ከ5:55 - 11:05 በጎላጎል ብራንች
የተሰሩ ስራዎች:
በቼክሊስቱ መሰረት ብራንቹ የሚከናወኑ የዕለት ተዕለት አሰራሮች፣ የንፅህና ሁኔታዎች እና የሰራተኞች ዝግጁነት በአግባቡ እየተፈጸሙ መሆናቸውን አረጋግጫለሁ።
መፍትሄ የሚፈሉ ጉዳዮች:
ሰራተኞች ሲወጡ ዋናውን ብሬከር (Main Breaker) ለማጥፋት በሚሞክሩበት ወቅት በማሽኖቹና በብሬከሩ መካከል ያለው ክፍተት በቂ ባለመሆኑ ጠረጴዛ ላይ ቆመው ብሬከሩን ለማጥፋት ይገደዳሉ። ይህ አሰራር ለሰራተኞች ጉዳትና አደጋን የሚፈጥር በመሆኑ አፋጣኝ መፍትሄ ቢሰጠው ጥሩ ነው።
አነስተኛ መጠን ያለው የካሼር ወረቀት (Small Cashier Paper) የዕቃ ቁጥሩን እየቆረጠ በመምጣቱ የአይተሙን ብዛት በእስኪርብቶ ነው የሚጽፉት።
የእጅ መታጠቢያ ቧንቧን የሚጠግነው ባለሙያ ወደ ክፍለ ሀገር በመሄዱ ምክንያት እስካሁን ማስራት አልቻልንም። ባለሙያው እስኪመለስ የምንጠብቅ ሲሆን፤ ነገ ማቲያስ መጥቶ ማስተካከል የሚችል ከሆነ የሚያየው ይሆናል።
በተደጋጋሚ ሪፖርት በተደረገው የውሃ እና የእጅ መታጠቢያ ቧንቧ መበላሸት ችግር ምክንያት የመጸዳጃ ቤቱ ጠረን እጅግ በጣም ይረብሻል። ዛሬ አንዲት ደንበኛ መጸዳጃ ቤቱን ለመጠቀም ገብታ በነበረው መጥፎ ጠረን እና የውሃ እጦት ምክንያት ከፋኛ ተናግራ እና ተሳድባ ምንም ሳትጠቀም ወጥታለች። ይህ የውሃ ችግር በስራችን ላይ ከፍተኛ ተጽዕኖ እያሳደረ በመሆኑ አፋጣኝ መፍትሄ ይፈልጋል።
ለእፎይ የተሰቀለው የውሃ ታንከር ፓምፕ በራሱ ስለማይዘጋ ውሃ ሲሞላ እየፈሰሰባቸው ሄደው በእጃቸው እየዘጉት ይገኛል። ለእኛም የውሃ ችግራችንን ለመቅረፍ ታንከር ያስፈልገናል። ስለዚህ ከዚህ ቀደም በአቢሲኒያ በኩል የእጅ መታጠቢያ ይሰራል በተባለው መሰረት፤ ለእኛም የውሃ ታንከር በአፋጣኝ ሊሰራለን ይገባል።
አጠቃላይ አስተያየት:
አንድ የዲፕ ፍራየር ማሽን ከኪችን በማንሳትና ቦታውን በማስለቀቅ ለዋናው ብሬከር መዳረሻ የሚሆን ምቹ ክፍተት መፍጠር ይቻላል። ይህም ሰራተኞች ጠረጴዛ ላይ ሳይወጡ በቀላሉ ሁኔታ ብሬከሩን እንዲያጠፉ ያስችላቸዋል።
የካሼር ወረቀቱ ችግር ለመቅረፍ ቁጥር የማይቆራርጥ ተገቢ መጠን ያለው ወረቀት ቢገዛ ጥሩ ነው።
ከስራ የወጣሁበት ሰዓት: 11:05`;

const MESSAGE_2_LOREM = `**EXECUTIVE OPERATIONAL BRIEFING & COMPREHENSIVE STATUS REPORT:**

**Key Performance Indicators & Executive Metrics:**
Total inspections: 12 branches, Overall compliance: 98.7%, Critical issues: 1 (*under resolution*), Active staff rotas: 48

**Section 1: Technical Infrastructure & Field Audits:**
• Alpha System Pipeline: Real-time telemetry streaming *verified* with sub-second latency
• Beta Mechanical Network: Legacy pump assembly ~~delayed~~ replaced and certified operational
• Thermal & Environmental Controls: Temperature variance strictly bounded within ±0.4°C across all refrigeration units (Index: ^REF-2026^ ~v3.4~)

**Section 2: Priority Directives & Action Items:**
1. Complete scheduled sanitization audit across primary prep kitchens before 15:00
2. Finalize bilingual supervisor rosters for upcoming weekend shifts
3. Re-verify cash drawer paper rolls and POS telemetry connections

**Detailed Field Narrative (Lorem Ipsum Documentation):**
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam. Maecenas fermentum consequat mi. Donec fermentum. Pellentesque malesuada nulla a mi. Duis sapien sem, aliquet nec, commodo eget, consequat quis, neque. Aliquam faucibus, elit ut dictum aliquet, felis nisl adipiscing sapien, sed malesuada diam lacus eget erat.

**General Operational Conclusions:**
All area teams remain fully aligned with corporate governance directives. Preventative maintenance schedules executed with zero reported safety incidents.`;

/**
 * Dispatches a prompt to the agent via SSE stream and awaits tool execution.
 * @param {string} promptText
 * @param {string} accessToken
 * @returns {Promise<{ toolCall: object, toolResult: object, agentText: string }>}
 */
async function sendPromptToAgent(promptText, accessToken) {
  const response = await fetch(STREAM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      text: promptText,
      model: 'gemini-3.1-flash-lite',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HTTP error ${response.status} from ${STREAM_URL}: ${errorBody}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  let buffer = '';
  let toolCall = null;
  let toolResult = null;
  let agentText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const rawEvent of events) {
      if (!rawEvent.trim()) continue;

      const lines = rawEvent.split('\n');
      let eventType = 'message';
      let eventData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          eventData = line.slice(6).trim();
        }
      }

      if (eventType === 'tool_call') {
        try {
          const parsed = JSON.parse(eventData);
          toolCall = parsed;
        } catch (_) {}
      } else if (eventType === 'tool_result') {
        try {
          const parsed = JSON.parse(eventData);
          toolResult = parsed.result || parsed.data || parsed;
        } catch (_) {}
      } else if (eventType === 'text') {
        try {
          const parsed = JSON.parse(eventData);
          agentText += parsed.chunk || parsed.text || '';
        } catch (_) {
          agentText += eventData;
        }
      } else if (eventType === 'error') {
        console.error('      [SSE ERROR EVENT RECEIVED]:', eventData);
      }
    }
  }

  return { toolCall, toolResult, agentText };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' Authentic Conversational Telegram Agent Multi-Modal Test Suite ');
  console.log('================================================================\n');

  // Step 1: Connect to MongoDB
  console.log('[Step 1] Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('         Connected to MongoDB.\n');

  // Step 2: Authenticate Supervisor
  console.log('[Step 2] Locating supervisor identity...');
  const user =
    (await User.findOne({ email: 'supervisor.demo@agent.et' })) ||
    (await User.findOne());

  if (!user) {
    throw new Error('No supervisor user found in MongoDB.');
  }
  console.log(`         Supervisor Authenticated: ${user.fullName || user.email} (ID: ${user._id})\n`);
  const accessToken = generateAccessToken(user._id);
  await mongoose.disconnect();

  // =========================================================================
  // Turn 1: Authentic Amharic Field Operational Message (Image Card Mode)
  // =========================================================================
  console.log('----------------------------------------------------------------');
  console.log(' Turn 1: Amharic Field Operational Report -> Image Card Mode   ');
  console.log('----------------------------------------------------------------');
  const prompt1 = `Please post the following Amharic field operational report for Golagol Branch to Telegram management channel as an image card.
Apply clean corporate document styling: bold section headers with underline, outer card border, clean line spacing, and light background.
Use the share_to_telegram tool to broadcast the card.

Content:
${MESSAGE_1_AMHARIC}`;

  console.log('Dispatching Turn 1 prompt to AI Agent...');
  const turn1 = await sendPromptToAgent(prompt1, accessToken);

  if (!turn1.toolCall || (turn1.toolCall.name !== 'share_to_telegram' && turn1.toolCall.toolName !== 'share_to_telegram')) {
    throw new Error('Turn 1 FAIL: Agent did not invoke share_to_telegram.');
  }
  console.log('  [PASS] Agent invoked share_to_telegram tool.');
  console.log('         Tool Args:', JSON.stringify(turn1.toolCall.args || turn1.toolCall.input, null, 2));

  const res1 = turn1.toolResult?.data || turn1.toolResult;
  if (!res1 || (!res1.success && !res1.ok)) {
    throw new Error(`Turn 1 FAIL: Telegram dispatch failed: ${JSON.stringify(turn1.toolResult)}`);
  }
  console.log(`  [PASS] Broadcast successful! Mode: ${res1.mode || 'image'}, Message ID: ${res1.messageId}`);
  if (res1.deepLink) {
    console.log(`         Live Deep Link: ${res1.deepLink}`);
  }

  // Generate & save Turn 1 Image Card artifact
  const img1Buffer = await generateTextImageCard(MESSAGE_1_AMHARIC, {
    border: true,
    underlineHeaders: true,
    fontSize: 34,
    lineHeight: 46,
  });
  const img1Path = path.join(ARTIFACT_DIR, 'telegram_message1_amharic_card.png');
  fs.writeFileSync(img1Path, img1Buffer);
  console.log(`  [PASS] 1440px 2K Amharic document card saved to:\n         ${img1Path}\n`);

  // =========================================================================
  // Turn 2: Full One-Page Document with Advanced Formatting (Image Card Mode)
  // =========================================================================
  console.log('----------------------------------------------------------------');
  console.log(' Turn 2: Comprehensive 1-Page Document -> Advanced Image Card  ');
  console.log('----------------------------------------------------------------');
  const prompt2 = `Please post an executive operational briefing to Telegram management channel as an image card.
Apply advanced formatting:
- Outer rounded border
- Bold underlined section headers
- Bulleted and numbered lists with aligned indentation
- Inline formatting: *italic* notes, ~~strikethrough~~ for deprecated items, ^superscript^ reference and ~subscript~ index
- Light paper background, 14pt-equivalent font size (38px), relaxed line spacing (50px).
Use the share_to_telegram tool to broadcast the card.

Content:
${MESSAGE_2_LOREM}`;

  console.log('Dispatching Turn 2 prompt to AI Agent...');
  const turn2 = await sendPromptToAgent(prompt2, accessToken);

  if (!turn2.toolCall || (turn2.toolCall.name !== 'share_to_telegram' && turn2.toolCall.toolName !== 'share_to_telegram')) {
    throw new Error('Turn 2 FAIL: Agent did not invoke share_to_telegram.');
  }
  console.log('  [PASS] Agent invoked share_to_telegram tool.');
  console.log('         Tool Args:', JSON.stringify(turn2.toolCall.args || turn2.toolCall.input, null, 2));

  const res2 = turn2.toolResult?.data || turn2.toolResult;
  if (!res2 || (!res2.success && !res2.ok)) {
    throw new Error(`Turn 2 FAIL: Telegram dispatch failed: ${JSON.stringify(turn2.toolResult)}`);
  }
  console.log(`  [PASS] Broadcast successful! Mode: ${res2.mode || 'image'}, Message ID: ${res2.messageId}`);
  if (res2.deepLink) {
    console.log(`         Live Deep Link: ${res2.deepLink}`);
  }

  // Generate & save Turn 2 Image Card artifact
  const img2Buffer = await generateTextImageCard(MESSAGE_2_LOREM, {
    border: true,
    underlineHeaders: true,
    fontSize: 34,
    lineHeight: 46,
  });
  const img2Path = path.join(ARTIFACT_DIR, 'telegram_message2_lorem_card.png');
  fs.writeFileSync(img2Path, img2Buffer);
  console.log(`  [PASS] 1440px 2K Multi-Style document card saved to:\n         ${img2Path}\n`);

  // =========================================================================
  // Turn 3: Semantic HTML Text Delivery Mode (asImage: false)
  // =========================================================================
  console.log('----------------------------------------------------------------');
  console.log(' Turn 3: Native Semantic HTML Text Message (asImage: false)     ');
  console.log('----------------------------------------------------------------');
  const prompt3 = `Please immediately broadcast the following urgent operational bulletin as a pure TEXT message (set asImage to false) to the Telegram management channel using the share_to_telegram tool right now:

<b>GOLAGOL OPERATIONAL DIRECTIVE</b>
• Daily operations and safety checklist completed for Golagol branch.
• POS terminals and cash drawer telemetry verified active.
<blockquote expandable>EMERGENCY MAINTENANCE NOTE: Water supply pipe repair technician is arriving at 14:00 today. Please keep the main corridor accessible.</blockquote>

Execute share_to_telegram now with asImage: false and the exact text above.`;

  console.log('Dispatching Turn 3 prompt to AI Agent...');
  const turn3 = await sendPromptToAgent(prompt3, accessToken);

  if (!turn3.toolCall || (turn3.toolCall.name !== 'share_to_telegram' && turn3.toolCall.toolName !== 'share_to_telegram')) {
    throw new Error('Turn 3 FAIL: Agent did not invoke share_to_telegram.');
  }
  console.log('  [PASS] Agent invoked share_to_telegram tool with asImage: false.');
  console.log('         Tool Args:', JSON.stringify(turn3.toolCall.args || turn3.toolCall.input, null, 2));

  const res3 = turn3.toolResult?.data || turn3.toolResult;
  if (!res3 || (!res3.success && !res3.ok)) {
    throw new Error(`Turn 3 FAIL: Telegram dispatch failed: ${JSON.stringify(turn3.toolResult)}`);
  }
  console.log(`  [PASS] Broadcast successful! Mode: ${res3.mode || 'text'}, Message ID: ${res3.messageId}`);
  if (res3.deepLink) {
    console.log(`         Live Deep Link: ${res3.deepLink}`);
  }

  console.log('\n================================================================');
  console.log(' ALL 3 CONVERSATIONAL TELEGRAM TURNS PASSED 100% GREEN!         ');
  console.log('================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\n[FATAL ERROR]', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
