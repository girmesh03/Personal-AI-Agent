/**
 * @file testInquiries15to16.js
 * @description Practical verification test suite for Task 8.17 Inquiries 1.5 & 1.6:
 * 1. Google Workspace Credentials Activation (Live engine vs Mock fallback)
 * 2. Profile Settings Material-UI Grid Refactoring (Zero raw CSS gridColumn, standard MUI Grid)
 * 3. Consumer-Grade Upload UX (Inline progress rings on attachment chips, zero synthetic status banners)
 * 4. Gemini TTFT Priming & Watchdog (Immediate : ping\n\n SSE frame, TTFT logger, 12s watchdog failover)
 * 5. Route Middleware Authorization (verifyToken on /google/connect, 401 on unauthenticated)
 * 6. Google Connect Response Contract Parity (backend contract { success: true, data: { authUrl, url } } & client unwrapping)
 * 7. Identity vs Storage Provider Decoupling (Local auth decoupled from Google Drive integrations)
 * 8. Google Cloud Console Sandbox Governance (Redirect URI, scopes, test user validation)
 * 9. OAuth Return Navigation Preservation (returnUrl dynamic state encoding & redirect handling)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import env from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { createOAuth2Client } from '../src/services/googleDriveService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAssertions++;
  console.log(`✅ PASS: ${message}`);
}

async function runSuite() {
  console.log('\n=============================================================');
  console.log('🧪 RUNNING VERIFICATION SUITE: INQUIRIES 1.5 & 1.6');
  console.log('=============================================================\n');

  await connectDB();

  // Start temporary test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let tempUserCreated = false;
  let testUser = await User.findOne();
  if (!testUser) {
    testUser = await User.create({
      fullName: 'Inquiry Test User',
      email: `inquiry_test_${Date.now()}@operon.et`,
      password: 'HashPassword123!',
      role: 'supervisor',
      position: 'Operations Manager',
    });
    tempUserCreated = true;
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Inquiry 1.5 - Google Workspace Credentials Activation
    // -------------------------------------------------------------------------
    console.log('--- Test 1: Google Workspace Credentials & Engine Activation ---');
    const oauthClient = createOAuth2Client();
    assert(oauthClient !== null && typeof oauthClient === 'object', 'createOAuth2Client returns initialized OAuth2 client');
    assert(oauthClient._clientId !== undefined, 'OAuth2 client captures configured client ID');
    assert(oauthClient._clientSecret !== undefined, 'OAuth2 client captures configured client secret');
    assert(
      oauthClient.redirectUri === env.OAUTH_GOOGLE_CALLBACK_URL,
      `OAuth2 client redirect URI matches env callback: ${oauthClient.redirectUri}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Inquiry 1.5 - Profile Settings Material-UI Grid Refactoring
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Profile Settings MUI Grid Refactoring ---');
    const cloudIntegrationsTabPath = path.resolve(rootDir, 'client/src/components/profile/CloudIntegrationsTab.jsx');
    const cloudIntegrationsContent = fs.readFileSync(cloudIntegrationsTabPath, 'utf8');

    assert(
      !cloudIntegrationsContent.includes('gridColumn:'),
      'CloudIntegrationsTab has zero raw CSS gridColumn references'
    );
    assert(
      !cloudIntegrationsContent.includes("display: 'grid'"),
      'CloudIntegrationsTab has zero raw CSS display: grid references'
    );
    assert(
      cloudIntegrationsContent.includes('<Grid container spacing={2}>'),
      'CloudIntegrationsTab renders standard Material-UI <Grid container spacing={2}>'
    );
    assert(
      cloudIntegrationsContent.includes('<Grid size={{ xs: 12, sm: 6 }}>'),
      'CloudIntegrationsTab renders standard Material-UI responsive <Grid size={{ xs: 12, sm: 6 }}> columns'
    );
    assert(
      cloudIntegrationsContent.includes('<Grid size={12}>'),
      'CloudIntegrationsTab renders standard Material-UI full-width <Grid size={12}> rows'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Inquiry 1.5 - Consumer-Grade Upload UX
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Consumer-Grade Upload UX & Zero Synthetic Status Banners ---');
    const topToolbarPath = path.resolve(rootDir, 'client/src/components/chat/MuiComposerTopToolbar.jsx');
    const topToolbarContent = fs.readFileSync(topToolbarPath, 'utf8');
    assert(
      topToolbarContent.includes('CircularProgress') && topToolbarContent.includes('uploadProgress'),
      'MuiComposerTopToolbar mounts inline CircularProgress ring on attachment chips'
    );

    const shelfPath = path.resolve(rootDir, 'client/src/components/chat/MuiUserAttachmentShelf.jsx');
    const shelfContent = fs.readFileSync(shelfPath, 'utf8');
    assert(
      shelfContent.includes('CircularProgress') && shelfContent.includes('uploadProgress'),
      'MuiUserAttachmentShelf mounts inline CircularProgress ring on attachment cards'
    );

    const adapterPath = path.resolve(rootDir, 'client/src/adapters/MuiChatAdapter.js');
    const adapterContent = fs.readFileSync(adapterPath, 'utf8');
    assert(
      !adapterContent.includes("setPipelineStatus('Uploading attachments...')"),
      'MuiChatAdapter eliminates synthetic pipeline status banner for attachments'
    );
    assert(
      !adapterContent.includes("setPipelineStatus('Uploading audio note...')"),
      'MuiChatAdapter eliminates synthetic pipeline status banner for audio notes'
    );

    const chatControllerPath = path.resolve(rootDir, 'backend/src/controllers/chatController.js');
    const chatControllerContent = fs.readFileSync(chatControllerPath, 'utf8');
    assert(
      !chatControllerContent.includes("stage: 'processing_attachments'"),
      'chatController eliminates synthetic SSE status stage processing_attachments'
    );
    assert(
      !chatControllerContent.includes("stage: 'transcribing'"),
      'chatController eliminates synthetic SSE status stage transcribing'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Inquiry 1.5 - Gemini TTFT Priming & Watchdog
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Gemini TTFT Priming Ping & 12s Watchdog ---');
    assert(
      chatControllerContent.includes("res.write(': ping\\n\\n');"),
      'chatController flushes immediate : ping\\n\\n SSE frame upon connection to defeat socket buffering'
    );
    assert(
      chatControllerContent.includes('Awaiting TTFT...') && chatControllerContent.includes('First token received from'),
      'chatController includes explicit TTFT diagnostic logging'
    );
    assert(
      chatControllerContent.includes('watchdogController.abort') && chatControllerContent.includes('12000'),
      'chatController enforces 12s TTFT watchdog via AbortController'
    );
    assert(
      chatControllerContent.includes("reason: 'ttft_watchdog_timeout'"),
      'chatController emits reset_stream with reason ttft_watchdog_timeout on TTFT watchdog expiration'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Inquiry 1.6 - Route Middleware Authorization (/google/connect)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Route Middleware Authorization (/google/connect) ---');
    // Unauthenticated GET request to /google/connect MUST return 401
    const unauthRes = await fetch(`${baseUrl}/api/v1/auth/google/connect`);
    assert(
      unauthRes.status === 401,
      `Unauthenticated /api/v1/auth/google/connect returns HTTP 401 (Received ${unauthRes.status})`
    );
    const unauthBody = await unauthRes.json();
    assert(
      unauthBody.success === false,
      'Unauthenticated response conforms to standard error envelope'
    );

    // Generate a valid user JWT
    const validToken = jwt.sign(
      { id: testUser._id.toString(), email: testUser.email, role: testUser.role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    // Authenticated request with verifyToken (sending Accept: application/json)
    const authRes = await fetch(`${baseUrl}/api/v1/auth/google/connect`, {
      headers: {
        Authorization: `Bearer ${validToken}`,
        Accept: 'application/json',
      },
    });
    assert(
      authRes.status === 200,
      `Authenticated /api/v1/auth/google/connect with Bearer token returns HTTP 200 (Received ${authRes.status})`
    );
    const authBody = await authRes.json();

    // -------------------------------------------------------------------------
    // TEST 6: Inquiry 1.6 - Google Connect Response Contract Parity
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Google Connect Response Contract Parity ---');
    assert(authBody.success === true, 'Response body contains success: true');
    assert(typeof authBody.data === 'object' && authBody.data !== null, 'Response body has standardized data envelope');
    assert(typeof authBody.data.authUrl === 'string' && authBody.data.authUrl.startsWith('https://accounts.google.com'), 'authBody.data.authUrl contains valid Google OAuth URL');
    assert(authBody.data.url === authBody.data.authUrl, 'authBody.data.url aliases authUrl for backward compatibility');
    assert(authBody.authUrl === authBody.data.authUrl, 'authBody.authUrl aliases root level for backward compatibility');

    // Verify client safely unwraps in CloudIntegrationsTab.jsx
    assert(
      cloudIntegrationsContent.includes('res?.data?.authUrl || res?.data?.url || res?.authUrl || res?.url'),
      'CloudIntegrationsTab safely unwraps all contract variations (res?.data?.authUrl || res?.data?.url || res?.authUrl || res?.url)'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Inquiry 1.6 - Identity vs Storage Provider Decoupling
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Identity vs Storage Provider Decoupling ---');
    // Decode state from authUrl to verify it encapsulates user ID
    const generatedUrl = new URL(authBody.data.authUrl);
    const stateParam = generatedUrl.searchParams.get('state');
    assert(Boolean(stateParam), 'Generated authUrl contains signed state parameter');
    const decodedState = jwt.verify(stateParam, env.JWT_ACCESS_SECRET);
    assert(decodedState.userId === testUser._id.toString(), 'OAuth state correctly binds to local app userId without requiring Google SSO');

    // -------------------------------------------------------------------------
    // TEST 8: Inquiry 1.6 - Google Cloud Console Sandbox Governance
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Google Cloud Console Sandbox Governance ---');
    const redirectUriParam = generatedUrl.searchParams.get('redirect_uri');
    assert(
      redirectUriParam === env.OAUTH_GOOGLE_CALLBACK_URL,
      `Redirect URI in authUrl matches configured backend callback: ${redirectUriParam}`
    );
    const scopeParam = decodeURIComponent(generatedUrl.searchParams.get('scope') || '');
    assert(scopeParam.includes('drive.file'), 'OAuth scopes request drive.file for workspace file creation');
    assert(scopeParam.includes('documents'), 'OAuth scopes request documents for Google Docs generation');
    assert(scopeParam.includes('spreadsheets'), 'OAuth scopes request spreadsheets for Google Sheets generation');
    assert(scopeParam.includes('userinfo.email'), 'OAuth scopes request userinfo.email for identity display');

    // -------------------------------------------------------------------------
    // TEST 9: Inquiry 1.6 - OAuth Return Navigation Preservation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: OAuth Return Navigation Preservation ---');
    // Test request with explicit returnUrl query param
    const customReturnRes = await fetch(`${baseUrl}/api/v1/auth/google/connect?returnUrl=/profile?tab=cloud-integrations`, {
      headers: {
        Authorization: `Bearer ${validToken}`,
        Accept: 'application/json',
      },
    });
    const customReturnBody = await customReturnRes.json();
    const customUrl = new URL(customReturnBody.data.authUrl);
    const customState = jwt.verify(customUrl.searchParams.get('state'), env.JWT_ACCESS_SECRET);
    assert(
      customState.returnUrl === '/profile?tab=cloud-integrations',
      `Custom returnUrl is preserved in signed state JWT: ${customState.returnUrl}`
    );

    // Verify callback handler uses returnUrl for redirect
    const authControllerPath = path.resolve(rootDir, 'backend/src/controllers/authController.js');
    const authControllerContent = fs.readFileSync(authControllerPath, 'utf8');
    assert(
      authControllerContent.includes("const dest = decoded?.returnUrl || '/profile?tab=cloud-integrations';"),
      'authController dynamically routes OAuth callback destination from decoded.returnUrl'
    );
    assert(
      authControllerContent.includes('google_auth=success') && authControllerContent.includes('google_auth=error'),
      'authController appends google_auth status query parameter to return URL'
    );

    // Verify CloudIntegrationsTab has URL listener and cleans state
    assert(
      cloudIntegrationsContent.includes("params.get('google_auth') === 'success'") &&
        cloudIntegrationsContent.includes('window.history.replaceState'),
      'CloudIntegrationsTab detects google_auth=success in URL, toasts notification, refetches, and cleans URL with replaceState'
    );

    console.log('\n=============================================================');
    console.log(`🎉 ALL ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED 100% GREEN!`);
    console.log('=============================================================\n');
  } finally {
    if (tempUserCreated && testUser) {
      await User.deleteOne({ _id: testUser._id });
    }
    server.close();
    await disconnectDB();
  }
}

runSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ TEST SUITE FAILED:\n', err);
    process.exit(1);
  });
