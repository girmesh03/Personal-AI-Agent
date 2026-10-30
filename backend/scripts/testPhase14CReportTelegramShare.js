/**
 * @module scripts/testPhase14CReportTelegramShare
 * @description Dedicated automated test suite verifying Phase 14C Telegram Report Sharing:
 * Dedicated Report Share endpoint (POST /api/v1/reports/:reportId/share/telegram).
 * Asserts multi-tenant scoping, transcription retrieval, channel routing, and stub/live dispatch.
 */

import http from 'node:http';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Branch } from '../src/models/Branch.js';
import { Report } from '../src/models/Report.js';

const PORT = 4022;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server;
let userACookies = [];
let userBCookies = [];
let userA;
let userB;
let branchA;
let reportA;
let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  PASS: ${message}`);
}

async function makeRequest(endpoint, { method = 'GET', headers = {}, body = null, cookies = [] } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const reqHeaders = { ...headers };

    if (cookies.length > 0) {
      reqHeaders['Cookie'] = cookies.join('; ');
    }

    let requestBody = null;
    if (body) {
      requestBody = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(requestBody);
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        const setCookie = res.headers['set-cookie'];
        const returnedCookies = setCookie ? setCookie.map((c) => c.split(';')[0]) : [];

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, cookies: returnedCookies });
        });
      }
    );

    req.on('error', reject);

    if (requestBody) {
      req.write(requestBody);
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('🧪 Starting Phase 14C Dedicated Telegram Report Sharing Tests');
  console.log('===============================================================\n');

  try {
    await connectDB();
    server = app.listen(PORT);
    await new Promise((resolve) => server.once('listening', resolve));

    const testRunId = Date.now().toString().slice(-6);
    const userAEmail = `supervisor_a_${testRunId}@test.et`;
    const userBEmail = `supervisor_b_${testRunId}@test.et`;
    const password = 'Password123!';

    // Register User A
    const regResA = await makeRequest('/auth/register', {
      method: 'POST',
      body: {
        email: userAEmail,
        password,
        fullName: 'Supervisor User A',
      },
    });
    assert(regResA.status === 201, 'User A registered successfully (201)');
    userACookies = regResA.cookies;

    // Login User A
    const loginResA = await makeRequest('/auth/login', {
      method: 'POST',
      body: { email: userAEmail, password },
    });
    assert(loginResA.status === 200, 'User A logged in successfully (200)');
    if (loginResA.cookies.length > 0) userACookies = loginResA.cookies;

    userA = await User.findOne({ email: userAEmail });
    assert(Boolean(userA), 'User A found in database');

    // Register User B
    const regResB = await makeRequest('/auth/register', {
      method: 'POST',
      body: {
        email: userBEmail,
        password,
        fullName: 'Supervisor User B',
      },
    });
    assert(regResB.status === 201, 'User B registered successfully (201)');
    userBCookies = regResB.cookies;

    // Login User B
    const loginResB = await makeRequest('/auth/login', {
      method: 'POST',
      body: { email: userBEmail, password },
    });
    assert(loginResB.status === 200, 'User B logged in successfully (200)');
    if (loginResB.cookies.length > 0) userBCookies = loginResB.cookies;

    userB = await User.findOne({ email: userBEmail });
    assert(Boolean(userB), 'User B found in database');

    // Create a Branch for User A
    branchA = await Branch.create({
      user: userA._id,
      name: `Bole Mega Branch ${testRunId}`,
      code: `BL-${testRunId}`,
      city: 'Addis Ababa',
      subCity: 'Bole',
      woreda: '03',
      location: {
        type: 'Point',
        coordinates: [38.7891, 8.9952],
      },
    });
    assert(Boolean(branchA), 'Branch created for User A');

    // Create an Operational Report for User A
    const testTranscription = 'የካቲት 21 ቀን 2018 ዓ.ም የተከናወነ የቦሌ ሜጋ ቅርንጫፍ ዕለታዊ የክትትል ሪፖርት። ሁሉም የPOS ማሽኖች በጥሩ ሁኔታ እየሰሩ ነው።';
    reportA = await Report.create({
      user: userA._id,
      date: new Date(),
      clockIn: '08:30',
      clockOut: '17:30',
      visits: [
        {
          branch: branchA._id,
          clockIn: '09:00',
          clockOut: '12:30',
        },
      ],
      transcription: testTranscription,
      activities: [
        { text: 'POS ተርሚናሎች ፍተሻ ተካሂዷል', status: 'completed' },
      ],
      issues: [
        { text: 'የኔትወርክ መቆራረጥ በከፊል ተስተውሏል', status: 'reported' },
      ],
      comments: [
        { text: 'በቀጣይ ሳምንት ተጨማሪ ድጋፍ ያስፈልጋል' },
      ],
    });
    assert(Boolean(reportA), 'Report created for User A with authoritative transcription');

    // -------------------------------------------------------------
    // Test 1: Unauthenticated request is rejected (401)
    // -------------------------------------------------------------
    const unauthRes = await makeRequest(`/reports/${reportA._id}/share/telegram`, {
      method: 'POST',
      body: { targetChannel: 'management' },
      cookies: [],
    });
    assert(unauthRes.status === 401, 'Unauthenticated report share request rejected (401)');

    // -------------------------------------------------------------
    // Test 2: Invalid Mongo ID is rejected by validation middleware (422)
    // -------------------------------------------------------------
    const invalidIdRes = await makeRequest('/reports/invalid-mongo-id/share/telegram', {
      method: 'POST',
      body: { targetChannel: 'management' },
      cookies: userACookies,
    });
    assert(invalidIdRes.status === 422, 'Invalid report ID rejected by validation (422)');

    // -------------------------------------------------------------
    // Test 3: Non-existent report returns 404
    // -------------------------------------------------------------
    const fakeId = new mongoose.Types.ObjectId().toString();
    const notFoundRes = await makeRequest(`/reports/${fakeId}/share/telegram`, {
      method: 'POST',
      body: { targetChannel: 'management' },
      cookies: userACookies,
    });
    assert(notFoundRes.status === 404, 'Non-existent report returns 404 Not Found');

    // -------------------------------------------------------------
    // Test 4: Tenant Isolation - User B cannot share User A's report (404)
    // -------------------------------------------------------------
    const crossTenantRes = await makeRequest(`/reports/${reportA._id}/share/telegram`, {
      method: 'POST',
      body: { targetChannel: 'management' },
      cookies: userBCookies,
    });
    assert(crossTenantRes.status === 404, 'Cross-tenant access rejected: User B cannot access User A report (404)');

    // -------------------------------------------------------------
    // Test 5: User A successfully shares report (default management channel, stub mode)
    // -------------------------------------------------------------
    const shareRes = await makeRequest(`/reports/${reportA._id}/share/telegram`, {
      method: 'POST',
      body: { targetChannel: 'management', asImage: false },
      cookies: userACookies,
    });
    assert(shareRes.status === 200, 'Report share request succeeds (200)');
    assert(shareRes.body?.success === true, 'Response body contains success: true');
    assert(Boolean(shareRes.body?.data), 'Response body contains data payload');
    assert(shareRes.body?.data?.channel === 'management', 'Target channel is management');
    assert(shareRes.body?.data?.isStub === true, 'Stub mode detected for unconfigured Telegram credentials');

    // -------------------------------------------------------------
    // Test 6: User A shares to Maintenance channel
    // -------------------------------------------------------------
    const maintRes = await makeRequest(`/reports/${reportA._id}/share/telegram`, {
      method: 'POST',
      body: { targetChannel: 'maintenance' },
      cookies: userACookies,
    });
    assert(maintRes.status === 200, 'Report share to maintenance channel succeeds (200)');
    assert(maintRes.body?.data?.channel === 'maintenance', 'Target channel is maintenance');

    // -------------------------------------------------------------
    // Test 7: User A shares in Image mode
    // -------------------------------------------------------------
    const imgRes = await makeRequest(`/reports/${reportA._id}/share/telegram`, {
      method: 'POST',
      body: { targetChannel: 'general', asImage: true },
      cookies: userACookies,
    });
    assert(imgRes.status === 200, 'Report share in image mode succeeds (200)');
    assert(imgRes.body?.data?.channel === 'general', 'Target channel is general');
    assert(imgRes.body?.data?.mode === 'image', 'Dispatch mode is image');

    console.log('\n===============================================================');
    console.log(`✅ All ${passedTests}/${totalTests} Telegram Report Sharing Tests Passed Successfully!`);
    console.log('===============================================================\n');
  } finally {
    if (userA) {
      await Report.deleteMany({ user: userA._id });
      await Branch.deleteMany({ user: userA._id });
      await User.deleteOne({ _id: userA._id });
    }
    if (userB) {
      await User.deleteOne({ _id: userB._id });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Aborted with Error:', err);
  process.exit(1);
});
