/**
 * @module scripts/testReports
 * @description Dedicated automated HTTP integration test suite exercising the Corporate Operational
 * Reports resource, Audio ingestion, Subdocument queries, Soft Archival, Restoration,
 * Permanent Hard Deletion, and the Two-Pass Sweeper background engine like Postman.
 *
 * Scenarios:
 * 1. Server health and route registration (GET /api/v1/health).
 * 2. Evidentiary audio upload (POST /api/v1/reports/upload-audio) with canonical Audio documents.
 * 3. Audio upload boundary enforcement (MIME types, batch constraints).
 * 4. Programmatic report creation (POST /api/v1/reports) with derived Ethiopian calendar date.
 * 5. Report schema invariant rejection (status on root, supervisorName virtual purge assertion).
 * 6. Active report listing and pagination (GET /api/v1/reports) with default archive exclusion.
 * 7. Bilingual search query matching (GET /api/v1/reports?search=...) across English and Amharic.
 * 8. Subdocument endpoints (/activities, /issues, /comments) with schema status validation.
 * 9. Report content amendment (PATCH /api/v1/reports/:reportId) updating clockOut, transcription, audios.
 * 10. Soft-archiving (PATCH /api/v1/reports/:reportId/archive) and double-archive rejection (HTTP 400).
 * 11. Report restoration (PATCH /api/v1/reports/:reportId/restore) and double-restore rejection (HTTP 400).
 * 12. Direct manual hard delete (DELETE /api/v1/reports/:reportId/delete) and post-commit audio binary unlinking.
 * 13. Multi-tenant security isolation (foreign supervisor receives HTTP 404).
 * 14. Sweeper Pass 1: 30-day retention and expired report/audio cleanup assertion with post-commit unlink.
 * 15. Sweeper Pass 1: Branch 'visits.branch' reference check protection (preserves branch to protect audit records).
 * 16. Sweeper Pass 2: Temp scratch cleanup (1-hour cutoff) and guaranteed preservation of protected fixtures.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Branch } from '../src/models/Branch.js';
import { Report } from '../src/models/Report.js';
import { Audio } from '../src/models/Audio.js';
import { runSweeperCycle, PROTECTED_FIXTURES } from '../src/jobs/sweeper.js';
import { UPLOADS_CONFIG } from '../src/utils/constants.js';

const PORT = 4005;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server;
let primaryCookies = [];
let secondaryCookies = [];
let activeCookies = [];

/**
 * Cookie-preserving HTTP JSON request helper simulating Postman client behavior.
 *
 * @param {string} endpoint - API path relative to BASE_URL.
 * @param {object} [options] - Request configuration options.
 * @returns {Promise<{ status: number, headers: object, cookies: string[], body: any }>}
 */
const postmanRequest = (endpoint, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const method = options.method || 'GET';
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const cookiesToUse = options.cookies !== undefined ? options.cookies : activeCookies;
    if (cookiesToUse.length > 0 && !options.skipCookies) {
      headers['Cookie'] = cookiesToUse.join('; ');
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const setCookieHeaders = res.headers['set-cookie'];
        const returnedCookies = [];
        if (setCookieHeaders) {
          setCookieHeaders.forEach((rawCookie) => {
            const cookiePart = rawCookie.split(';')[0];
            returnedCookies.push(cookiePart);
          });
        }

        let parsedBody;
        try {
          parsedBody = data ? JSON.parse(data) : {};
        } catch {
          parsedBody = data;
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          cookies: returnedCookies,
          body: parsedBody,
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
};

/**
 * Native multipart/form-data upload helper simulating Postman file upload behavior.
 *
 * @param {string} endpoint - API path relative to BASE_URL.
 * @param {Array<{ fieldName: string, filePath: string, fileName?: string, mimeType?: string }>} files - Files to upload.
 * @param {object} [options] - Additional options.
 * @returns {Promise<{ status: number, headers: object, body: any }>}
 */
const postmanMultipartUpload = (endpoint, files = [], options = {}) => {
  return new Promise((resolve, reject) => {
    const boundary = `----PostmanFormBoundary${Date.now().toString(16)}`;
    const url = new URL(`${BASE_URL}${endpoint}`);
    const method = 'POST';
    const chunks = [];

    for (const f of files) {
      const fieldName = f.fieldName || 'audios';
      const fileName = f.fileName || path.basename(f.filePath);
      const mimeType = f.mimeType || 'audio/wav';
      const fileBuffer = fs.readFileSync(f.filePath);

      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`
        )
      );
      chunks.push(fileBuffer);
      chunks.push(Buffer.from('\r\n'));
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    const fullBody = Buffer.concat(chunks);

    const headers = {
      'Accept': 'application/json',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': fullBody.length,
      ...(options.headers || {}),
    };

    const cookiesToUse = options.cookies !== undefined ? options.cookies : activeCookies;
    if (cookiesToUse.length > 0 && !options.skipCookies) {
      headers['Cookie'] = cookiesToUse.join('; ');
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
};

/**
 * Spawns the test HTTP server on port 4005.
 *
 * @returns {Promise<http.Server>}
 */
const spawnServer = () => {
  return new Promise((resolve, reject) => {
    const s = http.createServer(app);
    s.listen(PORT, (err) => {
      if (err) return reject(err);
      resolve(s);
    });
  });
};

/**
 * Main execution runner for the Report Backend & Sweeper integration suite.
 */
async function runReportIntegrationSuite() {
  console.log('========================================================================');
  console.log('  REPORT RESOURCE & TWO-PASS SWEEPER INTEGRATION TEST SUITE');
  console.log(`  Target Port: ${PORT} | Environment: Test | DB: MongoDB Atlas`);
  console.log('========================================================================\n');

  let passedCount = 0;
  let supervisorUser;
  let secondaryUser;
  let boleBranch;
  let piassaBranch;
  let uploadedAudioDoc;
  let createdReportDoc;

  try {
    // 0. Database connection and server initialization
    console.log('[Setup] Connecting to MongoDB Atlas & starting server...');
    await connectDB();
    server = await spawnServer();
    console.log(`[Setup] Server listening on port ${PORT}.\n`);

    // Teardown pre-existing test fixtures
    await User.deleteMany({ email: { $in: ['reports-supervisor@example.com', 'reports-supervisor-b@example.com'] } });
    await Branch.deleteMany({ name: { $in: ['Bole Audit Branch', 'Piassa Audit Branch', 'Sweeper Branch Guard'] } });

    // Seed supervisor User A
    supervisorUser = await User.create({
      firstName: 'Abebe',
      lastName: 'Kebede',
      email: 'reports-supervisor@example.com',
      password: 'StrongPassword123!',
      position: 'Area Operations Supervisor',
    });

    // Seed supervisor User B (for multi-tenant isolation)
    secondaryUser = await User.create({
      firstName: 'Tigist',
      lastName: 'Alemu',
      email: 'reports-supervisor-b@example.com',
      password: 'StrongPassword123!',
      position: 'Secondary Operations Supervisor',
    });

    // Seed branches for User A
    boleBranch = await Branch.create({
      user: supervisorUser._id,
      name: 'Bole Audit Branch',
      location: 'Bole Medhanialem',
      managerName: 'Dawit Bekele',
      contactPhone: '0911223344',
      code: 'BL-AUD',
    });

    piassaBranch = await Branch.create({
      user: supervisorUser._id,
      name: 'Piassa Audit Branch',
      location: 'Piassa Churchill Rd',
      managerName: 'Meron Tadesse',
      contactPhone: '0922334455',
      code: 'PI-AUD',
    });

    // Authenticate User A
    const loginRes = await postmanRequest('/auth/login', {
      method: 'POST',
      body: { email: 'reports-supervisor@example.com', password: 'StrongPassword123!' },
    });
    assert.strictEqual(loginRes.status, 200, 'Supervisor A login returns 200 OK');
    primaryCookies = loginRes.cookies;
    activeCookies = primaryCookies;

    // Authenticate User B
    const loginBRes = await postmanRequest('/auth/login', {
      method: 'POST',
      body: { email: 'reports-supervisor-b@example.com', password: 'StrongPassword123!' },
    });
    assert.strictEqual(loginBRes.status, 200, 'Supervisor B login returns 200 OK');
    secondaryCookies = loginBRes.cookies;

    // -------------------------------------------------------------------------
    // Scenario 1: Health & Route Registry Mounting Check
    // -------------------------------------------------------------------------
    console.log('[Scenario 1/16] Testing Server Health and Route Registry Mount...');
    const healthRes = await postmanRequest('/health', { skipCookies: true });
    assert.strictEqual(healthRes.status, 200, 'Health check returns HTTP 200');
    assert.strictEqual(healthRes.body.status, 'UP', 'Health status is UP');
    console.log('  ✓ Route registry mounted cleanly.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 2: Evidentiary Audio Upload (POST /api/v1/reports/upload-audio)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 2/16] Testing Evidentiary Audio Upload (POST /api/v1/reports/upload-audio)...');
    const fixtureAudioPath = path.resolve(UPLOADS_CONFIG.AUDIOS_DIR, 'audio-sample-2.wav');
    assert.ok(fs.existsSync(fixtureAudioPath), 'audio-sample-2.wav fixture exists on disk');

    const uploadRes = await postmanMultipartUpload('/reports/upload-audio', [
      {
        fieldName: 'audios',
        filePath: fixtureAudioPath,
        fileName: 'test-upload-sample.wav',
        mimeType: 'audio/wav',
      },
    ]);

    assert.strictEqual(uploadRes.status, 201, 'POST /reports/upload-audio returns HTTP 201 CREATED');
    assert.ok(uploadRes.body.success, 'Response indicates success');
    assert.ok(Array.isArray(uploadRes.body.data.audios), 'Response data contains audios array');
    assert.strictEqual(uploadRes.body.data.audios.length, 1, 'Exactly one audio document persisted');

    uploadedAudioDoc = uploadRes.body.data.audios[0];
    assert.ok(uploadedAudioDoc._id, 'Audio document contains _id');
    assert.strictEqual(uploadedAudioDoc.purpose, 'report_narration', 'Audio purpose defaults to report_narration');
    assert.ok(uploadedAudioDoc.path, 'Audio document contains canonical storage path');

    const uploadedDiskPath = path.resolve(uploadedAudioDoc.path);
    assert.ok(fs.existsSync(uploadedDiskPath), 'Uploaded audio binary exists on disk');
    console.log('  ✓ Evidentiary audio uploaded and persisted in MongoDB Atlas.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 3: Upload Boundary Enforcement
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 3/16] Testing Upload Boundary Enforcement (MIME whitelist, empty payload)...');
    const emptyUploadRes = await postmanMultipartUpload('/reports/upload-audio', []);
    assert.strictEqual(emptyUploadRes.status, 400, 'Empty audio upload rejected with HTTP 400');

    // Attempt non-audio MIME upload
    const dummyTextPath = path.resolve(UPLOADS_CONFIG.ATTACHMENTS_DIR, 'transcription-sample-1.txt');
    const invalidMimeRes = await postmanMultipartUpload('/reports/upload-audio', [
      {
        fieldName: 'audios',
        filePath: dummyTextPath,
        fileName: 'invalid-attachment.txt',
        mimeType: 'text/plain',
      },
    ]);
    assert.strictEqual(invalidMimeRes.status, 400, 'Non-audio MIME type upload rejected with HTTP 400');
    console.log('  ✓ Upload boundary constraints enforced.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 4: Programmatic Report Creation (POST /api/v1/reports)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 4/16] Testing Programmatic Report Creation (POST /api/v1/reports)...');
    const reportPayload = {
      date: new Date().toISOString(),
      clockIn: '08:30',
      clockOut: '17:30',
      visits: [
        {
          branch: boleBranch._id.toString(),
          clockIn: '09:00',
          clockOut: '13:00',
        },
        {
          branch: piassaBranch._id.toString(),
          clockIn: '14:00',
          clockOut: '17:00',
        },
      ],
      activities: [
        { text: 'የቦሌ ቅርንጫፍ የንጽህና እና የደህንነት ቁጥጥር ተደርጓል', status: 'completed' },
        { text: 'የፒያሳ ቅርንጫፍ የዕቃ ዝርዝር ኦዲት ተከናውኗል', status: 'completed' },
      ],
      issues: [
        { text: 'በቦሌ ቅርንጫፍ የዲፕ ፍራየር ቴርሞስታት ብልሽት ተስተውሏል', status: 'reported' },
      ],
      comments: [
        { text: 'አጠቃላይ የቅርንጫፎቹ እንቅስቃሴ በጥሩ ደረጃ ላይ ይገኛል።' },
      ],
      transcription: 'የቦሌ እና የፒያሳ ቅርንጫፎች ዕለታዊ የቁጥጥር እና የኦዲት የስራ እንቅስቃሴ ሪፖርት',
      audios: [uploadedAudioDoc._id.toString()],
    };

    const createReportRes = await postmanRequest('/reports', {
      method: 'POST',
      body: reportPayload,
    });

    assert.strictEqual(createReportRes.status, 201, 'POST /reports returns HTTP 201 CREATED');
    assert.ok(createReportRes.body.success, 'Response indicates success');
    createdReportDoc = createReportRes.body.data.report;

    // Author Identity SSOT Assertion
    assert.strictEqual(
      createdReportDoc.user.toString(),
      supervisorUser._id.toString(),
      'Author identity grounded strictly via user reference (SSOT)'
    );

    // Derived Virtual Ethiopian Calendar Date Assertion
    assert.ok(createdReportDoc.ethiopianDate, 'Report contains derived ethiopianDate virtual');
    assert.match(createdReportDoc.ethiopianDate, /^\d{2}-\d{2}-\d{2}$/, 'ethiopianDate matches DD-MM-YY format');

    // Subdocuments Assertion
    assert.strictEqual(createdReportDoc.visits.length, 2, 'Report contains 2 visits');
    assert.strictEqual(createdReportDoc.activities.length, 2, 'Report contains 2 activities');
    assert.strictEqual(createdReportDoc.issues.length, 1, 'Report contains 1 issue');
    assert.strictEqual(createdReportDoc.comments.length, 1, 'Report contains 1 comment');
    assert.strictEqual(createdReportDoc.issues[0].status, 'reported', 'Default issue status is reported');
    assert.strictEqual(createdReportDoc.activities[0].status, 'completed', 'Default activity status is completed');
    console.log('  ✓ Report created with embedded subdocuments and Ethiopian calendar virtual.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 5: Schema Invariant & Forbidden Property Rejection
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 5/16] Testing Report Schema Invariant & Forbidden Property Purge...');
    assert.strictEqual(createdReportDoc.status, undefined, 'Strictly zero status column exists on Report');
    assert.strictEqual(createdReportDoc.templateType, undefined, 'Strictly zero templateType column exists on Report');
    assert.strictEqual(createdReportDoc.supervisorName, undefined, 'supervisorName virtual getter permanently purged');

    // Attempt creating report with foreign or invalid branch ID
    const invalidBranchRes = await postmanRequest('/reports', {
      method: 'POST',
      body: {
        ...reportPayload,
        visits: [{ branch: '507f1f77bcf86cd799439011', clockIn: '09:00', clockOut: '12:00' }],
      },
    });
    assert.strictEqual(invalidBranchRes.status, 404, 'Referencing non-existent branch rejected with HTTP 404');
    console.log('  ✓ Schema invariants and forbidden properties confirmed.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 6: Active Report Listing & Pagination (GET /api/v1/reports)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 6/16] Testing Active Report Listing & Pagination (GET /api/v1/reports)...');
    const listRes = await postmanRequest('/reports?limit=10&page=1');
    assert.strictEqual(listRes.status, 200, 'GET /reports returns HTTP 200 OK');
    assert.ok(Array.isArray(listRes.body.data.docs), 'Response contains docs array');
    assert.ok(listRes.body.data.totalDocs >= 1, 'totalDocs is at least 1');
    assert.strictEqual(listRes.body.data.page, 1, 'Page is 1');

    // Default list excludes archived reports
    const foundActive = listRes.body.data.docs.find((r) => r._id === createdReportDoc._id);
    assert.ok(foundActive, 'Created active report present in default list');
    assert.strictEqual(foundActive.isArchived, false, 'isArchived is false');
    assert.ok(foundActive.visits[0].branch.name, 'visits.branch populated with branch name');
    console.log('  ✓ Active report listing and pagination verified.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 7: Bilingual Search Query Matching
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 7/16] Testing Bilingual Search Query Matching (GET /api/v1/reports?search=...)...');
    // Search by Amharic keyword "ፍራየር" (fryer) present in issue description
    const amharicSearchRes = await postmanRequest('/reports?search=ፍራየር');
    assert.strictEqual(amharicSearchRes.status, 200, 'Amharic search returns HTTP 200');
    assert.ok(amharicSearchRes.body.data.docs.some((r) => r._id === createdReportDoc._id), 'Amharic search matches report');

    // Search by keyword "ኦዲት" (audit) present in transcription
    const auditSearchRes = await postmanRequest('/reports?search=ኦዲት');
    assert.strictEqual(auditSearchRes.status, 200, 'Transcription keyword search returns HTTP 200');
    assert.ok(auditSearchRes.body.data.docs.some((r) => r._id === createdReportDoc._id), 'Transcription search matches report');

    // Search by non-matching string
    const emptySearchRes = await postmanRequest('/reports?search=NonExistentKeywordXYZ');
    assert.strictEqual(emptySearchRes.status, 200, 'Non-matching search returns HTTP 200');
    assert.strictEqual(emptySearchRes.body.data.totalDocs, 0, 'Non-matching search returns 0 results');
    console.log('  ✓ Bilingual search filtering verified.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 8: Subdocument Endpoints (/activities, /issues, /comments)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 8/16] Testing Subdocument Inspection Endpoints...');
    const activitiesRes = await postmanRequest(`/reports/${createdReportDoc._id}/activities`);
    assert.strictEqual(activitiesRes.status, 200, 'GET /activities returns 200 OK');
    assert.strictEqual(activitiesRes.body.data.activities.length, 2, 'Returns 2 activities');

    const issuesRes = await postmanRequest(`/reports/${createdReportDoc._id}/issues`);
    assert.strictEqual(issuesRes.status, 200, 'GET /issues returns 200 OK');
    assert.strictEqual(issuesRes.body.data.issues.length, 1, 'Returns 1 issue');

    const commentsRes = await postmanRequest(`/reports/${createdReportDoc._id}/comments`);
    assert.strictEqual(commentsRes.status, 200, 'GET /comments returns 200 OK');
    assert.strictEqual(commentsRes.body.data.comments.length, 1, 'Returns 1 comment');
    console.log('  ✓ Subdocument endpoints return expected arrays.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 9: Report Content Amendment (PATCH /api/v1/reports/:reportId)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 9/16] Testing Report Content Amendment (PATCH /api/v1/reports/:reportId)...');
    const updateRes = await postmanRequest(`/reports/${createdReportDoc._id}`, {
      method: 'PATCH',
      body: {
        clockOut: '18:15',
        transcription: 'የተሻሻለ እና የተሟላ የቅርንጫፎች የስራ ክንውን ሪፖርት',
        activities: [
          ...createdReportDoc.activities.map((a) => ({ text: a.text, status: a.status })),
          { text: 'የሰራተኞች አጭር ስብሰባ ተካሂዷል', status: 'completed' },
        ],
      },
    });

    assert.strictEqual(
      updateRes.status,
      200,
      `PATCH /reports/:reportId returns HTTP 200 OK: ${JSON.stringify(updateRes.body)}`
    );
    assert.strictEqual(updateRes.body.data.report.clockOut, '18:15', 'clockOut updated to 18:15');
    assert.strictEqual(updateRes.body.data.report.activities.length, 3, 'Activities expanded to 3 items');
    assert.strictEqual(updateRes.body.data.report.transcription, 'የተሻሻለ እና የተሟላ የቅርንጫፎች የስራ ክንውን ሪፖርት', 'transcription updated');
    console.log('  ✓ Report fields amended successfully.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 10: Soft-Archiving (PATCH /api/v1/reports/:reportId/archive)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 10/16] Testing Soft-Archiving & Double-Archive Rejection...');
    const archiveRes = await postmanRequest(`/reports/${createdReportDoc._id}/archive`, {
      method: 'PATCH',
    });

    assert.strictEqual(archiveRes.status, 200, 'PATCH /archive returns HTTP 200 OK');
    assert.strictEqual(archiveRes.body.data.report.isArchived, true, 'isArchived is true');
    assert.ok(archiveRes.body.data.report.archivedAt, 'archivedAt timestamp populated');

    // Double archive attempt rejected with HTTP 400
    const doubleArchiveRes = await postmanRequest(`/reports/${createdReportDoc._id}/archive`, {
      method: 'PATCH',
    });
    assert.strictEqual(doubleArchiveRes.status, 400, 'Archiving already archived report rejected with HTTP 400');

    // Default GET /reports excludes archived report
    const checkExclusionRes = await postmanRequest('/reports');
    assert.ok(!checkExclusionRes.body.data.docs.some((r) => r._id === createdReportDoc._id), 'Archived report excluded from default active list');

    // GET /reports?archived=true includes archived report
    const checkArchivedListRes = await postmanRequest('/reports?archived=true');
    assert.ok(checkArchivedListRes.body.data.docs.some((r) => r._id === createdReportDoc._id), 'Archived report included in ?archived=true query');
    console.log('  ✓ Soft-archival, double-archive prevention, and query filtering verified.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 11: Report Restoration (PATCH /api/v1/reports/:reportId/restore)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 11/16] Testing Report Restoration & Double-Restore Rejection...');
    const restoreRes = await postmanRequest(`/reports/${createdReportDoc._id}/restore`, {
      method: 'PATCH',
    });

    assert.strictEqual(restoreRes.status, 200, 'PATCH /restore returns HTTP 200 OK');
    assert.strictEqual(restoreRes.body.data.report.isArchived, false, 'isArchived is false');
    assert.strictEqual(restoreRes.body.data.report.archivedAt, null, 'archivedAt reset to null');

    // Double restore attempt on active report rejected with HTTP 400
    const doubleRestoreRes = await postmanRequest(`/reports/${createdReportDoc._id}/restore`, {
      method: 'PATCH',
    });
    assert.strictEqual(doubleRestoreRes.status, 400, 'Restoring active report rejected with HTTP 400');
    console.log('  ✓ Restoration and double-restore prevention verified.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 12: Direct Manual Hard Delete (DELETE /api/v1/reports/:reportId/delete)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 12/16] Testing Direct Manual Hard Delete & Post-Commit Unlinking...');
    // Create a temporary disposable audio file and report for manual hard delete testing
    const disposableAudioFilePath = path.resolve(UPLOADS_CONFIG.AUDIOS_DIR, `disposable-test-${Date.now()}.wav`);
    fs.copyFileSync(fixtureAudioPath, disposableAudioFilePath);

    const disposableUploadRes = await postmanMultipartUpload('/reports/upload-audio', [
      {
        fieldName: 'audios',
        filePath: disposableAudioFilePath,
        fileName: 'disposable-test.wav',
        mimeType: 'audio/wav',
      },
    ]);
    const disposableAudioDoc = disposableUploadRes.body.data.audios[0];
    const disposableAudioDiskPath = path.resolve(disposableAudioDoc.path);

    const disposableReportRes = await postmanRequest('/reports', {
      method: 'POST',
      body: {
        date: new Date().toISOString(),
        clockIn: '10:00',
        clockOut: '12:00',
        visits: [{ branch: boleBranch._id.toString(), clockIn: '10:15', clockOut: '11:45' }],
        activities: [{ text: 'ሙከራ ተግባር', status: 'completed' }],
        transcription: 'የሙከራ ሪፖርት ለመሰረዝ የተዘጋጀ',
        audios: [disposableAudioDoc._id],
      },
    });
    const disposableReport = disposableReportRes.body.data.report;

    // Attempting direct hard delete without archiving first rejected with HTTP 400
    const prematureDeleteRes = await postmanRequest(`/reports/${disposableReport._id}/delete`, {
      method: 'DELETE',
    });
    assert.strictEqual(prematureDeleteRes.status, 400, 'Deleting active report rejected with HTTP 400');

    // Soft-archive report
    await postmanRequest(`/reports/${disposableReport._id}/archive`, { method: 'PATCH' });

    // Now permanently hard-delete
    const hardDeleteRes = await postmanRequest(`/reports/${disposableReport._id}/delete`, {
      method: 'DELETE',
    });
    assert.strictEqual(hardDeleteRes.status, 200, 'DELETE /delete returns HTTP 200 OK');

    // Verify report document removed from database
    const dbReportCheck = await Report.findById(disposableReport._id);
    assert.strictEqual(dbReportCheck, null, 'Report document permanently removed from MongoDB Atlas');

    // Verify associated Audio document removed from database
    const dbAudioCheck = await Audio.findById(disposableAudioDoc._id);
    assert.strictEqual(dbAudioCheck, null, 'Associated Audio document permanently removed from MongoDB Atlas');

    // Verify audio binary unlinked from disk post-commit
    assert.ok(!fs.existsSync(disposableAudioDiskPath), 'Associated audio binary unlinked from filesystem');

    // Clean up scratch copy
    if (fs.existsSync(disposableAudioFilePath)) fs.unlinkSync(disposableAudioFilePath);

    console.log('  ✓ Manual hard delete purges database records and unlinks disk binaries post-commit.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 13: Multi-Tenant Security Isolation
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 13/16] Testing Multi-Tenant Security Isolation...');
    // Switch active cookies to Secondary User B
    activeCookies = secondaryCookies;

    // User B attempts to access User A's report
    const userBAccessRes = await postmanRequest(`/reports/${createdReportDoc._id}`);
    assert.strictEqual(userBAccessRes.status, 404, 'Foreign supervisor access rejected with HTTP 404 NOT_FOUND');

    // User B attempts to update User A's report
    const userBUpdateRes = await postmanRequest(`/reports/${createdReportDoc._id}`, {
      method: 'PATCH',
      body: { clockOut: '20:00' },
    });
    assert.strictEqual(userBUpdateRes.status, 404, 'Foreign supervisor update rejected with HTTP 404 NOT_FOUND');

    // User B attempts to archive User A's report
    const userBArchiveRes = await postmanRequest(`/reports/${createdReportDoc._id}/archive`, {
      method: 'PATCH',
    });
    assert.strictEqual(userBArchiveRes.status, 404, 'Foreign supervisor archive rejected with HTTP 404 NOT_FOUND');

    // Switch back to Primary User A
    activeCookies = primaryCookies;
    console.log('  ✓ Multi-tenant data isolation strictly enforced.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 14: Sweeper Pass 1 — 30-Day Retention & Expired Purge Assertion
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 14/16] Testing Sweeper Pass 1 (30-Day Retention & Expired Purge)...');
    // Seed expired audio file on disk
    const expiredAudioBinaryPath = path.resolve(UPLOADS_CONFIG.AUDIOS_DIR, `sweeper-expired-${Date.now()}.wav`);
    fs.copyFileSync(fixtureAudioPath, expiredAudioBinaryPath);

    const expiredAudioDoc = await Audio.create({
      user: supervisorUser._id,
      fileName: path.basename(expiredAudioBinaryPath),
      originalName: 'expired-audio.wav',
      mimeType: 'audio/wav',
      size: fs.statSync(expiredAudioBinaryPath).size,
      path: expiredAudioBinaryPath,
      purpose: 'report_narration',
      status: 'uploaded',
      isArchived: true,
      archivedAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000), // 32 days ago
    });

    // Seed expired report (> 30 days)
    const expiredReportDoc = await Report.create({
      user: supervisorUser._id,
      date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      clockIn: '08:00',
      clockOut: '17:00',
      visits: [{ branch: boleBranch._id, clockIn: '08:30', clockOut: '16:30' }],
      activities: [{ text: 'ጊዜው ያለፈበት ተግባር', status: 'completed' }],
      transcription: 'ጊዜው ያለፈበት ሪፖርት',
      audios: [expiredAudioDoc._id],
      isArchived: true,
      archivedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
    });

    // Seed unexpired archived report (< 30 days, e.g. 5 days ago)
    const unexpiredAudioBinaryPath = path.resolve(UPLOADS_CONFIG.AUDIOS_DIR, `sweeper-unexpired-${Date.now()}.wav`);
    fs.copyFileSync(fixtureAudioPath, unexpiredAudioBinaryPath);

    const unexpiredAudioDoc = await Audio.create({
      user: supervisorUser._id,
      fileName: path.basename(unexpiredAudioBinaryPath),
      originalName: 'unexpired-audio.wav',
      mimeType: 'audio/wav',
      size: fs.statSync(unexpiredAudioBinaryPath).size,
      path: unexpiredAudioBinaryPath,
      purpose: 'report_narration',
      status: 'uploaded',
      isArchived: true,
      archivedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    });

    const unexpiredReportDoc = await Report.create({
      user: supervisorUser._id,
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      clockIn: '08:00',
      clockOut: '17:00',
      visits: [{ branch: boleBranch._id, clockIn: '08:30', clockOut: '16:30' }],
      activities: [{ text: 'ጊዜው ያልደረሰበት ተግባር', status: 'completed' }],
      transcription: 'ጊዜው ያልደረሰበት ሪፖርት',
      audios: [unexpiredAudioDoc._id],
      isArchived: true,
      archivedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    });

    // Run sweeper cycle
    const sweepResult1 = await runSweeperCycle();
    assert.ok(sweepResult1.pass1.reportsPurged >= 1, 'Sweeper purged at least 1 expired report');

    // Assert expired report removed from MongoDB
    const checkExpiredReport = await Report.findById(expiredReportDoc._id);
    assert.strictEqual(checkExpiredReport, null, 'Expired report document purged from MongoDB');

    // Assert expired Audio document removed from MongoDB
    const checkExpiredAudio = await Audio.findById(expiredAudioDoc._id);
    assert.strictEqual(checkExpiredAudio, null, 'Expired audio document purged from MongoDB');

    // Assert expired audio binary unlinked from disk
    assert.ok(!fs.existsSync(expiredAudioBinaryPath), 'Expired audio binary unlinked from disk');

    // Assert unexpired report (< 30 days) and audio binary STRICTLY PRESERVED
    const checkUnexpiredReport = await Report.findById(unexpiredReportDoc._id);
    assert.ok(checkUnexpiredReport, 'Unexpired report (< 30 days) is strictly preserved');
    assert.ok(fs.existsSync(unexpiredAudioBinaryPath), 'Unexpired audio binary (< 30 days) is strictly preserved');

    // Cleanup unexpired fixture
    await Report.deleteOne({ _id: unexpiredReportDoc._id });
    await Audio.deleteOne({ _id: unexpiredAudioDoc._id });
    if (fs.existsSync(unexpiredAudioBinaryPath)) fs.unlinkSync(unexpiredAudioBinaryPath);

    console.log('  ✓ Sweeper Pass 1 purges expired reports/audios while preserving unexpired ones.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 15: Sweeper Pass 1 — Branch 'visits.branch' Reference Check Protection
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 15/16] Testing Sweeper Pass 1 Branch Reference Check Protection...');
    // Seed a branch that is referenced by an active report
    const guardedBranch = await Branch.create({
      user: supervisorUser._id,
      name: 'Sweeper Branch Guard',
      location: 'Saris',
      code: 'SWP-GRD',
      isArchived: true,
      archivedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago (eligible for purge)
    });

    // Reference this branch in an active report's visits
    const referencingReport = await Report.create({
      user: supervisorUser._id,
      date: new Date(),
      clockIn: '09:00',
      clockOut: '17:00',
      visits: [{ branch: guardedBranch._id, clockIn: '09:30', clockOut: '16:30' }],
      activities: [{ text: 'የቅርንጫፍ ጥበቃ ኦዲት', status: 'completed' }],
      transcription: 'የቅርንጫፍ ጥበቃ ሪፖርት',
      isArchived: false,
    });

    // Run sweeper cycle
    await runSweeperCycle();

    // Verify guarded branch was NOT removed because it is referenced in an active report
    const checkGuardedBranch = await Branch.findById(guardedBranch._id);
    assert.ok(checkGuardedBranch, 'Branch referenced by active report visits was preserved by reference guard');
    assert.strictEqual(checkGuardedBranch.isArchived, true, 'Branch remains archived');

    // Cleanup guard fixtures
    await Report.deleteOne({ _id: referencingReport._id });
    await Branch.deleteOne({ _id: guardedBranch._id });

    console.log('  ✓ Branch reference check protects historical audit records.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Scenario 16: Sweeper Pass 2 — Scratch Cleanup & Protected Fixture Preservation
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 16/16] Testing Sweeper Pass 2 (Scratch Cleanup & Fixture Preservation)...');
    // Seed a dummy temporary chunk in temp/ older than 1 hour
    const dummyChunkPath = path.resolve(UPLOADS_CONFIG.TEMP_DIR, `temp_chunk_test_${Date.now()}.wav`);
    fs.writeFileSync(dummyChunkPath, 'dummy-temp-chunk-bytes');
    // Backdate mtime to 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(dummyChunkPath, twoHoursAgo, twoHoursAgo);

    // Verify committed fixtures exist before sweep
    const sample1Path = path.resolve(UPLOADS_CONFIG.AUDIOS_DIR, 'audio-sample-1.wav');
    const sample2Path = path.resolve(UPLOADS_CONFIG.AUDIOS_DIR, 'audio-sample-2.wav');
    assert.ok(fs.existsSync(sample1Path), 'audio-sample-1.wav exists before sweeper');
    assert.ok(fs.existsSync(sample2Path), 'audio-sample-2.wav exists before sweeper');

    // Run sweeper cycle
    const sweepResult2 = await runSweeperCycle();
    assert.ok(sweepResult2.pass2.orphanFilesPurged >= 1, 'Sweeper purged dummy temporary chunk');

    // Assert dummy temp chunk unlinked
    assert.ok(!fs.existsSync(dummyChunkPath), 'Temporary scratch chunk older than 1 hour unlinked');

    // Assert committed fixtures audio-sample-1.wav and audio-sample-2.wav 100% PRESERVED
    assert.ok(fs.existsSync(sample1Path), 'audio-sample-1.wav 100% PRESERVED after sweeper cycle');
    assert.ok(fs.existsSync(sample2Path), 'audio-sample-2.wav 100% PRESERVED after sweeper cycle');

    console.log('  ✓ Sweeper Pass 2 unlinked scratch leak while strictly preserving committed fixtures.');
    passedCount += 1;

    // -------------------------------------------------------------------------
    // Final Teardown
    // -------------------------------------------------------------------------
    console.log('\n[Teardown] Cleaning up test records and stopping server...');
    if (createdReportDoc) {
      await Report.deleteOne({ _id: createdReportDoc._id });
    }
    if (uploadedAudioDoc) {
      await Audio.deleteOne({ _id: uploadedAudioDoc._id });
      const upDisk = path.resolve(uploadedAudioDoc.path);
      if (fs.existsSync(upDisk)) fs.unlinkSync(upDisk);
    }
    await User.deleteMany({ email: { $in: ['reports-supervisor@example.com', 'reports-supervisor-b@example.com'] } });
    await Branch.deleteMany({ name: { $in: ['Bole Audit Branch', 'Piassa Audit Branch'] } });

    console.log('\n========================================================================');
    console.log(`  REPORT RESOURCE TEST SUITE PASSED (${passedCount}/16 Scenarios, 100% Green)`);
    console.log('========================================================================\n');
  } catch (error) {
    console.error(`\n[FATAL] Test failed: ${error.message}\n${error.stack}`);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((res) => server.close(res));
      console.log('[Teardown] HTTP server closed cleanly.');
    }
    await disconnectDB();
    console.log('[Teardown] MongoDB disconnected cleanly.');
  }
}

// Execute if run directly
runReportIntegrationSuite();
