/**
 * @module scripts/testUsers
 * @description Dedicated automated HTTP test suite exercising user domain endpoints like Postman.
 * Validates profile retrieval, /me alias, profile updates, unique email conflict, forbidden field injection rejection,
 * dedicated avatar patch/delete, and password updates.
 */

import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';

const PORT = 4002;
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
 * Executes Postman-style users domain integration test suite.
 */
const runUsersSuite = async () => {
  console.log('🚀 Starting Postman-style Users Suite (testUsers.js)...');
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`📡 Test server listening on ${BASE_URL}`);
  });

  const testEmail1 = `user_suite_1_${Date.now()}@enjoyburger.et`;
  const testEmail2 = `user_suite_2_${Date.now()}@enjoyburger.et`;
  const initialPassword = 'ValidPassword123!';
  const updatedPassword = 'NewPassword456!';
  let assertionsPassed = 0;

  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(`❌ FAILED: ${message}`);
    }
    assertionsPassed += 1;
    console.log(`  ✅ [PASS] ${message}`);
  };

  try {
    // Setup: Create two users for collision testing and log in as user 1
    console.log('\n[Setup] Registering primary test user and secondary test user');
    await postmanRequest('/auth/register', {
      method: 'POST',
      body: { email: testEmail1, password: initialPassword },
    });
    await postmanRequest('/auth/register', {
      method: 'POST',
      body: { email: testEmail2, password: initialPassword },
    });

    const loginRes = await postmanRequest('/auth/login', {
      method: 'POST',
      body: { email: testEmail1, password: initialPassword },
    });
    assert(loginRes.status === 200, 'Primary user authenticated with session cookies');

    // 1. Get user profile
    console.log('\n[1/10] Testing GET /users/profile');
    const profileRes = await postmanRequest('/users/profile');
    assert(profileRes.status === 200, 'Profile retrieval returns HTTP 200 OK');
    assert(profileRes.body.data?.user?.email === testEmail1, 'Profile email matches active session');
    assert(profileRes.body.data?.user?.fullName !== undefined, 'Virtual fullName serialized');

    // 2. Get user profile alias (/users/me)
    console.log('\n[2/10] Testing GET /users/me (Profile Alias)');
    const meRes = await postmanRequest('/users/me');
    assert(meRes.status === 200, '/users/me returns HTTP 200 OK');
    assert(meRes.body.data?.user?.email === testEmail1, '/users/me matches active user');

    // 3. Update profile names and position
    console.log('\n[3/10] Testing PATCH /users/profile');
    const updateRes = await postmanRequest('/users/profile', {
      method: 'PATCH',
      body: {
        firstName: 'Solomon',
        lastName: 'Alemu',
        position: 'Lead Area Supervisor',
      },
    });
    assert(updateRes.status === 200, 'Profile update returns HTTP 200 OK');
    assert(updateRes.body.data?.user?.firstName === 'Solomon', 'firstName updated');
    assert(updateRes.body.data?.user?.lastName === 'Alemu', 'lastName updated');
    assert(updateRes.body.data?.user?.fullName === 'Solomon Alemu', 'fullName re-derived');
    assert(updateRes.body.data?.user?.position === 'Lead Area Supervisor', 'position updated');

    // 4. Update profile email collision (409)
    console.log('\n[4/10] Testing PATCH /users/profile (Email Conflict Collision)');
    const collideRes = await postmanRequest('/users/profile', {
      method: 'PATCH',
      body: { email: testEmail2 },
    });
    assert(collideRes.status === 409, 'Colliding email update rejected with HTTP 409 CONFLICT');

    // 5. Update profile rejecting forbidden role injection (422)
    console.log('\n[5/10] Testing PATCH /users/profile (Reject Forbidden Role/Archived Injection)');
    const forbiddenRes = await postmanRequest('/users/profile', {
      method: 'PATCH',
      body: { role: 'admin', isArchived: true },
    });
    assert(forbiddenRes.status === 422, 'Injected forbidden role rejected with HTTP 422');

    // 6. Dedicated avatar update
    console.log('\n[6/10] Testing PATCH /users/avatar');
    const avatarPatch = await postmanRequest('/users/avatar', {
      method: 'PATCH',
      body: { avatar: 'https://cdn.enjoyburger.et/avatars/solomon.jpg' },
    });
    assert(avatarPatch.status === 200, 'Avatar update returns HTTP 200 OK');
    assert(avatarPatch.body.data?.user?.avatar === 'https://cdn.enjoyburger.et/avatars/solomon.jpg', 'Avatar URL persisted');

    // 7. Dedicated avatar delete
    console.log('\n[7/10] Testing DELETE /users/avatar');
    const avatarDelete = await postmanRequest('/users/avatar', {
      method: 'DELETE',
    });
    assert(avatarDelete.status === 200, 'Avatar removal returns HTTP 200 OK');
    assert(avatarDelete.body.data?.user?.avatar === null, 'Avatar reset to null');

    // 8. Update password with wrong current password (401)
    console.log('\n[8/10] Testing PATCH /users/password (Wrong Current Password)');
    const badPwd = await postmanRequest('/users/password', {
      method: 'PATCH',
      body: {
        currentPassword: 'WrongPassword999!',
        newPassword: updatedPassword,
        confirmNewPassword: updatedPassword,
      },
    });
    assert(badPwd.status === 401, 'Incorrect current password rejected with HTTP 401 UNAUTHENTICATED');

    // 9. Update password valid
    console.log('\n[9/10] Testing PATCH /users/password (Valid Update)');
    const goodPwd = await postmanRequest('/users/password', {
      method: 'PATCH',
      body: {
        currentPassword: initialPassword,
        newPassword: updatedPassword,
        confirmNewPassword: updatedPassword,
      },
    });
    assert(goodPwd.status === 200, 'Password updated successfully with HTTP 200 OK');

    // 10. Login with new password to verify persistence
    console.log('\n[10/10] Verifying Login With New Password');
    const newLoginRes = await postmanRequest('/auth/login', {
      method: 'POST',
      body: { email: testEmail1, password: updatedPassword },
    });
    assert(newLoginRes.status === 200, 'Login succeeded with newly updated password');

    console.log(`\n======================================================`);
    console.log(`🎉 ALL ${assertionsPassed} USERS DOMAIN SUITE ASSERTIONS PASSED!`);
    console.log(`======================================================\n`);
  } finally {
    try {
      await User.deleteMany({ email: { $in: [testEmail1, testEmail2] } });
      console.log(`🧹 Cleaned up temporary test users.`);
    } catch {
      // Ignore
    }

    if (server) {
      server.close();
    }
    await disconnectDB();
  }
};

runUsersSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal testUsers Error:', err);
    process.exit(1);
  });
