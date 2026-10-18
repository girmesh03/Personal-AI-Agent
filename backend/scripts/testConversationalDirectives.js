/**
 * @file backend/scripts/testConversationalDirectives.js
 * @description Authentic Conversational Verification Test Suite for Dynamic Directive Learning,
 * Universal Personal AI Agent Governance, and Pure Turn Invariant (Inquiry 1.4 / Defect 12).
 *
 * Verifies:
 * 1. Unit & Assembly Logic: Block 3 dynamic assembly, zero token waste, zero robotic banners.
 * 2. Pure Turn Invariant: Database purity in chat.messages and unpolluted user dialogue in geminiContents.
 * 3. Live Conversational Stream Integration: Live model adherence to user directives,
 *    strict negative vocabulary prevention, zero synthetic tags, and 100% authentic dialogue.
 */

import http from 'node:http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { User } from '../src/models/User.js';
import { Chat } from '../src/models/Chat.js';
import { assembleSystemPrompt } from '../src/utils/promptAssembler.js';
import { buildGeminiHistory } from '../src/controllers/chatController.js';

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, description) {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passedAssertions++;
  } else {
    console.error(`  [FAIL] ${description}`);
    failedAssertions++;
    throw new Error(`Assertion failed: ${description}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log(' Dynamic Directive Learning & Pure Turn Exhaustive Verification ');
  console.log('================================================================\n');

  // ============================================================================
  // SECTION 1: UNIT & PROMPT ASSEMBLY LOGIC
  // ============================================================================
  console.log('[Section 1] Verifying System Prompt Block 3 Assembly & Banners...');

  const mockUserEmpty = { settings: { directives: {} } };
  const promptEmpty = await assembleSystemPrompt({ user: mockUserEmpty });
  assert(promptEmpty.includes('=== BLOCK 3: SUPERVISOR DIRECTIVES & VOCABULARY STANDARDS ==='), 'Block 3 present in system prompt');
  assert(promptEmpty.includes('FORBIDDEN NEGATIVE VOCABULARY: None currently configured.'), 'Empty negative vocab handled gracefully');
  assert(!promptEmpty.includes('💡 **የመመሪያ ማስታወሻ**'), 'Robotic formulaic banner is strictly absent from system prompt');
  assert(promptEmpty.includes('DYNAMIC USER DIRECTIVE LEARNING & PROACTIVE MEMORY PROTOCOL:'), 'Dynamic Learning Protocol is active in Block 3');

  const mockUserWithDirectives = {
    settings: {
      directives: {
        negativeVocabulary: ['disaster', 'catastrophe'],
        phraseMappings: new Map([['urgent', 'HIGH_PRIORITY']]),
        customInstructions: [
          'ቀን እና ሰዓት ሁልጊዜ በኢትዮጵያ አቆጣጠር (Ethiopian Calendar) ብቻ መጠቀም።',
          'Always address the user with deep respect as "የተከበሩ" (Honorable).',
        ],
      },
    },
  };

  const promptWithDirectives = await assembleSystemPrompt({ user: mockUserWithDirectives });
  assert(promptWithDirectives.includes('disaster') && promptWithDirectives.includes('catastrophe'), 'Negative vocabulary populated in Block 3');
  assert(promptWithDirectives.includes('"urgent" => "HIGH_PRIORITY"'), 'Phrase mappings populated in Block 3');
  assert(promptWithDirectives.includes('CUSTOM USER DIRECTIVES & RULES:'), 'Custom user directives header is present with universal framing');
  assert(promptWithDirectives.includes('ቀን እና ሰዓት ሁልጊዜ በኢትዮጵያ አቆጣጠር'), 'Ethiopian calendar custom instruction rendered in Block 3');
  assert(promptWithDirectives.includes('Always address the user with deep respect as "የተከበሩ"'), 'Respectful address custom instruction rendered in Block 3');
  console.log('         All Section 1 Prompt Assembly Tests Passed.\n');

  // ============================================================================
  // SECTION 2: PURE TURN INVARIANT & DATABASE PURITY
  // ============================================================================
  console.log('[Section 2] Verifying Pure Turn Invariant & Database Purity...');

  const mockChat = {
    messages: [
      { role: 'user', text: 'ሰላም ጤና ይስጥልኝ', audios: [], attachments: [] },
      { role: 'assistant', text: 'ሰላም! እንዴት ልርዳዎት?', toolCalls: [] },
      { role: 'user', text: 'የዛሬውን ፕሮግራም አቅድልኝ', audios: [], attachments: [] },
    ],
  };

  const geminiHistory = await buildGeminiHistory({
    chat: mockChat,
    userTurn: mockChat.messages[2],
    isContinue: false,
    stoppedTurn: null,
  });

  assert(geminiHistory.length === 3, 'geminiContents contains all 3 turns');
  assert(geminiHistory[0].role === 'user', 'Turn 0 is user');
  assert(geminiHistory[0].parts[0].text === 'ሰላም ጤና ይስጥልኝ', 'Turn 0 prompt is 100% pure text without injected headers');
  assert(geminiHistory[2].role === 'user', 'Turn 2 is active user turn');
  assert(geminiHistory[2].parts[0].text === 'የዛሬውን ፕሮግራም አቅድልኝ', 'Active user turn is 100% pure text without injected headers');
  assert(!geminiHistory[2].parts[0].text.includes('[ACTIVE SUPERVISOR DIRECTIVES'), 'Zero artificial bracketed headers in user turn');
  assert(mockChat.messages[2].text === 'የዛሬውን ፕሮግራም አቅድልኝ', 'Database mockChat.messages remain strictly pure');
  console.log('         All Section 2 Pure Turn Invariant Tests Passed.\n');

  // ============================================================================
  // SECTION 3: LIVE CONVERSATIONAL STREAM INTEGRATION TEST
  // ============================================================================
  console.log('[Section 3] Verifying Live Conversational Stream with Directives Enforcement...');

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.warn('  [SKIP] MONGO_URI not set. Skipping live stream integration.');
    return;
  }

  console.log('         Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  const testUser = await User.findOne({});
  if (!testUser) {
    console.warn('  [SKIP] No user found in database. Skipping live stream test.');
    await mongoose.disconnect();
    return;
  }

  // Backup original user directives
  const originalDirectives = {
    negativeVocabulary: [...(testUser.settings?.directives?.negativeVocabulary || [])],
    phraseMappings: testUser.settings?.directives?.phraseMappings
      ? new Map(testUser.settings.directives.phraseMappings)
      : new Map(),
    customInstructions: [...(testUser.settings?.directives?.customInstructions || [])],
  };

  try {
    // Configure authentic workplace test directive
    const testInstruction = 'Always address the supervisor with deep respect as "የተከበሩ" (Honorable) in your response.';
    await User.updateOne(
      { _id: testUser._id },
      {
        $set: {
          'settings.directives.negativeVocabulary': ['catastrophe', 'disaster'],
          'settings.directives.customInstructions': [testInstruction],
        },
      }
    );

    console.log('         Supervisor Directives updated with authentic test directive:');
    console.log(`         Rule: "${testInstruction}"`);
    console.log('         Forbidden Words: ["catastrophe", "disaster"]');

    // Generate JWT token for test user
    const { generateAccessToken } = await import('../src/utils/token.js');
    const token = generateAccessToken(testUser._id);

    // Dispatch prompt to live running Express backend via SSE
    console.log('         Dispatching prompt to live agent via POST /api/v1/chat/stream...');

    const postData = JSON.stringify({
      text: 'ሰላም! ዛሬ ስራ እንዴት ነው? አጭር መልስ ስጠኝ።',
    });

    const liveAgentText = await new Promise((resolve, reject) => {
      let fullAgentText = '';
      const req = http.request(
        'http://localhost:4000/api/v1/chat/stream',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            Authorization: `Bearer ${token}`,
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Server returned HTTP ${res.statusCode}`));
          }

          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
            const lines = buffer.split('\n');
            buffer = lines.pop();

            let eventType = 'message';
            let eventData = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                eventData = line.slice(6).trim();

                if (eventType === 'text') {
                  try {
                    const parsed = JSON.parse(eventData);
                    fullAgentText += parsed.delta || parsed.chunk || parsed.text || '';
                  } catch (_) {
                    fullAgentText += eventData;
                  }
                }
              }
            }
          });

          res.on('end', () => resolve(fullAgentText));
          res.on('error', reject);
        }
      );

      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    console.log(`\n  [Live Agent Response]:\n  "${liveAgentText.trim()}"\n`);

    assert(
      liveAgentText.includes('የተከበሩ'),
      'Live agent strictly obeyed user directive and addressed the user respectfully as "የተከበሩ"'
    );
    assert(
      !liveAgentText.includes('disaster') && !liveAgentText.includes('catastrophe'),
      'Live agent strictly obeyed forbidden negative vocabulary'
    );
    assert(
      !liveAgentText.includes('[DIRECTIVE_ENFORCED') && !liveAgentText.includes('[ACTIVE SUPERVISOR DIRECTIVES'),
      'Live agent response contains ZERO synthetic tags or bracketed directive headers'
    );
    assert(
      !liveAgentText.includes('💡 **የመመሪያ ማስታወሻ**'),
      'Live agent response contains ZERO robotic formulaic confirmation banners'
    );
  } finally {
    // Restore original directives unconditionally
    await User.updateOne(
      { _id: testUser._id },
      {
        $set: {
          'settings.directives.negativeVocabulary': originalDirectives.negativeVocabulary,
          'settings.directives.phraseMappings': originalDirectives.phraseMappings,
          'settings.directives.customInstructions': originalDirectives.customInstructions,
        },
      }
    );
    console.log('         Supervisor original directives restored cleanly in MongoDB.');
  }

  await mongoose.disconnect();
  console.log('\n================================================================');
  console.log(` ALL ${passedAssertions} ASSERTIONS PASSED! AUTHENTIC DIRECTIVE LEARNING 100% VERIFIED!`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\nTest Execution Error:', err);
  process.exit(1);
});
