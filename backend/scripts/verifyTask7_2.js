/**
 * @file verifyTask7_2.js
 * @description Comprehensive automated verification suite for Task 7.2:
 * Centralized Constants (CHAT_CONSTANTS, AUDIO_CONSTANTS, REPORT_CONSTANTS),
 * Ethiopian Calendar Math, User (SSOT Directives with discrete customInstructions array),
 * Standalone Audio Model (one-way referencing, partial indexes),
 * Chat Model (explicit message modalities, dynamic title, thinkingBudget, partial indexes),
 * and Report Model (embedded subdocuments, Audio ref, derived virtuals, partial indexes).
 */

import mongoose from 'mongoose';
import {
  REPORT_CONSTANTS,
  CHAT_CONSTANTS,
  AUDIO_CONSTANTS,
  ATTACHMENT_CONSTANTS,
  AVATAR_CONSTANTS,
} from '../src/utils/constants.js';
import {
  BASE_SCHEMA_OPTIONS,
  SUBDOCUMENT_SCHEMA_OPTIONS,
  EMBEDDED_SCHEMA_OPTIONS,
} from '../src/config/schemaOptions.js';
import {
  toEthiopianDate,
  toEthiopianDateString,
  toGregorianDate,
} from '../src/utils/ethiopianCalendar.js';
import { User } from '../src/models/User.js';
import { Audio } from '../src/models/Audio.js';
import { Chat } from '../src/models/Chat.js';
import { Report } from '../src/models/Report.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('\n================================================================');
console.log('--- TASK 7.2 VERIFICATION SUITE: FIRST-PRINCIPLES MODELS ---');
console.log('================================================================\n');

// --- 1. Centralized Constants Check ---
console.log('1. Checking Centralized Constants (Direct CHAT_CONSTANTS, AUDIO_CONSTANTS, ATTACHMENT_CONSTANTS, AVATAR_CONSTANTS, REPORT_CONSTANTS)...');
assert(REPORT_CONSTANTS.TIME_REGEX.test('08:30'), 'REPORT_CONSTANTS.TIME_REGEX accepts valid time 08:30');
assert(REPORT_CONSTANTS.TIME_REGEX.test('23:59'), 'REPORT_CONSTANTS.TIME_REGEX accepts valid time 23:59');
assert(!REPORT_CONSTANTS.TIME_REGEX.test('25:00'), 'REPORT_CONSTANTS.TIME_REGEX rejects invalid hour 25:00');
assert(!REPORT_CONSTANTS.TIME_REGEX.test('12:60'), 'REPORT_CONSTANTS.TIME_REGEX rejects invalid minute 12:60');
assert(REPORT_CONSTANTS.DEFAULT_ACTIVITY_STATUS === 'completed', 'DEFAULT_ACTIVITY_STATUS is completed');
assert(REPORT_CONSTANTS.DEFAULT_ISSUE_STATUS === 'reported', 'DEFAULT_ISSUE_STATUS is reported');
assert(REPORT_CONSTANTS.MAX_AUDIO_FILES === 5, 'REPORT_CONSTANTS.MAX_AUDIO_FILES is 5');
assert(REPORT_CONSTANTS.MAX_AUDIO_FILE_SIZE_BYTES === 25 * 1024 * 1024, 'REPORT_CONSTANTS.MAX_AUDIO_FILE_SIZE_BYTES is 25MB');
assert(REPORT_CONSTANTS.MAX_DOCUMENT_FILES === 5, 'REPORT_CONSTANTS.MAX_DOCUMENT_FILES is 5');
assert(REPORT_CONSTANTS.MAX_DOCUMENT_FILE_SIZE_BYTES === 25 * 1024 * 1024, 'REPORT_CONSTANTS.MAX_DOCUMENT_FILE_SIZE_BYTES is 25MB');

assert(CHAT_CONSTANTS.DEFAULT_MODEL === 'gemini-2.5-flash', 'CHAT_CONSTANTS.DEFAULT_MODEL is gemini-2.5-flash');
assert(CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET === 2048, 'CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET is 2048');
assert(CHAT_CONSTANTS.DEFAULT_LANGUAGE === 'am', 'CHAT_CONSTANTS.DEFAULT_LANGUAGE is am');
assert(CHAT_CONSTANTS.DEFAULT_STT_ENGINE === 'addis_ai', 'CHAT_CONSTANTS.DEFAULT_STT_ENGINE is addis_ai');
assert(CHAT_CONSTANTS.ATTACHMENTS === ATTACHMENT_CONSTANTS, 'CHAT_CONSTANTS links to ATTACHMENT_CONSTANTS');
assert(CHAT_CONSTANTS.AUDIO === AUDIO_CONSTANTS, 'CHAT_CONSTANTS links to AUDIO_CONSTANTS');

assert(AUDIO_CONSTANTS.DEFAULT_PURPOSE === 'report_narration', 'AUDIO_CONSTANTS.DEFAULT_PURPOSE is report_narration');
assert(AUDIO_CONSTANTS.DEFAULT_STATUS === 'uploaded', 'AUDIO_CONSTANTS.DEFAULT_STATUS is uploaded');
assert(AUDIO_CONSTANTS.MAX_FILE_SIZE_BYTES === 25 * 1024 * 1024, 'AUDIO_CONSTANTS.MAX_FILE_SIZE_BYTES is 25MB');
assert(AUDIO_CONSTANTS.MAX_BATCH_SIZE_BYTES === 50 * 1024 * 1024, 'AUDIO_CONSTANTS.MAX_BATCH_SIZE_BYTES is 50MB');
assert(AUDIO_CONSTANTS.MAX_FILES_COUNT === 5, 'AUDIO_CONSTANTS.MAX_FILES_COUNT is 5');
assert(AUDIO_CONSTANTS.MIN_DURATION_SECONDS === 1, 'AUDIO_CONSTANTS.MIN_DURATION_SECONDS is 1s');
assert(AUDIO_CONSTANTS.MAX_DURATION_SECONDS === 600, 'AUDIO_CONSTANTS.MAX_DURATION_SECONDS is 600s');
assert(AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.includes('.mp3'), 'AUDIO_CONSTANTS includes .mp3');
assert(AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.includes('.wav'), 'AUDIO_CONSTANTS includes .wav');
assert(AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.includes('.m4a'), 'AUDIO_CONSTANTS includes .m4a');
assert(AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes('audio/mpeg'), 'AUDIO_CONSTANTS includes audio/mpeg');
assert(AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes('audio/wav'), 'AUDIO_CONSTANTS includes audio/wav');

assert(ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES === 25 * 1024 * 1024, 'ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES is 25MB');
assert(ATTACHMENT_CONSTANTS.MAX_BATCH_SIZE_BYTES === 50 * 1024 * 1024, 'ATTACHMENT_CONSTANTS.MAX_BATCH_SIZE_BYTES is 50MB');
assert(ATTACHMENT_CONSTANTS.MAX_FILES_COUNT === 5, 'ATTACHMENT_CONSTANTS.MAX_FILES_COUNT is 5');
assert(ATTACHMENT_CONSTANTS.ALLOWED_IMAGE_MIME_TYPES.includes('image/png'), 'ATTACHMENT_CONSTANTS includes image/png');
assert(ATTACHMENT_CONSTANTS.ALLOWED_IMAGE_MIME_TYPES.includes('image/jpeg'), 'ATTACHMENT_CONSTANTS includes image/jpeg');
assert(ATTACHMENT_CONSTANTS.ALLOWED_DOCUMENT_MIME_TYPES.includes('application/pdf'), 'ATTACHMENT_CONSTANTS includes application/pdf');
assert(ATTACHMENT_CONSTANTS.ALLOWED_DOCUMENT_MIME_TYPES.includes('text/csv'), 'ATTACHMENT_CONSTANTS includes text/csv');
assert(ATTACHMENT_CONSTANTS.ALLOWED_EXTENSIONS.includes('.xlsx'), 'ATTACHMENT_CONSTANTS includes .xlsx');
assert(ATTACHMENT_CONSTANTS.ALLOWED_EXTENSIONS.includes('.docx'), 'ATTACHMENT_CONSTANTS includes .docx');

assert(AVATAR_CONSTANTS.MAX_FILE_SIZE_BYTES === 5 * 1024 * 1024, 'AVATAR_CONSTANTS.MAX_FILE_SIZE_BYTES is 5MB');
assert(AVATAR_CONSTANTS.ALLOWED_EXTENSIONS.includes('.jpg'), 'AVATAR_CONSTANTS includes .jpg');
assert(AVATAR_CONSTANTS.ALLOWED_MIME_TYPES.includes('image/webp'), 'AVATAR_CONSTANTS includes image/webp');

// --- 2. Ethiopian Calendar Math & Formatting ---
console.log('\n2. Checking Ethiopian Calendar Conversion Math & Formatting...');
const ethToday = toEthiopianDate('2026-10-02T12:00:00Z');
assert(ethToday.year === 2019 && ethToday.month === 1 && ethToday.day === 22, '2026-10-02 converts to Meskerem 22, 2019 EC');
const ethStr = toEthiopianDateString('2026-10-02T12:00:00Z');
assert(ethStr === '22-01-19', 'toEthiopianDateString returns DD-MM-YY (22-01-19)');
const ethLeap = toEthiopianDate('2023-09-11T12:00:00Z');
assert(ethLeap.year === 2015 && ethLeap.month === 13 && ethLeap.day === 6, '2023-09-11 converts to Pagume 6, 2015 EC (Leap Year)');
const gregBack = toGregorianDate(2019, 1, 22);
assert(gregBack.getUTCFullYear() === 2026 && gregBack.getUTCMonth() === 9 && gregBack.getUTCDate() === 2, 'toGregorianDate round-trips correctly to 2026-10-02');

// --- 3. User Model Extensions (SSOT for Directives with discrete customInstructions array) ---
console.log('\n3. Checking User Model Settings Extensions (SSOT for Directives)...');
const testUser = new User({
  firstName: 'Abebe',
  lastName: 'Kebede',
  email: 'abebe.kebede@example.com',
  password: 'Password123!',
  position: 'Area Supervisor',
  settings: {
    directives: {
      negativeVocabulary: ['ችግር'],
      phraseMappings: new Map([['ችግር', 'ማሻሻያ የሚያስፈልገው ነጥብ']]),
      customInstructions: ['When I say hub, I mean Bole branch', 'Always greet in formal Amharic'],
    },
  },
});
assert(testUser.settings?.sttEngine === 'addis_ai', 'User.settings.sttEngine defaults to addis_ai');
assert(testUser.settings?.agentConfig?.defaultModel === 'gemini-2.5-flash', 'User.settings.agentConfig.defaultModel defaults to gemini-2.5-flash');
assert(testUser.settings?.agentConfig?.defaultThinkingBudget === 2048, 'User.settings.agentConfig.defaultThinkingBudget defaults to 2048');
assert(testUser.settings?.agentConfig?.defaultLanguage === 'am', 'User.settings.agentConfig.defaultLanguage defaults to am');
assert(Array.isArray(testUser.settings?.directives?.negativeVocabulary), 'User.settings.directives.negativeVocabulary is array');
assert(testUser.settings?.directives?.phraseMappings instanceof Map, 'User.settings.directives.phraseMappings is Map');
assert(Array.isArray(testUser.settings?.directives?.customInstructions), 'User.settings.directives.customInstructions is discrete array');
assert(testUser.settings.directives.customInstructions.length === 2, 'customInstructions stores discrete rules created on the fly');

// --- 4. Standalone Audio Model ---
console.log('\n4. Checking Standalone Audio Model...');
const testAudio = new Audio({
  user: testUser._id,
  fileName: 'audio-uuid-001.mp3',
  originalName: 'morning_inspection_bole.mp3',
  mimeType: 'audio/mpeg',
  size: 2048000,
  path: 'uploads/audio/audio-uuid-001.mp3',
  duration: 75.4,
  purpose: 'report_narration',
  transcription: 'የቦሌ ብራንች የጥዋት ጉብኝት...',
});

assert(testAudio.status === 'uploaded', 'Audio.status defaults to uploaded');
assert(testAudio.sttEngine === null, 'Audio.sttEngine defaults to null (user settings govern preference)');
assert(testAudio.purpose === 'report_narration', 'Audio.purpose is report_narration');
assert(testAudio.path === 'uploads/audio/audio-uuid-001.mp3', 'Audio stores relative storage path');
assert(testAudio.url === '/uploads/audio/audio-uuid-001.mp3', 'Audio derives normalized virtual url');
assert(testAudio.schema.paths.report === undefined, 'Audio has strictly ZERO report foreign key (one-way referencing)');
assert(testAudio.schema.paths.chat === undefined, 'Audio has strictly ZERO chat foreign key (one-way referencing)');

// Test Audio model validations
const invalidMimeAudio = new Audio({
  user: testUser._id,
  fileName: 'test.exe',
  originalName: 'test.exe',
  mimeType: 'application/x-msdownload',
  size: 1000,
  path: 'uploads/audio/test.exe',
});
const audioMimeErr = invalidMimeAudio.validateSync();
assert(audioMimeErr?.errors?.mimeType !== undefined, 'Audio rejects unsupported MIME type');

const oversizedAudio = new Audio({
  user: testUser._id,
  fileName: 'huge.mp3',
  originalName: 'huge.mp3',
  mimeType: 'audio/mpeg',
  size: 30 * 1024 * 1024, // 30MB
  path: 'uploads/audio/huge.mp3',
});
const audioSizeErr = oversizedAudio.validateSync();
assert(audioSizeErr?.errors?.size !== undefined, 'Audio rejects size exceeding 25MB');

const negativeDurationAudio = new Audio({
  user: testUser._id,
  fileName: 'test.mp3',
  originalName: 'test.mp3',
  mimeType: 'audio/mpeg',
  size: 1000,
  path: 'uploads/audio/test.mp3',
  duration: -5,
});
const audioDurationErr = negativeDurationAudio.validateSync();
assert(audioDurationErr?.errors?.duration !== undefined, 'Audio rejects negative duration');

// Verify Audio partial indexes
const audioIndexes = testAudio.schema.indexes();
const activeAudioIndex = audioIndexes.find((idx) => idx[1]?.partialFilterExpression?.isArchived === false);
assert(activeAudioIndex !== undefined, 'Audio schema has partialFilterExpression: { isArchived: false } index');
const archivedAudioIndex = audioIndexes.find((idx) => idx[1]?.partialFilterExpression?.isArchived === true);
assert(archivedAudioIndex !== undefined, 'Audio schema has partialFilterExpression: { isArchived: true } index');
assert(typeof Audio.paginate === 'function', 'Audio model has mongoosePaginate attached');

// --- 5. Chat Model (Explicit Modalities, Dynamic Title, No Directives) ---
console.log('\n5. Checking Chat Model (Explicit Modalities, Dynamic Title, Zero Directives)...');
const testChat = new Chat({
  user: testUser._id,
  // title is omitted to test default null
  messages: [
    {
      id: 'msg-turn-001',
      role: 'user',
      text: 'እባክህ የቦሌን ሪፖርት አዘጋጅ',
      audios: [testAudio._id],
      attachments: [
        {
          fileName: 'inventory.pdf',
          originalName: 'Bole_Inventory.pdf',
          mimeType: 'application/pdf',
          size: 512000,
          path: 'uploads/documents/inventory.pdf',
        },
      ],
    },
    {
      id: 'msg-turn-002',
      role: 'assistant',
      text: 'የቦሌ ብራንች ሪፖርት በሚገባ ተዘጋጅቷል።',
      thought: 'Analyzing audio transcription and generating corporate Amharic format...',
      toolCalls: [{ name: 'format_corporate_report', args: { branch: 'Bole' } }],
    },
  ],
});

assert(testChat.title === null, 'Chat title defaults to null (dynamically generated by agent)');
assert(testChat.isPinned === false, 'Chat.isPinned defaults to false');
assert(testChat.schema.paths.pinnedAt === undefined, 'Chat has strictly ZERO pinnedAt field (redundant)');
assert(testChat.schema.paths.directives === undefined, 'Chat has strictly ZERO directives field (lives on User)');
assert(testChat.config.model === 'gemini-2.5-flash', 'Chat.config.model defaults to gemini-2.5-flash');
assert(testChat.config.thinkingBudget === 2048, 'Chat.config.thinkingBudget defaults to 2048');
assert(testChat.config.temperature === undefined, 'Chat.config.temperature is undefined (no hardcoded temperature)');

// Verify message turn modalities
assert(testChat.messages.length === 2, 'Chat contains 2 linear turns');
assert(testChat.messages[0].text === 'እባክህ የቦሌን ሪፖርት አዘጋጅ', 'User turn text preserved');
assert(testChat.messages[0].audios[0].equals(testAudio._id), 'User turn references Audio ObjectId');
assert(testChat.messages[0].attachments[0].path === 'uploads/documents/inventory.pdf', 'Attachment stores storage path');
assert(testChat.messages[0].attachments[0].url === '/uploads/documents/inventory.pdf', 'Attachment derives virtual url');
assert(testChat.messages[1].text === 'የቦሌ ብራንች ሪፖርት በሚገባ ተዘጋጅቷል።', 'Assistant turn text preserved');
assert(testChat.messages[1].thought.includes('Analyzing audio'), 'Assistant turn stores thought reasoning tokens');
assert(testChat.messages[1].toolCalls.length === 1, 'Assistant turn stores toolCalls');

// Test Chat attachment validation
const invalidMimeChat = new Chat({
  user: testUser._id,
  messages: [
    {
      id: 'turn-err-1',
      role: 'user',
      text: 'test',
      attachments: [
        {
          fileName: 'bad.exe',
          originalName: 'bad.exe',
          mimeType: 'application/x-executable',
          size: 1000,
          path: 'uploads/chat/bad.exe',
        },
      ],
    },
  ],
});
const chatMimeErr = invalidMimeChat.validateSync();
assert(chatMimeErr?.errors?.['messages.0.attachments.0.mimeType'] !== undefined, 'Chat rejects unsupported attachment MIME type');

const oversizedAttachmentChat = new Chat({
  user: testUser._id,
  messages: [
    {
      id: 'turn-err-2',
      role: 'user',
      text: 'test',
      attachments: [
        {
          fileName: 'huge.pdf',
          originalName: 'huge.pdf',
          mimeType: 'application/pdf',
          size: 30 * 1024 * 1024,
          path: 'uploads/chat/huge.pdf',
        },
      ],
    },
  ],
});
const chatSizeErr = oversizedAttachmentChat.validateSync();
assert(chatSizeErr?.errors?.['messages.0.attachments.0.size'] !== undefined, 'Chat rejects attachment exceeding 25MB');

// Test Chat turn limits (max 5 audios, max 5 attachments)
const tooManyAudiosChat = new Chat({
  user: testUser._id,
  messages: [
    {
      id: 'turn-err-3',
      role: 'user',
      text: 'test',
      audios: [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(), // 6th audio
      ],
    },
  ],
});
const tooManyAudiosErr = tooManyAudiosChat.validateSync();
assert(tooManyAudiosErr?.errors?.['messages.0.audios'] !== undefined, 'Chat rejects more than 5 audios per turn');

// Test Chat serialization with SUBDOCUMENT_SCHEMA_OPTIONS & EMBEDDED_SCHEMA_OPTIONS
const chatJson = testChat.toJSON();
assert(chatJson.messages[0].id === 'msg-turn-001', 'SUBDOCUMENT_SCHEMA_OPTIONS preserves client message UUID id in JSON');
assert(chatJson.messages[0].attachments[0].url === '/uploads/documents/inventory.pdf', 'Attachment virtual url rendered in JSON');
assert(chatJson.messages[0].attachments[0].id === undefined, 'Attachment has NO duplicate id alias in JSON');
assert(chatJson.config._id === undefined, 'EMBEDDED_SCHEMA_OPTIONS ensures config has NO _id');
assert(chatJson._id !== undefined, 'Root Chat has _id');
assert(chatJson.id === undefined, 'Root Chat has NO duplicate id alias');

// Verify Chat partial indexes
const chatIndexes = testChat.schema.indexes();
const activeChatIndex = chatIndexes.find((idx) => idx[1]?.partialFilterExpression?.isArchived === false);
assert(activeChatIndex !== undefined, 'Chat schema has partialFilterExpression: { isArchived: false } index');
const archivedChatIndex = chatIndexes.find((idx) => idx[1]?.partialFilterExpression?.isArchived === true);
assert(archivedChatIndex !== undefined, 'Chat schema has partialFilterExpression: { isArchived: true } index');
assert(typeof Chat.paginate === 'function', 'Chat model has mongoosePaginate attached');

// --- 6. Report Model Invariants & Embedded Subdocuments ---
console.log('\n6. Checking Report Model Schema & Invariants...');
const sampleBranchId = new mongoose.Types.ObjectId();
const testReport = new Report({
  user: testUser._id,
  date: new Date('2026-10-02T08:00:00Z'),
  clockIn: '08:30',
  clockOut: '17:30',
  visits: [
    {
      branch: sampleBranchId,
      clockIn: '09:00',
      clockOut: '12:30',
    },
  ],
  transcription: 'የዛሬው የስራ ክንውን ሪፖርት...',
  audios: [testAudio._id],
  activities: [
    { text: 'የወጥ ቤት ንፅህና ተገምግሟል' }, // status should default to 'completed'
  ],
  issues: [
    { text: 'የመጋዘን ማቀዝቀዣ ሙቀት መጠን መጨመር ታይቷል' }, // status should default to 'reported'
  ],
  comments: [
    { text: 'አጠቃላይ የሰራተኞች ተነሳሽነት ጥሩ ነው' }, // status should be null
  ],
});

// Check defaults & subdocuments
assert(testReport.activities[0].status === 'completed', 'Activity status defaults to completed');
assert(testReport.issues[0].status === 'reported', 'Issue status defaults to reported');
assert(testReport.comments[0].status === null, 'Comment status defaults to null');
assert(testReport.audios[0].equals(testAudio._id), 'Report.audios references standalone Audio ObjectId');
assert(testReport.isArchived === false, 'isArchived defaults to false');
assert(testReport.archivedAt === null, 'archivedAt defaults to null');

// Check derived virtuals
assert(testReport.ethiopianDate === '22-01-19', 'Report.ethiopianDate virtual derived as 22-01-19');

// Test populated supervisorName virtual
testReport.user = testUser;
assert(testReport.supervisorName === 'Abebe Kebede', 'Report.supervisorName virtual resolves from user.fullName');

// Invariants: Zero status on report, Zero templateType, Zero category/severity
const reportJson = testReport.toJSON();
assert(reportJson.status === undefined, 'Report has strictly ZERO status field');
assert(reportJson.templateType === undefined, 'Report has strictly ZERO templateType field');
assert(reportJson.category === undefined, 'Report issue has strictly ZERO category field');
assert(reportJson.severity === undefined, 'Report issue has strictly ZERO severity field');
assert(reportJson.visits[0].id === undefined, 'Report visit has NO duplicate id alias');
assert(reportJson.activities[0].id === undefined, 'Report activity has NO duplicate id alias');
assert(reportJson.issues[0].id === undefined, 'Report issue has NO duplicate id alias');
assert(reportJson.comments[0].id === undefined, 'Report comment has NO duplicate id alias');

// Check validation errors on invalid times
const invalidReport = new Report({
  user: testUser._id,
  date: new Date(),
  clockIn: 'bad-time',
  clockOut: '17:30',
  transcription: 'test',
});
const validationError = invalidReport.validateSync();
assert(validationError?.errors?.clockIn !== undefined, 'Report rejects invalid clockIn format');

// Check report audio limit (max 5 audios)
const tooManyAudiosReport = new Report({
  user: testUser._id,
  date: new Date(),
  clockIn: '08:30',
  clockOut: '17:30',
  transcription: 'test',
  audios: [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(), // 6th audio
  ],
});
const reportAudiosErr = tooManyAudiosReport.validateSync();
assert(reportAudiosErr?.errors?.audios !== undefined, 'Report rejects more than 5 audio recordings');

// Verify Report partial indexes
const reportIndexes = testReport.schema.indexes();
const activeReportIndex = reportIndexes.find(
  (idx) => idx[0]?.date === -1 && idx[1]?.partialFilterExpression?.isArchived === false
);
assert(activeReportIndex !== undefined, 'Report schema has partialFilterExpression: { isArchived: false } on date');
const activeBranchIndex = reportIndexes.find(
  (idx) => idx[0]?.['visits.branch'] === 1 && idx[1]?.partialFilterExpression?.isArchived === false
);
assert(activeBranchIndex !== undefined, 'Report schema has partialFilterExpression: { isArchived: false } on visits.branch');
const archivedReportIndex = reportIndexes.find(
  (idx) => idx[0]?.archivedAt === -1 && idx[1]?.partialFilterExpression?.isArchived === true
);
assert(archivedReportIndex !== undefined, 'Report schema has partialFilterExpression: { isArchived: true } on archivedAt');
assert(typeof Report.paginate === 'function', 'Report model has mongoosePaginate attached');

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
