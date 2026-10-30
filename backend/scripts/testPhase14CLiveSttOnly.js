/**
 * @module scripts/testPhase14CLiveSttOnly
 * @description Dedicated automated test suite verifying Phase 14C STT Subsystem:
 * Independent Addis AI Live STT Scribe Session endpoint (POST /api/v1/stt/scribe-session).
 */

import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';

const PORT = 4019;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server;
let userCookies = [];
let testUser;
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

async function makeRequest(endpoint, { method = 'GET', headers = {}, body = null, skipCookies = false } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const reqHeaders = { ...headers };

    if (userCookies.length > 0 && !skipCookies) {
      reqHeaders['Cookie'] = userCookies.join('; ');
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
        if (setCookie) {
          userCookies = setCookie.map((c) => c.split(';')[0]);
        }

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
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
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

async function run() {
  console.log('\n===============================================================');
  console.log('🧪 Starting Phase 14C Dedicated Addis AI Live STT Tests');
  console.log('===============================================================\n');

  try {
    await connectDB();
    await new Promise((resolve) => {
      server = app.listen(PORT, resolve);
    });

    // Cleanup existing test user if present
    await User.deleteMany({ email: 'phase14c_stt_user@example.com' });

    // Register & login
    const registerRes = await makeRequest('/auth/register', {
      method: 'POST',
      body: {
        name: 'Phase14C STT Tester',
        email: 'phase14c_stt_user@example.com',
        password: 'Password123!',
      },
    });
    assert(registerRes.status === 201, 'Test user registered successfully (201)');

    const loginRes = await makeRequest('/auth/login', {
      method: 'POST',
      body: {
        email: 'phase14c_stt_user@example.com',
        password: 'Password123!',
      },
    });
    assert(loginRes.status === 200, 'Test user logged in successfully (200)');

    testUser = await User.findOne({ email: 'phase14c_stt_user@example.com' });
    assert(Boolean(testUser), 'Test user found in database');

    // 1. Unauthenticated request rejected
    const unauthRes = await makeRequest('/stt/scribe-session', {
      method: 'POST',
      skipCookies: true,
      body: { language: 'am' },
    });
    assert(unauthRes.status === 401, 'Unauthenticated scribe-session request rejected (401)');

    // 2. User with no API key returns 400
    await User.updateOne(
      { _id: testUser._id },
      { $set: { 'settings.apiKeys.addisApiKey': 'missing' } }
    );

    const noKeyRes = await makeRequest('/stt/scribe-session', {
      method: 'POST',
      body: { language: 'am' },
    });
    assert(noKeyRes.status === 400, 'Scribe session without API key returns 400 Bad Request');
    assert(
      noKeyRes.body?.message?.includes('Addis AI API key is not configured'),
      'Error message clarifies missing key in Profile > AI Agent Settings'
    );

    // 3. User configured with mock key returns valid session payload
    await User.updateOne(
      { _id: testUser._id },
      { $set: { 'settings.apiKeys.addisApiKey': 'mock_addis_key_for_testing' } }
    );

    const validSessionRes = await makeRequest('/stt/scribe-session', {
      method: 'POST',
      body: { language: 'am' },
    });
    assert(validSessionRes.status === 200, 'Dedicated Scribe session request succeeds (200)');
    assert(validSessionRes.body?.success === true, 'Scribe session response has success=true');
    assert(Boolean(validSessionRes.body?.data?.ticket), 'Scribe session returns secure single-use ticket');
    assert(Boolean(validSessionRes.body?.data?.token), 'Scribe session returns token field');
    assert(
      validSessionRes.body?.data?.websocketUrl?.startsWith('wss://'),
      'Scribe session returns secure wss:// WebSocket URL'
    );
    assert(validSessionRes.body?.data?.expiresIn === 60, 'Scribe session returns 60s expiration');

    console.log('\n===============================================================');
    console.log(`✅ All ${passedTests}/${totalTests} Dedicated STT Tests Passed Successfully!`);
    console.log('===============================================================\n');
  } finally {
    if (testUser) await User.deleteOne({ _id: testUser._id });
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  }
}

run().catch((err) => {
  console.error('\n❌ Dedicated STT Test Failed with Error:', err);
  process.exit(1);
});
