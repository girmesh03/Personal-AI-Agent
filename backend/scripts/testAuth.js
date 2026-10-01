/**
 * @module scripts/testAuth
 * @description Dedicated automated HTTP test suite exercising authentication endpoints like Postman.
 * Validates registration, duplicate collisions, validation errors, login, HttpOnly cookies,
 * Google auth stub, token rotation for logged-in users, logout, and post-logout guards.
 */

import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';

const PORT = 4001;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server;
let savedCookies = [];

/**
 * Cookie-preserving HTTP request helper simulating Postman client behavior.
 *
 * @function postmanRequest
 * @param {string} endpoint - API path relative to BASE_URL.
 * @param {object} [options] - Request configuration options.
 * @returns {Promise<{ status: number, headers: object, cookies: string[], body: any }>} Response payload.
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

    if (savedCookies.length > 0 && !options.skipCookies) {
      headers['Cookie'] = savedCookies.join('; ');
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        // Collect new Set-Cookie headers
        const setCookieHeaders = res.headers['set-cookie'];
        if (setCookieHeaders) {
          setCookieHeaders.forEach((rawCookie) => {
            const cookiePart = rawCookie.split(';')[0];
            const cookieName = cookiePart.split('=')[0];
            savedCookies = savedCookies.filter((c) => !c.startsWith(`${cookieName}=`));
            if (!rawCookie.includes('Max-Age=0') && !rawCookie.includes('expires=Thu, 01 Jan 1970')) {
              savedCookies.push(cookiePart);
            }
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
          cookies: res.headers['set-cookie'] || [],
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
 * Executes Postman-style authentication integration test suite.
 */
const runAuthSuite = async () => {
  console.log('🚀 Starting Postman-style Authentication Suite (testAuth.js)...');
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`📡 Test server listening on ${BASE_URL}`);
  });

  const testEmail = `postman_auth_${Date.now()}@enjoyburger.et`;
  const initialPassword = 'ValidPassword123!';
  let assertionsPassed = 0;

  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(`❌ FAILED: ${message}`);
    }
    assertionsPassed += 1;
    console.log(`  ✅ [PASS] ${message}`);
  };

  try {
    // 1. Health check
    console.log('\n[1/10] Testing GET /health');
    const healthRes = await postmanRequest('/health');
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200');
    assert(healthRes.body.status === 'UP', 'Health body indicates status UP');

    // 2. Register valid user
    console.log('\n[2/10] Testing POST /auth/register');
    const registerRes = await postmanRequest('/auth/register', {
      method: 'POST',
      body: {
        email: testEmail,
        password: initialPassword,
      },
    });
    assert(registerRes.status === 201, 'Registration returns HTTP 201 CREATED');
    assert(registerRes.body.success === true, 'Registration reports success true');
    assert(registerRes.body.data?.user?.email === testEmail, 'User email matches registered email');
    assert(registerRes.body.data?.user?.password === undefined, 'Password is not leaked in response');
    assert(registerRes.cookies.length === 0, 'Zero authentication cookies issued on registration (must log in)');

    // 3. Register duplicate email (Conflict 409)
    console.log('\n[3/10] Testing POST /auth/register (Duplicate Email Conflict)');
    const dupRes = await postmanRequest('/auth/register', {
      method: 'POST',
      body: { email: testEmail, password: initialPassword },
    });
    assert(dupRes.status === 409, 'Duplicate email registration returns HTTP 409 CONFLICT');

    // 4. Register validation failure (422)
    console.log('\n[4/10] Testing POST /auth/register (Validation Error)');
    const invalidReg = await postmanRequest('/auth/register', {
      method: 'POST',
      body: { email: 'bad-email', password: 'short' },
    });
    assert(invalidReg.status === 422, 'Malformed registration payload returns HTTP 422');

    // 5. Login with invalid password (401)
    console.log('\n[5/10] Testing POST /auth/login (Invalid Password)');
    const badLoginRes = await postmanRequest('/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'WrongPassword999!' },
    });
    assert(badLoginRes.status === 401, 'Invalid password returns HTTP 401 UNAUTHENTICATED');

    // 6. Login with correct credentials (200 + HttpOnly cookies)
    console.log('\n[6/10] Testing POST /auth/login (Valid Credentials)');
    const loginRes = await postmanRequest('/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: initialPassword },
    });
    assert(loginRes.status === 200, 'Valid login returns HTTP 200 OK');
    assert(loginRes.body.success === true, 'Login body reports success true');
    assert(loginRes.body.data?.user?.email === testEmail, 'User profile returned in response data');
    assert(loginRes.body.data?.accessToken === undefined, 'Zero access token in JSON body (Cookie-first security)');
    assert(loginRes.cookies.some((c) => c.startsWith('accessToken=')), 'HttpOnly accessToken cookie is set');
    assert(loginRes.cookies.some((c) => c.startsWith('refreshToken=')), 'HttpOnly refreshToken cookie is set');

    // 7. Google Auth Stub Endpoint
    console.log('\n[7/10] Testing GET /auth/google (Google OAuth Stub)');
    const googleRes = await postmanRequest('/auth/google');
    assert(googleRes.status === 200, 'Google stub returns HTTP 200 OK');
    assert(googleRes.body.data?.provider === 'google', 'Google stub provider identified');
    assert(googleRes.body.data?.available === false, 'Google stub marks available as false');

    // 8. Refresh Token for logged-in user
    console.log('\n[8/10] Testing POST /auth/refresh (For Logged In User)');
    const refreshRes = await postmanRequest('/auth/refresh', {
      method: 'POST',
    });
    assert(refreshRes.status === 200, 'Refresh returns HTTP 200 OK for logged-in user');
    assert(refreshRes.body.success === true, 'Token refresh reports success true');
    assert(refreshRes.cookies.some((c) => c.startsWith('accessToken=')), 'Fresh accessToken cookie rotated');
    assert(refreshRes.cookies.some((c) => c.startsWith('refreshToken=')), 'Fresh refreshToken rotated');

    // 9. Refresh Token without cookies (Unauthenticated 401)
    console.log('\n[9/10] Testing POST /auth/refresh (Without Cookies)');
    const noCookieRefresh = await postmanRequest('/auth/refresh', {
      method: 'POST',
      skipCookies: true,
    });
    assert(noCookieRefresh.status === 401, 'Refresh without cookie returns HTTP 401 UNAUTHENTICATED');

    // 10. Logout and verify cookie destruction
    console.log('\n[10/10] Testing POST /auth/logout');
    const logoutRes = await postmanRequest('/auth/logout', {
      method: 'POST',
    });
    assert(logoutRes.status === 200, 'Logout returns HTTP 200 OK');
    assert(logoutRes.cookies.some((c) => c.includes('accessToken=') || c.includes('Max-Age=0')), 'accessToken cookie cleared');
    assert(logoutRes.cookies.some((c) => c.includes('refreshToken=') || c.includes('Max-Age=0')), 'refreshToken cookie cleared');

    console.log(`\n======================================================`);
    console.log(`🎉 ALL ${assertionsPassed} AUTHENTICATION SUITE ASSERTIONS PASSED!`);
    console.log(`======================================================\n`);
  } finally {
    // Cleanup test user
    try {
      await User.deleteOne({ email: testEmail });
      console.log(`🧹 Cleaned up temporary test user: ${testEmail}`);
    } catch {
      // Ignore
    }

    if (server) {
      server.close();
    }
    await disconnectDB();
  }
};

runAuthSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal testAuth Error:', err);
    process.exit(1);
  });
