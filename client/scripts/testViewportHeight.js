/* global process */
/**
 * @file testViewportHeight.js
 * @description Automated verification test for Phase 14D:
 * Multi-device PWA WebAPK Standalone Installation Engine & 100dvh Viewport Parity.
 * Asserts W3C Web App Manifest presence, standalone display mode, high-res PWA icon assets,
 * service worker registration, clean CSS baseline in AppTheme, and 100dvh AppShell binding.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

function runTest() {
  console.log('='.repeat(80));
  console.log('PHASE 14D: PWA WEBAPK STANDALONE & 100DVH VIEWPORT VERIFICATION');
  console.log('='.repeat(80));

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // 1. Verify client/index.html contains complete PWA metadata and manifest link
  test('client/index.html contains complete PWA standalone metadata, theme-color, and manifest link', () => {
    const htmlPath = path.join(CLIENT_ROOT, 'index.html');
    assert.ok(fs.existsSync(htmlPath), 'index.html must exist');
    const content = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(content.includes('<link rel="manifest" href="/manifest.json" />'), 'Must link /manifest.json');
    assert.ok(content.includes('<meta name="theme-color" content="#090d16" />'), 'Must define theme-color');
    assert.ok(content.includes('<meta name="mobile-web-app-capable" content="yes" />'), 'Must define mobile-web-app-capable');
    assert.ok(content.includes('<meta name="apple-mobile-web-app-capable" content="yes" />'), 'Must define apple-mobile-web-app-capable');
    assert.ok(content.includes('viewport-fit=cover'), 'Must include viewport-fit=cover in viewport meta tag');
    assert.ok(!content.includes("document.documentElement.style.setProperty('--app-height'"), 'Must not have premature inline height lock in head');
  });

  // 2. Verify client/public/manifest.json exists and specifies display: standalone with icons
  test('client/public/manifest.json exists with display: standalone and multi-resolution icons', () => {
    const manifestPath = path.join(CLIENT_ROOT, 'public/manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);

    assert.strictEqual(manifest.display, 'standalone', 'Display mode must be standalone');
    assert.ok(manifest.display_override.includes('standalone'), 'display_override must include standalone');
    assert.strictEqual(manifest.start_url, '/', 'start_url must be /');
    assert.strictEqual(manifest.theme_color, '#090d16', 'theme_color must match dark brand theme');
    assert.strictEqual(manifest.background_color, '#090d16', 'background_color must match dark brand theme');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'Must define at least 3 icons');
    assert.ok(manifest.icons.some((i) => i.sizes === '192x192'), 'Must include 192x192 icon');
    assert.ok(manifest.icons.some((i) => i.sizes === '512x512'), 'Must include 512x512 icon');
    assert.ok(manifest.icons.some((i) => i.purpose && i.purpose.includes('maskable')), 'Must include maskable icon');
  });

  // 3. Verify all PWA icon assets exist on disk in client/public/
  test('PWA icon assets (192, 512, maskable, apple-touch-icon) exist on disk with valid file size', () => {
    const icons = [
      'public/pwa-192x192.png',
      'public/pwa-512x512.png',
      'public/pwa-maskable-512x512.png',
      'public/apple-touch-icon.png',
    ];

    for (const icon of icons) {
      const fullPath = path.join(CLIENT_ROOT, icon);
      assert.ok(fs.existsSync(fullPath), `Icon ${icon} must exist on disk`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 500, `Icon ${icon} must be non-empty (size: ${stat.size} bytes)`);
    }
  });

  // 4. Verify client/public/sw.js exists and is registered in client/src/main.jsx
  test('PWA service worker (sw.js) exists and is registered in main.jsx', () => {
    const swPath = path.join(CLIENT_ROOT, 'public/sw.js');
    assert.ok(fs.existsSync(swPath), 'sw.js must exist in public directory');
    const swContent = fs.readFileSync(swPath, 'utf8');
    assert.ok(swContent.includes('operon-pwa-v1'), 'sw.js must define cache name');
    assert.ok(swContent.includes('/manifest.json'), 'sw.js must precache manifest');

    const mainPath = path.join(CLIENT_ROOT, 'src/main.jsx');
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    assert.ok(mainContent.includes("navigator.serviceWorker.register('/sw.js')"), 'main.jsx must register sw.js');
  });

  // 5. Verify AppTheme.jsx maintains clean CSS baseline without disruptive position: fixed on html
  test('client/src/theme/AppTheme.jsx maintains clean CSS baseline without position: fixed conflicts', () => {
    const themePath = path.join(CLIENT_ROOT, 'src/theme/AppTheme.jsx');
    const content = fs.readFileSync(themePath, 'utf8');

    assert.ok(content.includes("html: {\n                height: '100%',"), 'html must have height: 100%');
    assert.ok(content.includes("body: {\n                height: '100%',"), 'body must have height: 100%');
    assert.ok(!content.includes("position: 'fixed',\n                inset: 0"), 'Must eliminate position: fixed; inset: 0 on root elements');
  });

  // 6. Verify AppShell.jsx binds to clean height: '100dvh' with '100vh' fallback
  test('client/src/layouts/AppShell.jsx cleanly binds height to 100dvh with 100vh fallback', () => {
    const shellPath = path.join(CLIENT_ROOT, 'src/layouts/AppShell.jsx');
    const content = fs.readFileSync(shellPath, 'utf8');

    assert.ok(content.includes("height: '100dvh'"), 'AppShell must set height: 100dvh');
    assert.ok(content.includes("height: '100vh'"), 'AppShell must fallback to height: 100vh in @supports not');
  });

  // 7. Verify PublicLayout.jsx cleanly binds height to 100dvh with 100vh fallback
  test('client/src/layouts/PublicLayout.jsx cleanly binds height to 100dvh with 100vh fallback', () => {
    const layoutPath = path.join(CLIENT_ROOT, 'src/layouts/PublicLayout.jsx');
    const content = fs.readFileSync(layoutPath, 'utf8');

    assert.ok(content.includes("height: '100dvh'"), 'PublicLayout must set height: 100dvh');
    assert.ok(content.includes("height: '100vh'"), 'PublicLayout must fallback to height: 100vh in @supports not');
  });

  console.log('='.repeat(80));
  console.log(`PHASE 14D VERIFICATION RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('='.repeat(80));

  if (passed !== total) {
    process.exit(1);
  }
}

runTest();
