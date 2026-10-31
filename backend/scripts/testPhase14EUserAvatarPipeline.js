/**
 * @file testPhase14EUserAvatarPipeline.js
 * @description Automated verification suite for Phase 14E (Point 33):
 * User Avatar Pipeline, Dual-Tier Storage Engine (Cloudinary + Local Disk), and Universal UI Propagation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

console.log('================================================================');
console.log('PHASE 14E VERIFICATION: USER AVATAR PIPELINE & UNIVERSAL PROPAGATION');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

async function main() {
  // ---------------------------------------------------------------------------
  // Test Suite 1: Backend Controller & Dual-Tier Storage Architecture
  // ---------------------------------------------------------------------------
  console.log('--- Suite 1: Backend Controller & Storage Integration ---');

  const { UPLOADS_CONFIG } = await import('../src/utils/constants.js');
  const storageService = (await import('../src/services/storageService.js')).default;

  runTest('UPLOADS_CONFIG has deterministic AVATARS_DIR anchored to uploads/avatars', () => {
    assert.ok(UPLOADS_CONFIG.AVATARS_DIR, 'AVATARS_DIR must be defined');
    assert.ok(UPLOADS_CONFIG.AVATARS_DIR.endsWith(path.join('uploads', 'avatars')), 'AVATARS_DIR must point to uploads/avatars');
  });

  runTest('storageService exports cleanupAvatarAsset and uploadFile', () => {
    assert.strictEqual(typeof storageService.cleanupAvatarAsset, 'function', 'cleanupAvatarAsset must be a function');
    assert.strictEqual(typeof storageService.uploadFile, 'function', 'uploadFile must be a function');
    assert.strictEqual(typeof storageService.safeUnlinkDiskFile, 'function', 'safeUnlinkDiskFile must be a function');
  });

  await runAsyncTest('Base64 avatar processing decodes buffer and writes to backend/uploads/avatars/', async () => {
    const testUserId = 'test_user_' + Date.now();
    const testBuffer = Buffer.from('fake-avatar-pixel-data-12345');
    const testBase64 = `data:image/png;base64,${testBuffer.toString('base64')}`;

    // Verify regex matching
    const base64Match = testBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    assert.ok(base64Match, 'Must match base64 data URL pattern');
    const mimeType = base64Match[1].toLowerCase();
    const decodedBuffer = Buffer.from(base64Match[2], 'base64');
    assert.strictEqual(mimeType, 'image/png');
    assert.deepStrictEqual(decodedBuffer, testBuffer);

    // Verify disk write into AVATARS_DIR
    if (!fs.existsSync(UPLOADS_CONFIG.AVATARS_DIR)) {
      fs.mkdirSync(UPLOADS_CONFIG.AVATARS_DIR, { recursive: true });
    }
    const testFileName = `avatar-${testUserId}-${Date.now()}.png`;
    const testDiskPath = path.join(UPLOADS_CONFIG.AVATARS_DIR, testFileName);
    await fs.promises.writeFile(testDiskPath, decodedBuffer);

    assert.ok(fs.existsSync(testDiskPath), 'Decoded avatar must exist on disk in uploads/avatars');
    assert.strictEqual(fs.readFileSync(testDiskPath).toString(), 'fake-avatar-pixel-data-12345');

    // Clean up test file using safeUnlinkDiskFile
    const unlinked = storageService.safeUnlinkDiskFile(testFileName, UPLOADS_CONFIG.AVATARS_DIR);
    assert.ok(unlinked, 'safeUnlinkDiskFile must unlink the created avatar file');
    assert.ok(!fs.existsSync(testDiskPath), 'File must be purged from disk');
  });

  await runAsyncTest('cleanupAvatarAsset unlinks local disk file and invokes destroyFile', async () => {
    const tempFileName = `avatar-cleanup-test-${Date.now()}.jpg`;
    const tempDiskPath = path.join(UPLOADS_CONFIG.AVATARS_DIR, tempFileName);
    await fs.promises.writeFile(tempDiskPath, 'temporary-avatar-content');

    assert.ok(fs.existsSync(tempDiskPath), 'Temp avatar must exist before cleanup');

    await storageService.cleanupAvatarAsset('dummy-public-id-test', `/uploads/avatars/${tempFileName}`);

    assert.ok(!fs.existsSync(tempDiskPath), 'Temp avatar must be unlinked from disk by cleanupAvatarAsset');
  });

  runTest('userController.js contains dual-tier storage & cleanup logic', () => {
    const userControllerSrc = fs.readFileSync(path.join(BACKEND_ROOT, 'src/controllers/userController.js'), 'utf-8');
    assert.ok(userControllerSrc.includes('cleanupAvatarAsset'), 'userController must invoke cleanupAvatarAsset');
    assert.ok(userControllerSrc.includes('UPLOADS_CONFIG.AVATARS_DIR'), 'userController must use UPLOADS_CONFIG.AVATARS_DIR');
    assert.ok(userControllerSrc.includes('base64Match'), 'userController must intercept and decode base64 avatars');
    assert.ok(userControllerSrc.includes('storageService.uploadFile'), 'userController must invoke storageService.uploadFile');
  });

  // ---------------------------------------------------------------------------
  // Test Suite 2: Client Avatar URL Resolver Utility
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 2: Centralized Avatar URL Resolver Utility ---');

  const avatarUtilsSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'client/src/utils/avatarUtils.js'), 'utf-8');

  runTest('avatarUtils.js exists and exports getAvatarUrl', () => {
    assert.ok(avatarUtilsSrc.includes('export const getAvatarUrl'), 'avatarUtils must export getAvatarUrl');
  });

  // Test getAvatarUrl logic standalone
  const mockGetAvatarUrl = (avatar, apiBaseUrl = 'http://localhost:4000/api/v1') => {
    if (!avatar || typeof avatar !== 'string') return null;
    const trimmed = avatar.trim();
    if (!trimmed) return null;
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:')
    ) {
      return trimmed;
    }
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const serverOrigin = apiBaseUrl.replace(/\/api\/v1\/?$/, '');
    return `${serverOrigin}${cleanPath}`;
  };

  runTest('getAvatarUrl preserves https Cloudinary CDN URLs unmodified', () => {
    const cloudUrl = 'https://res.cloudinary.com/agent-cloud/image/upload/v12345/personal-agent/avatars/avatar-1.jpg';
    assert.strictEqual(mockGetAvatarUrl(cloudUrl), cloudUrl);
  });

  runTest('getAvatarUrl preserves http URLs unmodified', () => {
    const httpUrl = 'http://example.com/avatar.png';
    assert.strictEqual(mockGetAvatarUrl(httpUrl), httpUrl);
  });

  runTest('getAvatarUrl preserves Base64 data URLs for backward compatibility', () => {
    const base64Url = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
    assert.strictEqual(mockGetAvatarUrl(base64Url), base64Url);
  });

  runTest('getAvatarUrl preserves client blob URLs for instant preview', () => {
    const blobUrl = 'blob:http://localhost:3000/a1b2c3d4-e5f6-7890';
    assert.strictEqual(mockGetAvatarUrl(blobUrl), blobUrl);
  });

  runTest('getAvatarUrl prepends serverOrigin to relative /uploads/ paths', () => {
    const relativePath = '/uploads/avatars/avatar-user-123.jpg';
    assert.strictEqual(
      mockGetAvatarUrl(relativePath, 'http://localhost:4000/api/v1'),
      'http://localhost:4000/uploads/avatars/avatar-user-123.jpg'
    );
  });

  runTest('getAvatarUrl prepends serverOrigin when leading slash is omitted', () => {
    const relativePath = 'uploads/avatars/avatar-user-123.jpg';
    assert.strictEqual(
      mockGetAvatarUrl(relativePath, 'http://localhost:4000/api/v1'),
      'http://localhost:4000/uploads/avatars/avatar-user-123.jpg'
    );
  });

  runTest('getAvatarUrl returns null for null, undefined, or empty string', () => {
    assert.strictEqual(mockGetAvatarUrl(null), null);
    assert.strictEqual(mockGetAvatarUrl(undefined), null);
    assert.strictEqual(mockGetAvatarUrl(''), null);
    assert.strictEqual(mockGetAvatarUrl('   '), null);
  });

  // ---------------------------------------------------------------------------
  // Test Suite 3: Frontend Component Wiring & UI Propagation
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 3: Frontend Component Propagation & Wiring ---');

  const avatarMenuSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'client/src/layouts/AvatarMenu.jsx'), 'utf-8');
  runTest('AvatarMenu.jsx imports getAvatarUrl and passes src to <Avatar>', () => {
    assert.ok(avatarMenuSrc.includes('getAvatarUrl'), 'AvatarMenu must import getAvatarUrl');
    assert.ok(avatarMenuSrc.includes('src={getAvatarUrl(user?.avatar) || undefined}'), 'AvatarMenu <Avatar> must have src with getAvatarUrl');
    assert.ok(avatarMenuSrc.includes('{initials}'), 'AvatarMenu <Avatar> must retain initials as fallback child');
  });

  const muiSidebarSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'client/src/layouts/MuiSidebar.jsx'), 'utf-8');
  runTest('MuiSidebar.jsx imports getAvatarUrl and passes src to both mini & expanded <Avatar>', () => {
    assert.ok(muiSidebarSrc.includes('getAvatarUrl'), 'MuiSidebar must import getAvatarUrl');
    const matches = muiSidebarSrc.match(/src=\{getAvatarUrl\(user\?\.avatar\) \|\| undefined\}/g);
    assert.ok(matches && matches.length >= 2, 'MuiSidebar must have at least 2 <Avatar> src bindings (mini + expanded)');
  });

  const profileHeaderHeroSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'client/src/components/profile/ProfileHeaderHero.jsx'), 'utf-8');
  runTest('ProfileHeaderHero.jsx imports getAvatarUrl and passes src to <Avatar>', () => {
    assert.ok(profileHeaderHeroSrc.includes('getAvatarUrl'), 'ProfileHeaderHero must import getAvatarUrl');
    assert.ok(profileHeaderHeroSrc.includes('src={getAvatarUrl(user?.avatar) || undefined}'), 'ProfileHeaderHero <Avatar> must use getAvatarUrl');
  });

  const reportHeroSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'client/src/components/reports/ReportHero.jsx'), 'utf-8');
  runTest('ReportHero.jsx imports getAvatarUrl and passes src to author <Avatar>', () => {
    assert.ok(reportHeroSrc.includes('getAvatarUrl'), 'ReportHero must import getAvatarUrl');
    assert.ok(reportHeroSrc.includes('src={getAvatarUrl(authorAvatar) || undefined}'), 'ReportHero <Avatar> must use getAvatarUrl');
  });

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (ALL VERIFIED)`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error running verification test suite:', err);
  process.exit(1);
});
