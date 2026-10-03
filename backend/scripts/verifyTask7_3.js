/**
 * @file verifyTask7_3.js
 * @description Comprehensive automated verification suite for Task 7.3:
 * Express-Validator Validation Chains (chatValidation.js & reportValidation.js),
 * Multi-Modal Turn Invariant, Single & Batch File Caps, MIME Whitelists,
 * Security & Tenancy Invariants, Immutable Field Rejections, Time Regex,
 * and Report Subdocument MaxLength Schema Alignments.
 */

import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import {
  CHAT_CONSTANTS,
  AUDIO_CONSTANTS,
  ATTACHMENT_CONSTANTS,
  REPORT_CONSTANTS,
} from '../src/utils/constants.js';
import {
  chatIdValidation,
  sendChatMessageValidation,
  renameChatValidation,
  getChatsValidation,
} from '../src/validations/chatValidation.js';
import {
  reportIdValidation,
  getReportsValidation,
  updateReportValidation,
  createReportValidation,
  validateReportPayload,
} from '../src/validations/reportValidation.js';
import { Report } from '../src/models/Report.js';
import { validate } from '../src/middleware/validate.js';
import { ValidationError } from '../src/errors/CustomError.js';

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

/**
 * Helper to run express-validator chains against a mock request object.
 * @param {Array} validationChain - Express-validator middleware array.
 * @param {Object} req - Mock request object { body, params, query }.
 * @returns {Promise<import('express-validator').Result>}
 */
async function runValidations(validationChain, req) {
  const reqObj = {
    body: req.body || {},
    params: req.params || {},
    query: req.query || {},
    headers: req.headers || {},
  };
  for (const middleware of validationChain) {
    await middleware.run(reqObj);
  }
  return validationResult(reqObj);
}

/**
 * Extracts list of error fields and error messages from an express-validator Result.
 */
function extractErrors(result) {
  return result.array().map((err) => ({
    field: err.path || err.param,
    message: err.msg,
  }));
}

console.log('\n================================================================');
console.log('--- TASK 7.3 VERIFICATION SUITE: EXPRESS-VALIDATOR CHAINS ---');
console.log('================================================================\n');

async function testChatValidations() {
  console.log('1. Testing chatIdValidation...');
  const validMongoId = new mongoose.Types.ObjectId().toHexString();

  let res = await runValidations(chatIdValidation, { params: { chatId: validMongoId } });
  assert(res.isEmpty(), 'chatIdValidation accepts valid 24-character hexadecimal ObjectId');

  res = await runValidations(chatIdValidation, { params: { chatId: 'invalid-id-123' } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'chatId'), 'chatIdValidation rejects malformed ObjectId');

  res = await runValidations(chatIdValidation, { params: { chatId: '123456789012' } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'chatId'), 'chatIdValidation rejects 12-char pseudo-ObjectId via strict Mongoose check');

  res = await runValidations(chatIdValidation, { params: { chatId: 'zzzzzzzzzzzzzzzzzzzzzzzz' } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'chatId'), 'chatIdValidation rejects 24-char non-hex string via strict Mongoose check');

  res = await runValidations(chatIdValidation, { params: {} });
  assert(!res.isEmpty(), 'chatIdValidation rejects missing chatId parameter');

  // --- 2. sendChatMessageValidation ---
  console.log('\n2. Testing sendChatMessageValidation (Multi-Modal Turn & Security Invariants)...');

  // 2a. Multi-modal turn invariant
  res = await runValidations(sendChatMessageValidation, { body: {} });
  assert(!res.isEmpty() && res.array().some((e) => e.msg.includes('at least one input modality')), 'Rejects turn when text, audios, and attachments are all empty/missing');

  res = await runValidations(sendChatMessageValidation, { body: { text: '   ' } });
  assert(!res.isEmpty() && res.array().some((e) => e.msg.includes('at least one input modality')), 'Rejects turn when text is whitespace only and no media provided');

  res = await runValidations(sendChatMessageValidation, { body: { text: 'Hello AI Agent' } });
  assert(res.isEmpty(), 'Accepts valid text-only conversational turn');

  const validAudioId = new mongoose.Types.ObjectId().toHexString();
  res = await runValidations(sendChatMessageValidation, { body: { audios: [validAudioId] } });
  assert(res.isEmpty(), 'Accepts valid audio-only conversational turn');

  const validAttachment = {
    fileName: 'site_photo.jpg',
    path: 'uploads/attachments/site_photo.jpg',
    mimeType: 'image/jpeg',
    size: 2048576,
  };
  res = await runValidations(sendChatMessageValidation, { body: { attachments: [validAttachment] } });
  assert(res.isEmpty(), 'Accepts valid attachment-only conversational turn');

  res = await runValidations(sendChatMessageValidation, {
    body: {
      text: 'Review this photo and audio update',
      audios: [validAudioId],
      attachments: [validAttachment],
    },
  });
  assert(res.isEmpty(), 'Accepts multi-modal combo (text + audio + attachment)');

  // 2b. Boundary limits (text length, media counts, file sizes, MIME whitelist)
  const oversizedText = 'A'.repeat(CHAT_CONSTANTS.MAX_MESSAGE_LENGTH + 1);
  res = await runValidations(sendChatMessageValidation, { body: { text: oversizedText } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'text'), `Rejects text exceeding ${CHAT_CONSTANTS.MAX_MESSAGE_LENGTH} characters`);

  const tooManyAudios = Array(AUDIO_CONSTANTS.MAX_FILES_COUNT + 1).fill(validAudioId);
  res = await runValidations(sendChatMessageValidation, { body: { audios: tooManyAudios } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'audios'), `Rejects audios array exceeding ${AUDIO_CONSTANTS.MAX_FILES_COUNT} files`);

  res = await runValidations(sendChatMessageValidation, { body: { audios: ['not-a-mongo-id'] } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param).startsWith('audios')), 'Rejects invalid ObjectId in audios array');

  const tooManyAttachments = Array(ATTACHMENT_CONSTANTS.MAX_FILES_COUNT + 1).fill(validAttachment);
  res = await runValidations(sendChatMessageValidation, { body: { attachments: tooManyAttachments } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'attachments'), `Rejects attachments array exceeding ${ATTACHMENT_CONSTANTS.MAX_FILES_COUNT} files`);

  const invalidMimeAttachment = {
    fileName: 'payload.exe',
    path: 'uploads/attachments/payload.exe',
    mimeType: 'application/x-msdownload',
    size: 1024,
  };
  res = await runValidations(sendChatMessageValidation, { body: { attachments: [invalidMimeAttachment] } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param).includes('mimeType')), 'Rejects attachment with unauthorized MIME type');

  const oversizedAttachment = {
    fileName: 'giant_doc.pdf',
    path: 'uploads/attachments/giant_doc.pdf',
    mimeType: 'application/pdf',
    size: ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES + 1,
  };
  res = await runValidations(sendChatMessageValidation, { body: { attachments: [oversizedAttachment] } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param).includes('size')), 'Rejects attachment exceeding 25MB single file limit');

  // Batch attachment size cap check (e.g. 3 files of 20MB = 60MB > 50MB)
  const batchOversizedAttachments = [
    { fileName: 'doc1.pdf', path: 'uploads/attachments/doc1.pdf', mimeType: 'application/pdf', size: 20 * 1024 * 1024 },
    { fileName: 'doc2.pdf', path: 'uploads/attachments/doc2.pdf', mimeType: 'application/pdf', size: 20 * 1024 * 1024 },
    { fileName: 'doc3.pdf', path: 'uploads/attachments/doc3.pdf', mimeType: 'application/pdf', size: 20 * 1024 * 1024 },
  ];
  res = await runValidations(sendChatMessageValidation, { body: { attachments: batchOversizedAttachments } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'attachments'), 'Rejects attachment batch exceeding 50MB batch limit');

  // Attachment file extension whitelist check
  const badExtensionAttachment = {
    fileName: 'script.sh',
    path: 'uploads/attachments/script.sh',
    mimeType: 'text/plain',
    size: 512,
  };
  res = await runValidations(sendChatMessageValidation, { body: { attachments: [badExtensionAttachment] } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param).includes('fileName')), 'Rejects attachment with unauthorized file extension (.sh)');

  // Attachment path traversal security check
  const pathTraversalAttachment = {
    fileName: 'report.pdf',
    path: '../../uploads/attachments/report.pdf',
    mimeType: 'application/pdf',
    size: 1024,
  };
  res = await runValidations(sendChatMessageValidation, { body: { attachments: [pathTraversalAttachment] } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param).includes('path')), 'Rejects attachment path containing relative path traversal (..)');

  // 2c. Security Invariants (rejection of injected fields on turn)
  const forbiddenFields = ['role', 'user', '_id', 'status', 'templateType', 'isArchived', 'archivedAt'];
  for (const field of forbiddenFields) {
    const maliciousPayload = { text: 'Normal text', [field]: 'malicious_override' };
    res = await runValidations(sendChatMessageValidation, { body: maliciousPayload });
    assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === field), `Rejects injected forbidden field '${field}' on chat turn`);
  }

  // --- 3. renameChatValidation ---
  console.log('\n3. Testing renameChatValidation...');
  res = await runValidations(renameChatValidation, {
    params: { chatId: validMongoId },
    body: { title: 'Q3 Physical Branch Operations' },
  });
  assert(res.isEmpty(), 'renameChatValidation accepts valid title');

  res = await runValidations(renameChatValidation, {
    params: { chatId: validMongoId },
    body: { title: '   ' },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'title'), 'renameChatValidation rejects empty title');

  res = await runValidations(renameChatValidation, {
    params: { chatId: validMongoId },
    body: { title: 'T'.repeat(CHAT_CONSTANTS.TITLE_MAX_LENGTH + 1) },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'title'), `renameChatValidation rejects title exceeding ${CHAT_CONSTANTS.TITLE_MAX_LENGTH} chars`);

  res = await runValidations(renameChatValidation, {
    params: { chatId: validMongoId },
    body: { title: 'Valid Title', user: validMongoId },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'user'), 'renameChatValidation rejects injected user ownership override');

  // --- 4. getChatsValidation ---
  console.log('\n4. Testing getChatsValidation...');
  res = await runValidations(getChatsValidation, {
    query: { page: '1', limit: '20', archived: 'false', pinned: 'true', search: 'Bole' },
  });
  assert(res.isEmpty(), 'getChatsValidation accepts valid query filters');

  res = await runValidations(getChatsValidation, { query: { page: '0' } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'page'), 'getChatsValidation rejects page < 1');

  res = await runValidations(getChatsValidation, { query: { limit: '150' } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'limit'), 'getChatsValidation rejects limit > 100');

  res = await runValidations(getChatsValidation, { query: { search: 'S'.repeat(101) } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'search'), 'getChatsValidation rejects search exceeding 100 chars');
}

async function testReportValidations() {
  console.log('\n5. Testing reportIdValidation & getReportsValidation...');
  const validReportId = new mongoose.Types.ObjectId().toHexString();
  const validBranchId = new mongoose.Types.ObjectId().toHexString();

  let res = await runValidations(reportIdValidation, { params: { reportId: validReportId } });
  assert(res.isEmpty(), 'reportIdValidation accepts valid 24-character hexadecimal ObjectId');

  res = await runValidations(reportIdValidation, { params: { reportId: 'bad-id' } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'reportId'), 'reportIdValidation rejects invalid ObjectId');

  res = await runValidations(reportIdValidation, { params: { reportId: '123456789012' } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'reportId'), 'reportIdValidation rejects 12-char pseudo-ObjectId via strict Mongoose check');

  res = await runValidations(reportIdValidation, { params: { reportId: 'zzzzzzzzzzzzzzzzzzzzzzzz' } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'reportId'), 'reportIdValidation rejects 24-char non-hex string via strict Mongoose check');

  res = await runValidations(getReportsValidation, {
    query: {
      page: '1',
      limit: '10',
      archived: 'true',
      date: '2026-10-01',
      branch: validBranchId,
      search: 'audit',
    },
  });
  assert(res.isEmpty(), 'getReportsValidation accepts valid query filters');

  res = await runValidations(getReportsValidation, { query: { branch: 'invalid-branch' } });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'branch'), 'getReportsValidation rejects invalid branch ObjectId');

  // --- 6. updateReportValidation ---
  console.log('\n6. Testing updateReportValidation (Manual Edits & Immutable Field Rejections)...');

  // Partial edit: times only
  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: { clockIn: '08:30', clockOut: '17:15' },
  });
  assert(res.isEmpty(), 'updateReportValidation accepts valid partial time update');

  // Partial edit: date update
  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: { date: '2026-10-01' },
  });
  assert(res.isEmpty(), 'updateReportValidation accepts valid past inspection date');

  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: { date: '2030-01-01' },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'date'), 'updateReportValidation rejects future inspection date');

  // Visit empty branch rejection
  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: { visits: [{ branch: '', clockIn: '08:30', clockOut: '12:00' }] },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param).includes('branch')), 'updateReportValidation rejects empty visit branch ID');

  // Invalid time regex
  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: { clockIn: '25:00' },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'clockIn'), 'updateReportValidation rejects invalid hour 25:00');

  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: { clockOut: '08:60' },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'clockOut'), 'updateReportValidation rejects invalid minute 08:60');

  // Subdocument updates: activities, issues, comments, visits
  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: {
      visits: [{ branch: validBranchId, clockIn: '09:00', clockOut: '12:00' }],
      activities: [{ text: 'Verified cash vaults and surveillance systems.', status: 'completed' }],
      issues: [{ text: 'CCTV Camera #3 offline in server corridor.', status: 'reported' }],
      comments: [{ text: 'Follow-up inspection scheduled with IT vendor tomorrow.' }],
    },
  });
  assert(res.isEmpty(), 'updateReportValidation accepts valid structured subdocument edits');

  // Text length bounds
  const oversizedActivity = 'A'.repeat(REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH + 1);
  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: { activities: [{ text: oversizedActivity }] },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param).includes('activities')), `updateReportValidation rejects activity exceeding ${REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH} chars`);

  const oversizedIssue = 'I'.repeat(REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH + 1);
  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: { issues: [{ text: oversizedIssue }] },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param).includes('issues')), `updateReportValidation rejects issue exceeding ${REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH} chars`);

  const oversizedComment = 'C'.repeat(REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH + 1);
  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: { comments: [{ text: oversizedComment }] },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param).includes('comments')), `updateReportValidation rejects comment exceeding ${REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH} chars`);

  // Immutable & Forbidden field rejections on update
  const forbiddenUpdateFields = [
    'user',
    '_id',
    'transcription',
    'audios',
    'isArchived',
    'archivedAt',
    'status',
    'templateType',
  ];
  for (const field of forbiddenUpdateFields) {
    const maliciousPayload = { [field]: 'attempted_override' };
    res = await runValidations(updateReportValidation, {
      params: { reportId: validReportId },
      body: maliciousPayload,
    });
    assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === field), `updateReportValidation rejects immutable field '${field}'`);
  }

  // Rejection of prohibited subdocument fields (e.g. issues category/severity, comments status)
  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: { issues: [{ text: 'Valid text', category: 'Security' }] },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param).includes('category')), 'updateReportValidation rejects prohibited issue.category');

  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: { issues: [{ text: 'Valid text', severity: 'High' }] },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param).includes('severity')), 'updateReportValidation rejects prohibited issue.severity');

  res = await runValidations(updateReportValidation, {
    params: { reportId: validReportId },
    body: { comments: [{ text: 'Valid text', status: 'pending' }] },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param).includes('status')), 'updateReportValidation rejects prohibited comment.status');

  // --- 7. createReportValidation ---
  console.log('\n7. Testing createReportValidation (Tool & Structured Payload Invariants)...');
  const validReportPayload = {
    date: '2026-10-02T08:00:00.000Z',
    clockIn: '08:00',
    clockOut: '17:00',
    visits: [
      {
        branch: validBranchId,
        clockIn: '08:30',
        clockOut: '12:00',
      },
    ],
    activities: [
      {
        text: 'Inspected vault and teller counter.',
        status: 'completed',
      },
    ],
    issues: [
      {
        text: 'Vault lock latch sticking.',
        status: 'reported',
      },
    ],
    comments: [
      {
        text: 'Recommended immediate maintenance.',
      },
    ],
    transcription: 'Audio speech narration covering teller counters and vault inspection.',
  };

  res = await runValidations(createReportValidation, { body: validReportPayload });
  assert(res.isEmpty(), 'createReportValidation accepts valid structured report creation payload');

  // Rejects future date (e.g. 1 year from now)
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  res = await runValidations(createReportValidation, {
    body: { ...validReportPayload, date: futureDate },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'date'), 'createReportValidation rejects future inspection date');

  // Rejects missing required fields
  const requiredFields = ['date', 'clockIn', 'clockOut', 'visits', 'activities', 'transcription'];
  for (const field of requiredFields) {
    const payload = { ...validReportPayload };
    delete payload[field];
    res = await runValidations(createReportValidation, { body: payload });
    assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === field), `createReportValidation rejects missing required field '${field}'`);
  }

  // Rejects empty visits or activities array
  res = await runValidations(createReportValidation, {
    body: { ...validReportPayload, visits: [] },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'visits'), 'createReportValidation rejects empty visits array');

  res = await runValidations(createReportValidation, {
    body: { ...validReportPayload, activities: [] },
  });
  assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === 'activities'), 'createReportValidation rejects empty activities array');

  // Forbidden fields on create
  const forbiddenCreateFields = [
    'status',
    'templateType',
    'isArchived',
    'archivedAt',
    'user',
    '_id',
    'role',
  ];
  for (const field of forbiddenCreateFields) {
    const maliciousPayload = { ...validReportPayload, [field]: 'injected_override' };
    res = await runValidations(createReportValidation, { body: maliciousPayload });
    assert(!res.isEmpty() && res.array().some((e) => (e.path || e.param) === field), `createReportValidation rejects injected field '${field}'`);
  }

  // --- 7b. validateReportPayload (Pure Domain Function for AI Agent Tool Pipeline) ---
  console.log('\n7b. Testing validateReportPayload (Pure In-Memory Object Validator for AI Agent)...');

  // Accepts valid in-memory payload and normalizes fields
  const normalized = validateReportPayload(validReportPayload);
  assert(normalized.date instanceof Date, 'validateReportPayload normalizes date to Date instance');
  assert(normalized.clockIn === '08:00', 'validateReportPayload preserves valid clockIn');
  assert(normalized.clockOut === '17:00', 'validateReportPayload preserves valid clockOut');
  assert(Array.isArray(normalized.visits) && normalized.visits.length === 1, 'validateReportPayload preserves visits');
  assert(Array.isArray(normalized.activities) && normalized.activities.length === 1, 'validateReportPayload preserves activities');
  assert(normalized.transcription === validReportPayload.transcription, 'validateReportPayload preserves transcription');

  // Rejects future date
  try {
    validateReportPayload({ ...validReportPayload, date: futureDate });
    assert(false, 'Expected ValidationError on future date');
  } catch (err) {
    assert(err instanceof ValidationError && err.details.some((d) => d.field === 'date'), 'validateReportPayload rejects future date');
  }

  // Rejects missing required fields
  for (const field of requiredFields) {
    const payload = { ...validReportPayload };
    delete payload[field];
    try {
      validateReportPayload(payload);
      assert(false, `Expected ValidationError on missing ${field}`);
    } catch (err) {
      assert(err instanceof ValidationError && err.details.some((d) => d.field === field), `validateReportPayload rejects missing required field '${field}'`);
    }
  }

  // Rejects empty visits
  try {
    validateReportPayload({ ...validReportPayload, visits: [] });
    assert(false, 'Expected ValidationError on empty visits');
  } catch (err) {
    assert(err instanceof ValidationError && err.details.some((d) => d.field === 'visits'), 'validateReportPayload rejects empty visits array');
  }

  // Rejects empty activities
  try {
    validateReportPayload({ ...validReportPayload, activities: [] });
    assert(false, 'Expected ValidationError on empty activities');
  } catch (err) {
    assert(err instanceof ValidationError && err.details.some((d) => d.field === 'activities'), 'validateReportPayload rejects empty activities array');
  }

  // Rejects prohibited fields
  for (const field of forbiddenCreateFields) {
    const maliciousPayload = { ...validReportPayload, [field]: 'injected_override' };
    try {
      validateReportPayload(maliciousPayload);
      assert(false, `Expected ValidationError on prohibited field ${field}`);
    } catch (err) {
      assert(err instanceof ValidationError && err.details.some((d) => d.field === field), `validateReportPayload rejects injected prohibited field '${field}'`);
    }
  }
}

async function testSchemaMaxlengthIntegrity() {
  console.log('\n8. Testing Mongoose Report Schema MaxLength Alignments...');
  const paths = Report.schema.paths;

  const activityTextPath = Report.schema.path('activities.text') || Report.schema.path('activities')?.schema?.path('text');
  assert(
    activityTextPath?.options?.maxlength?.[0] === REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH,
    `Report.activities.text maxlength aligns with REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH (${REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH})`
  );

  const issueTextPath = Report.schema.path('issues.text') || Report.schema.path('issues')?.schema?.path('text');
  assert(
    issueTextPath?.options?.maxlength?.[0] === REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH,
    `Report.issues.text maxlength aligns with REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH (${REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH})`
  );

  const commentTextPath = Report.schema.path('comments.text') || Report.schema.path('comments')?.schema?.path('text');
  assert(
    commentTextPath?.options?.maxlength?.[0] === REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH,
    `Report.comments.text maxlength aligns with REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH (${REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH})`
  );

  const transcriptionPath = Report.schema.path('transcription');
  assert(
    transcriptionPath?.options?.maxlength?.[0] === REPORT_CONSTANTS.TRANSCRIPTION_MAX_LENGTH,
    `Report.transcription maxlength aligns with REPORT_CONSTANTS.TRANSCRIPTION_MAX_LENGTH (${REPORT_CONSTANTS.TRANSCRIPTION_MAX_LENGTH})`
  );
}

async function testValidateMiddlewareIntegration() {
  console.log('\n9. Testing validate middleware error handling integration...');

  // Mock invalid request through chatIdValidation
  const mockReq = {
    params: { chatId: 'invalid' },
    body: {},
    query: {},
  };
  for (const m of chatIdValidation) {
    await m.run(mockReq);
  }

  let capturedError = null;
  const mockNext = (err) => {
    capturedError = err;
  };

  validate(mockReq, {}, mockNext);

  assert(capturedError instanceof ValidationError, 'validate middleware invokes next with a ValidationError instance');
  assert(capturedError?.statusCode === 422, 'ValidationError status code is 422 Unprocessable Entity');
  assert(Array.isArray(capturedError?.details) && capturedError.details.length > 0, 'ValidationError includes formatted field errors array in details');
  assert(capturedError.details[0].field === 'chatId', 'Error specifies field "chatId"');
}

async function run() {
  try {
    await testChatValidations();
    await testReportValidations();
    await testSchemaMaxlengthIntegrity();
    await testValidateMiddlewareIntegration();

    console.log('\n================================================================');
    console.log(`TASK 7.3 RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('Unhandled exception during Task 7.3 verification:', error);
    process.exit(1);
  }
}

run();
