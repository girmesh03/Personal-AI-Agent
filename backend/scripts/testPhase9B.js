/**
 * @module scripts/testPhase9B
 * @description Dedicated automated integration test suite validating Phase 9B:
 * Multi-Tenant Sovereignty, BYOK API Keys, Telegram Schema Realignment & Zero-Crash Engine.
 *
 * Exercises:
 * 1. User Registration with Smart Auto-Derivation (omitted firstName/lastName).
 * 2. Token & Key Masking (zero secret leakage on API responses & toJSON transforms).
 * 3. Telegram Verification (error handling on invalid token).
 * 4. Telegram Connect (secure persistence & masked response).
 * 5. Telegram Toggle (enable/disable state transitions).
 * 6. Telegram Disconnect (token purge & clean state reset).
 * 7. Conversational Agent share_to_telegram zero-crash handling when unconfigured.
 * 8. BYOK API Keys Patch & Masked Status Projection.
 * 9. Google SSO Initiate & Callback Contract.
 * 10. Cross-platform FFmpeg/FFprobe dynamic installer resolution.
 */

import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { executeAgentTool } from '../src/tools/agentTools.js';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const PORT = 4005;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server;
let savedCookies = [];

const request = (endpoint, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const method = options.method || 'GET';
    const headers = {
      Accept: 'application/json',
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

const runPhase9BSuite = async () => {
  console.log('🚀 Starting Phase 9B Integration & Verification Suite...');
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`📡 Phase 9B Test server listening on ${BASE_URL}`);
  });

  const testEmail1 = `abebe.kebede.phase9b_${Date.now()}@testcorp.com`;
  const testEmail2 = `solomon_${Date.now()}@testcorp.com`;
  const testPassword = 'Password123!Secure';
  let assertionsPassed = 0;
  let testUserId = null;

  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(`❌ FAILED: ${message}`);
    }
    assertionsPassed += 1;
    console.log(`  ✅ [PASS] ${message}`);
  };

  try {
    // --------------------------------------------------------------------------
    // Test 1: User Registration with Smart Auto-Derivation (omitted firstName/lastName)
    // --------------------------------------------------------------------------
    console.log('\n[1/10] Testing Smart Name Auto-Derivation during User Registration');
    const regRes1 = await request('/auth/register', {
      method: 'POST',
      body: {
        email: testEmail1,
        password: testPassword,
        confirmPassword: testPassword,
      },
    });

    assert(regRes1.status === 201, 'Registration returns HTTP 201 CREATED');
    assert(regRes1.body.data?.user?.email === testEmail1, 'Registered email matches');
    assert(regRes1.body.data?.user?.firstName === 'Abebe', 'First name auto-derived as "Abebe" from dot-separated email prefix');
    assert(regRes1.body.data?.user?.lastName === 'Kebede', 'Last name auto-derived as "Kebede" from dot-separated email prefix');

    testUserId = regRes1.body.data?.user?.id || regRes1.body.data?.user?._id;

    // Single token test
    const regRes2 = await request('/auth/register', {
      method: 'POST',
      body: {
        email: testEmail2,
        password: testPassword,
        confirmPassword: testPassword,
      },
    });
    assert(regRes2.status === 201, 'Single token email registration returns HTTP 201');
    assert(regRes2.body.data?.user?.firstName === 'Solomon', 'Single token first name auto-derived as "Solomon"');
    assert(regRes2.body.data?.user?.lastName === 'User', 'Single token last name defaults to "User"');

    // Authenticate primary user session
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: testEmail1, password: testPassword },
    });
    assert(loginRes.status === 200, 'Primary user authenticated with session cookies');

    // --------------------------------------------------------------------------
    // Test 2: Token & Secret Masking Verification (Zero Leakage Invariant)
    // --------------------------------------------------------------------------
    console.log('\n[2/10] Testing Secret Masking on User Profile & Config Endpoints');
    const profileRes = await request('/users/profile');
    assert(profileRes.status === 200, 'GET /users/profile returns HTTP 200');
    assert(profileRes.body.data?.user?.integrations?.telegram?.botToken === undefined, 'Telegram botToken is omitted from GET /users/profile response');
    assert(profileRes.body.data?.user?.settings?.apiKeys?.geminiApiKey === undefined, 'geminiApiKey is omitted from GET /users/profile response');
    assert(profileRes.body.data?.user?.settings?.apiKeys?.hasGeminiKey === false, 'hasGeminiKey flag initialized to false');
    assert(profileRes.body.data?.user?.settings?.apiKeys?.hasAddisKey === false, 'hasAddisKey flag initialized to false');

    // --------------------------------------------------------------------------
    // Test 3: Telegram Bot Token Verification Endpoint (Rejection of Invalid Token)
    // --------------------------------------------------------------------------
    console.log('\n[3/10] Testing POST /users/telegram/verify with Invalid / Empty Token');
    const emptyVerifyRes = await request('/users/telegram/verify', {
      method: 'POST',
      body: {},
    });
    assert(emptyVerifyRes.status === 400, 'Empty bot token returns HTTP 400 BAD REQUEST');

    const fakeVerifyRes = await request('/users/telegram/verify', {
      method: 'POST',
      body: { botToken: '123456789:FakeInvalidTokenThatFailsGetMe' },
    });
    assert(fakeVerifyRes.status === 400, 'Invalid token returns HTTP 400 from Telegram API validation');

    // --------------------------------------------------------------------------
    // Test 4: Telegram Connect Integration (Zero Hardcoding & Secret Masking)
    // --------------------------------------------------------------------------
    console.log('\n[4/10] Testing PATCH /users/telegram/connect');
    const mockBotToken = '987654321:MockValidFormatBotTokenForTesting_xYz123';
    const connectRes = await request('/users/telegram/connect', {
      method: 'PATCH',
      body: {
        botToken: mockBotToken,
        botUsername: 'TestAutonomousAgentBot',
        managementChatId: '1003982938439',
        maintenanceChatId: '-1005556667778',
        generalChatId: '@my_test_channel',
        defaultFormat: 'image',
      },
    });

    assert(connectRes.status === 200, 'PATCH /users/telegram/connect returns HTTP 200');
    assert(connectRes.body.data?.telegram?.connected === true, 'Telegram connection marked connected: true');
    assert(connectRes.body.data?.telegram?.botUsername === 'TestAutonomousAgentBot', 'Telegram botUsername saved');
    assert(connectRes.body.data?.telegram?.managementChatId === '-1001003982938439', 'managementChatId auto-normalized with -100 prefix');
    assert(connectRes.body.data?.telegram?.generalChatId === '@my_test_channel', 'generalChatId preserved public channel handle');
    assert(connectRes.body.data?.telegram?.botToken === undefined, 'botToken is completely scrubbed from connect response');

    // Verify secret is physically present in DB under select: false
    const dbUserWithSecret = await User.findById(testUserId).select('+integrations.telegram.botToken').lean();
    assert(dbUserWithSecret?.integrations?.telegram?.botToken === mockBotToken, 'botToken is securely stored in database under user.integrations.telegram');

    // --------------------------------------------------------------------------
    // Test 5: Telegram Toggle Enable / Disable
    // --------------------------------------------------------------------------
    console.log('\n[5/10] Testing PATCH /users/telegram/toggle');
    const toggleOffRes = await request('/users/telegram/toggle', {
      method: 'PATCH',
      body: { enabled: false },
    });
    assert(toggleOffRes.status === 200, 'Toggle off returns HTTP 200');
    assert(toggleOffRes.body.data?.telegram?.enabled === false, 'Telegram enabled set to false');

    const toggleOnRes = await request('/users/telegram/toggle', {
      method: 'PATCH',
      body: { enabled: true },
    });
    assert(toggleOnRes.status === 200, 'Toggle on returns HTTP 200');
    assert(toggleOnRes.body.data?.telegram?.enabled === true, 'Telegram enabled restored to true');

    // --------------------------------------------------------------------------
    // Test 6: Telegram Disconnect & Secret Purge
    // --------------------------------------------------------------------------
    console.log('\n[6/10] Testing POST /users/telegram/disconnect');
    const disconnectRes = await request('/users/telegram/disconnect', {
      method: 'POST',
    });
    assert(disconnectRes.status === 200, 'Disconnect returns HTTP 200');
    assert(disconnectRes.body.data?.telegram?.connected === false, 'Telegram connected set to false');
    assert(disconnectRes.body.data?.telegram?.botUsername === null, 'Telegram botUsername reset to null');

    // Verify secret and all channel IDs were completely purged from DB
    const dbUserDisconnected = await User.findById(testUserId).select('+integrations.telegram.botToken').lean();
    assert(!dbUserDisconnected?.integrations?.telegram?.botToken, 'botToken is wiped from database upon disconnect');
    assert(dbUserDisconnected?.integrations?.telegram?.managementChatId === null, 'managementChatId is wiped to null upon disconnect');
    assert(dbUserDisconnected?.integrations?.telegram?.maintenanceChatId === null, 'maintenanceChatId is wiped to null upon disconnect');
    assert(dbUserDisconnected?.integrations?.telegram?.generalChatId === null, 'generalChatId is wiped to null upon disconnect');

    // --------------------------------------------------------------------------
    // Test 7: Conversational Agent share_to_telegram Zero-Crash Invariant
    // --------------------------------------------------------------------------
    console.log('\n[7/10] Testing Conversational Agent share_to_telegram Zero-Crash Graceful Handling');
    const toolResult = await executeAgentTool(
      'share_to_telegram',
      { messageText: 'Automated test operational notice' },
      { userId: testUserId }
    );

    assert(toolResult.success === true, 'Agent tool execution completes safely without throwing exceptions');
    assert(toolResult.data?.isConfigured === false, 'Tool identifies Telegram is unconfigured');
    assert(toolResult.data?.actionRequired === 'CONNECT_TELEGRAM_INTEGRATION', 'Action required directs user to configure integration');
    assert(typeof toolResult.data?.message === 'string', 'Tool returns informative guidance message for agent reasoning');

    // --------------------------------------------------------------------------
    // Test 8: Bring-Your-Own-Key (BYOK) API Credentials Configuration
    // --------------------------------------------------------------------------
    console.log('\n[8/10] Testing PATCH /users/api-keys (BYOK Storage & Masked Projection)');
    const fakeGeminiKey = 'AIzaSyA_FakeGeminiApiKeyForAutomatedTesting123';
    const fakeAddisKey = 'addis_ai_live_sk_test9b_00998877';

    const apiKeyRes = await request('/users/api-keys', {
      method: 'PATCH',
      body: {
        geminiApiKey: fakeGeminiKey,
        addisApiKey: fakeAddisKey,
      },
    });

    assert(apiKeyRes.status === 200, 'PATCH /users/api-keys returns HTTP 200');
    assert(apiKeyRes.body.data?.apiKeys?.hasGeminiKey === true, 'hasGeminiKey flag projected as true');
    assert(apiKeyRes.body.data?.apiKeys?.hasAddisKey === true, 'hasAddisKey flag projected as true');
    assert(apiKeyRes.body.data?.apiKeys?.geminiApiKey === undefined, 'geminiApiKey is NOT leaked in API response');
    assert(apiKeyRes.body.data?.apiKeys?.addisApiKey === undefined, 'addisApiKey is NOT leaked in API response');

    // Verify keys in DB under select: false
    const dbUserKeys = await User.findById(testUserId)
      .select('+settings.apiKeys.geminiApiKey +settings.apiKeys.addisApiKey')
      .lean();
    assert(dbUserKeys?.settings?.apiKeys?.geminiApiKey === fakeGeminiKey, 'geminiApiKey is persisted in database');
    assert(dbUserKeys?.settings?.apiKeys?.addisApiKey === fakeAddisKey, 'addisApiKey is persisted in database');

    // --------------------------------------------------------------------------
    // Test 9: Google SSO Initiation & Redirect Contracts (JSON & Browser Modes)
    // --------------------------------------------------------------------------
    console.log('\n[9/10] Testing Google SSO Initiation Route (JSON & Browser Navigation Modes)');
    // 9a: JSON mode for SPA window redirection
    const ssoJsonRes = await request('/auth/google/sso', {
      headers: { Accept: 'application/json' },
    });
    assert(ssoJsonRes.status === 200, 'GET /auth/google/sso (JSON) returns HTTP 200');
    assert(ssoJsonRes.body.success === true, 'JSON response indicates success: true');
    assert(typeof ssoJsonRes.body.url === 'string' && ssoJsonRes.body.url.startsWith('https://accounts.google.com/o/oauth2/v2/auth'), 'JSON response provides valid Google OAuth URL');

    // 9b: Browser navigation mode (HTTP 302)
    const ssoRedirectRes = await request('/auth/google/sso', {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    assert(ssoRedirectRes.status === 302, 'GET /auth/google/sso (HTML) redirects with HTTP 302');
    const redirectLocation = ssoRedirectRes.headers['location'] || '';
    assert(redirectLocation.startsWith('https://accounts.google.com/o/oauth2/v2/auth'), 'Redirects to official Google OAuth 2.0 endpoint');
    assert(redirectLocation.includes('response_type=code'), 'OAuth request specifies response_type=code');
    assert(redirectLocation.includes('scope='), 'OAuth request specifies user scopes');
    assert(redirectLocation.includes('redirect_uri='), 'OAuth request specifies valid redirect_uri');
    assert(redirectLocation.includes('state='), 'OAuth request includes signed state token');

    // 9c: Unified OAuth Dispatcher contract: SSO state on unified /auth/google/callback route
    const ssoCallbackRes = await request('/auth/google/callback?error=access_denied&state=sso', {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    assert(ssoCallbackRes.status === 302, 'GET /auth/google/callback with SSO state redirects with HTTP 302');
    assert(
      (ssoCallbackRes.headers['location'] || '').includes('/login?error=access_denied'),
      'Unified callback dispatcher seamlessly delegates SSO errors to /login'
    );

    // 9d: Direct /auth/google/sso/callback route
    const directSsoCallbackRes = await request('/auth/google/sso/callback?error=access_denied', {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    assert(directSsoCallbackRes.status === 302, 'GET /auth/google/sso/callback redirects with HTTP 302');
    assert(
      (directSsoCallbackRes.headers['location'] || '').includes('/login?error=access_denied'),
      'Direct SSO callback route redirects errors to /login'
    );

    // --------------------------------------------------------------------------
    // Test 10: Dynamic NPM FFmpeg & FFprobe Binary Resolution
    // --------------------------------------------------------------------------
    console.log('\n[10/12] Testing Cross-Platform Dynamic FFmpeg & FFprobe Resolution');
    assert(typeof ffmpegInstaller.path === 'string' && ffmpegInstaller.path.length > 0, '@ffmpeg-installer/ffmpeg resolves a valid binary path');
    assert(typeof ffprobeInstaller.path === 'string' && ffprobeInstaller.path.length > 0, '@ffprobe-installer/ffprobe resolves a valid binary path');
    console.log(`    Resolved ffmpeg: ${ffmpegInstaller.path}`);
    console.log(`    Resolved ffprobe: ${ffprobeInstaller.path}`);

    // --------------------------------------------------------------------------
    // Test 11: Google SSO Password Linking Contract & RangeError Protection
    // --------------------------------------------------------------------------
    console.log('\n[11/12] Testing Google SSO Password Linking Contract (RangeError Prevention)');
    const ssoTestEmail = `sso-test-${Date.now()}@example.com`;
    const ssoUser = await User.create({
      firstName: 'SSO',
      lastName: 'User',
      email: ssoTestEmail,
      password: 'TemporaryRandomPassword123!',
      authProvider: 'google',
      isPasswordSet: false,
    });

    const ssoLoginRes = await request('/auth/login', {
      method: 'POST',
      skipCookies: true,
      body: {
        email: ssoTestEmail,
        password: 'SomeGuessedPassword123!',
      },
    });

    assert(ssoLoginRes.status === 401, 'SSO user password login returns HTTP 401 UNAUTHENTICATED (Zero RangeErrors)');
    assert(ssoLoginRes.body.success === false, 'Response indicates success: false');
    assert(ssoLoginRes.body.errorCode === 'SSO_PASSWORD_NOT_SET', 'Response returns errorCode: SSO_PASSWORD_NOT_SET');
    assert(ssoLoginRes.body.data?.authProvider === 'google', 'Response data identifies authProvider: google');
    assert(typeof ssoLoginRes.body.message === 'string' && ssoLoginRes.body.message.includes('Google Sign-In'), 'Response provides informative guidance to sign in with Google');

    await User.findByIdAndDelete(ssoUser._id);

    // --------------------------------------------------------------------------
    // Test 12: Direct Chat Share to Telegram Contract (/chat/share-telegram)
    // --------------------------------------------------------------------------
    console.log('\n[12/12] Testing POST /chat/share-telegram Pre-flight & Live Dispatch Contract');
    // 12a: When Telegram is disconnected
    const disconnectedShareRes = await request('/chat/share-telegram', {
      method: 'POST',
      body: {
        text: 'Direct broadcast test message',
        targetChannel: 'management',
      },
    });
    assert(disconnectedShareRes.status === 400, 'Share to Telegram when disconnected returns HTTP 400 BAD REQUEST');
    assert(
      (disconnectedShareRes.body.message || '').includes('not connected'),
      'Rejection specifies Telegram integration is not connected'
    );

    // 12b: When Telegram is connected with mock bot token but target channel unconfigured
    await User.findByIdAndUpdate(testUserId, {
      $set: {
        'integrations.telegram.connected': true,
        'integrations.telegram.enabled': true,
        'integrations.telegram.botToken': '123456789:MockBotTokenForChatShare_Test',
        'integrations.telegram.managementChatId': '-1001234567890',
        'integrations.telegram.maintenanceChatId': null,
      },
    });

    const unconfiguredChannelRes = await request('/chat/share-telegram', {
      method: 'POST',
      body: {
        text: 'Direct broadcast test message',
        targetChannel: 'maintenance',
      },
    });
    assert(unconfiguredChannelRes.status === 400, 'Share to unconfigured channel returns HTTP 400 BAD REQUEST');
    assert(
      (unconfiguredChannelRes.body.message || '').includes('does not have a configured Chat ID'),
      'Rejection specifies channel does not have a configured Chat ID'
    );

    // 12c: Missing text validation
    const missingTextRes = await request('/chat/share-telegram', {
      method: 'POST',
      body: {
        text: '',
        targetChannel: 'management',
      },
    });
    assert(missingTextRes.status === 400, 'Share without text returns HTTP 400 BAD REQUEST');

    console.log(`\n======================================================`);
    console.log(`🎉 ALL ${assertionsPassed} PHASE 9B ASSERTIONS PASSED WITH ZERO ERRORS!`);
    console.log(`======================================================\n`);
  } finally {
    try {
      await User.deleteMany({ email: { $in: [testEmail1, testEmail2] } });
      console.log(`🧹 Cleaned up temporary test users.`);
    } catch {
      // Ignore cleanup error
    }

    if (server) {
      server.close();
    }
    await disconnectDB();
  }
};

runPhase9BSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal testPhase9B Error:', err);
    process.exit(1);
  });
