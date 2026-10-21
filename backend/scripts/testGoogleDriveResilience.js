/**
 * @file testGoogleDriveResilience.js
 * @description Comprehensive automated test suite verifying Google Drive resilience,
 * enable/disable toggle settings, non-catastrophic error fallbacks, and Profile UI responsiveness.
 */

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { executeAgentTool } from '../src/tools/agentTools.js';
import { generateDocumentFile } from '../src/services/documentGenerationService.js';
import {
  manageGoogleDrive,
  createCloudDocument,
  connectMockGoogleDrive,
  disconnectGoogleDrive,
  getValidGoogleClient,
} from '../src/services/googleDriveService.js';
import { assembleSystemPrompt } from '../src/utils/promptAssembler.js';

const PORT = 4009;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server;
let testUser;
let activeCookies = [];
let passedAssertions = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
  passedAssertions++;
  console.log(`  ✅ [ASSERT] ${message}`);
}

async function request(method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(`${BASE_URL}${urlPath}`);
    const reqHeaders = { ...headers };

    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    if (activeCookies.length > 0) {
      reqHeaders['Cookie'] = activeCookies.join('; ');
    }

    const options = {
      method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      headers: reqHeaders,
    };

    const req = http.request(options, (res) => {
      if (res.headers['set-cookie']) {
        activeCookies = res.headers['set-cookie'].map((c) => c.split(';')[0]);
      }
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('🧪 RUNNING GOOGLE DRIVE RESILIENCE & ENABLE/DISABLE SUITE');
  console.log('=============================================================\n');

  await connectDB();

  // Clean test fixtures
  await User.deleteMany({ email: 'resilience-test@example.com' });

  // 1. Create authenticated test supervisor
  testUser = await User.create({
    firstName: 'Resilience',
    lastName: 'Tester',
    email: 'resilience-test@example.com',
    password: 'Password123!',
    position: 'Area Supervisor',
  });

  server = app.listen(PORT);
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Log in
  const loginRes = await request('POST', '/auth/login', {
    body: { email: 'resilience-test@example.com', password: 'Password123!' },
  });
  assert(loginRes.status === 200, 'Test supervisor authenticated successfully');

  // --------------------------------------------------------------------------
  console.log('\n--- Test 1: Disconnected Google Drive Status & Error Containment ---');
  // --------------------------------------------------------------------------
  const statusRes1 = await request('GET', '/auth/google/status');
  assert(statusRes1.status === 200, 'Status endpoint returns 200');
  assert(statusRes1.data.data.connected === false, 'Initially connected is false');
  assert(statusRes1.data.data.enabled === true, 'Default enabled is true');

  // Calling manage_google_drive when disconnected must fail with clean error, NOT crash
  const toolResult1 = await executeAgentTool('manage_google_drive', { action: 'list' }, { userId: testUser._id });
  assert(toolResult1.success === false, 'manage_google_drive returns success: false when disconnected');
  assert(toolResult1.error.includes('Google Drive is not connected'), 'Error message clearly indicates disconnected state');

  // Calling create_cloud_document when disconnected must fail cleanly
  const toolResult2 = await executeAgentTool(
    'create_cloud_document',
    { type: 'doc', title: 'Test Audit Doc' },
    { userId: testUser._id }
  );
  assert(toolResult2.success === false, 'create_cloud_document returns success: false when disconnected');
  assert(toolResult2.error.includes('Google Drive is not connected'), 'Error message guides user to connect in Settings');

  // Document generation with destination: 'google_drive' when disconnected must gracefully fall back to download
  const docResult1 = await generateDocumentFile(testUser._id, {
    format: 'pdf',
    title: 'Operational Audit Summary',
    destination: 'google_drive',
    content: 'All restaurant operations normal.',
  });
  assert(docResult1.success === true, 'generateDocumentFile succeeded despite disconnected Drive');
  assert(docResult1.destination === 'download', 'Fell back gracefully to destination: download');
  assert(Boolean(docResult1.downloadUrl), 'Provided valid direct downloadUrl');
  assert(Boolean(docResult1.googleDriveError), 'Recorded googleDriveError explanation without throwing');

  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Connecting Google Drive & Verifying Active Status ---');
  // --------------------------------------------------------------------------
  await connectMockGoogleDrive(testUser._id, 'resilience-supervisor@gmail.com');
  const statusRes2 = await request('GET', '/auth/google/status');
  assert(statusRes2.data.data.connected === true, 'Drive is now connected');
  assert(statusRes2.data.data.enabled === true, 'Drive is enabled by default');
  assert(statusRes2.data.data.email === 'resilience-supervisor@gmail.com', 'Connected email matches');

  // When connected and enabled, promptAssembler reflects ACTIVE status
  const promptActive = await assembleSystemPrompt({ user: await User.findById(testUser._id) });
  assert(promptActive.includes('GOOGLE WORKSPACE INTEGRATION STATUS: ACTIVE & CONNECTED'), 'System prompt reflects ACTIVE status');
  assert(promptActive.includes('resilience-supervisor@gmail.com'), 'System prompt includes connected account email');

  // Live tool execution succeeds when connected & enabled
  const toolResult3 = await executeAgentTool('manage_google_drive', { action: 'list' }, { userId: testUser._id });
  assert(toolResult3.success === true, 'manage_google_drive succeeds when connected and active');
  assert(Array.isArray(toolResult3.data.files), 'Returns files array');

  // Cloud document creation succeeds
  const toolResult4 = await executeAgentTool(
    'create_cloud_document',
    { type: 'doc', title: 'Weekly Operational Inspection', content: 'Inspected kitchen and chillers.' },
    { userId: testUser._id }
  );
  assert(toolResult4.success === true, 'create_cloud_document succeeds when connected and active');
  assert(Boolean(toolResult4.data.webViewLink), 'Returned valid webViewLink');

  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Enable/Disable Toggle Settings API (/google/toggle) ---');
  // --------------------------------------------------------------------------
  // Toggle to disabled
  const toggleRes1 = await request('POST', '/auth/google/toggle', { body: { enabled: false } });
  assert(toggleRes1.status === 200, 'POST /auth/google/toggle returned 200');
  assert(toggleRes1.data.data.enabled === false, 'enabled set to false');
  assert(toggleRes1.data.data.connected === true, 'connected remains true (OAuth preserved)');

  // Verify via status endpoint
  const statusRes3 = await request('GET', '/auth/google/status');
  assert(statusRes3.data.data.enabled === false, 'Status endpoint reports enabled: false');

  // When connected but disabled, promptAssembler informs agent access is PAUSED
  const promptDisabled = await assembleSystemPrompt({ user: await User.findById(testUser._id) });
  assert(promptDisabled.includes('TEMPORARILY DISABLED BY USER IN SETTINGS'), 'System prompt reflects DISABLED status');
  assert(promptDisabled.includes('DO NOT invoke manage_google_drive'), 'System prompt instructs model not to invoke Drive tools');

  // Calling tools while disabled returns clean disabled error without crashing
  const toolResult5 = await executeAgentTool('manage_google_drive', { action: 'list' }, { userId: testUser._id });
  assert(toolResult5.success === false, 'manage_google_drive blocked when disabled');
  assert(toolResult5.error.includes('temporarily disabled in your Settings'), 'Clear explanation that integration is paused');

  const toolResult6 = await executeAgentTool(
    'create_cloud_document',
    { type: 'sheet', title: 'Food Cost Calculations' },
    { userId: testUser._id }
  );
  assert(toolResult6.success === false, 'create_cloud_document blocked when disabled');
  assert(toolResult6.error.includes('temporarily disabled in your Settings'), 'Clear explanation for document tool');

  // Document generation with destination: 'google_drive' when disabled falls back smoothly to download
  const docResult2 = await generateDocumentFile(testUser._id, {
    format: 'xlsx',
    title: 'Food Cost Analysis',
    destination: 'google_drive',
    data: [{ item: 'Beef', cost: 120 }],
  });
  assert(docResult2.success === true, 'generateDocumentFile succeeded despite disabled Drive');
  assert(docResult2.destination === 'download', 'Fell back gracefully to destination: download');
  assert(Boolean(docResult2.downloadUrl), 'Provided valid direct downloadUrl');
  assert(docResult2.googleDriveError.includes('temporarily disabled'), 'googleDriveError details captured');

  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Re-enabling Google Drive Integration ---');
  // --------------------------------------------------------------------------
  // Toggle back to enabled
  const toggleRes2 = await request('POST', '/auth/google/toggle', { body: { enabled: true } });
  assert(toggleRes2.status === 200, 'Re-enabled returned 200');
  assert(toggleRes2.data.data.enabled === true, 'enabled set back to true');

  // Calling tool succeeds again
  const toolResult7 = await executeAgentTool('manage_google_drive', { action: 'list' }, { userId: testUser._id });
  assert(toolResult7.success === true, 'manage_google_drive operational again after re-enabling');

  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Autonomous Settings Toggle via update_user_settings ---');
  // --------------------------------------------------------------------------
  const updateSettingsRes = await executeAgentTool(
    'update_user_settings',
    { googleDriveEnabled: false },
    { userId: testUser._id }
  );
  assert(updateSettingsRes.success === true, 'update_user_settings executed successfully');
  assert(updateSettingsRes.data.googleDrive.enabled === false, 'update_user_settings set googleDrive.enabled to false');

  const getSettingsRes = await executeAgentTool('get_user_settings', { section: 'googledrive' }, { userId: testUser._id });
  assert(getSettingsRes.success === true, 'get_user_settings executed successfully');
  assert(getSettingsRes.data.googleDrive.enabled === false, 'get_user_settings returns googleDrive.enabled: false');

  // Re-enable via update_user_settings
  await executeAgentTool('update_user_settings', { googleDriveEnabled: true }, { userId: testUser._id });

  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Responsive UI Layout Verification ---');
  // --------------------------------------------------------------------------
  const profileSrc = fs.readFileSync(path.resolve(__dirname, '../../client/src/pages/Profile.jsx'), 'utf-8');
  assert(profileSrc.includes("display: 'flex', flexWrap: 'wrap'"), 'Profile.jsx user header chips wrap on mobile viewports');
  assert(profileSrc.includes('variant="scrollable"'), 'Profile.jsx tabs use variant="scrollable"');
  assert(profileSrc.includes('allowScrollButtonsMobile'), 'Profile.jsx tabs enable scroll buttons on mobile');

  const cloudTabSrc = fs.readFileSync(
    path.resolve(__dirname, '../../client/src/components/profile/CloudIntegrationsTab.jsx'),
    'utf-8'
  );
  assert(
    cloudTabSrc.includes("display: 'flex'") && cloudTabSrc.includes("flexWrap: 'wrap'"),
    'CloudIntegrationsTab.jsx uses display: flex and flexWrap: wrap'
  );
  assert(cloudTabSrc.includes("maxWidth: '100%'"), 'Active permissions chips have maxWidth: 100% to prevent overflow');
  assert(cloudTabSrc.includes("whiteSpace: 'normal'"), 'Active permissions chips support multi-line wrap');
  assert(cloudTabSrc.includes('useToggleGoogleDriveMutation'), 'CloudIntegrationsTab.jsx connects to useToggleGoogleDriveMutation');
  assert(cloudTabSrc.includes('handleToggleEnabled'), 'CloudIntegrationsTab.jsx provides handleToggleEnabled');
  assert(cloudTabSrc.includes("wordBreak: 'break-all'"), 'Account email has wordBreak: break-all');

  // Clean test fixtures
  await User.deleteMany({ email: 'resilience-test@example.com' });
  await disconnectDB();
  server.close();

  console.log('\n=============================================================');
  console.log(`🎉 ALL ${passedAssertions} ASSERTIONS PASSED 100% GREEN!`);
  console.log('=============================================================\n');
}

runTests().catch((err) => {
  console.error('\n💥 TEST FAILED:', err);
  if (server) server.close();
  disconnectDB().finally(() => process.exit(1));
});
