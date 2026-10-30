/* global process */
/**
 * @file testViewportHeight.js
 * @description Headless automated verification test for Phase 14B Point 27:
 * Multi-device bulletproof viewport height synchronization engine.
 * Verifies inline script presence in index.html, useViewportHeight exports and logic,
 * AppTheme CssBaseline style overrides, and AppShell/PublicLayout height cascade.
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
  console.log('PHASE 14B POINT 27: 100% VIEWPORT HEIGHT VERIFICATION');
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

  // 1. Verify client/index.html contains Tier 1 synchronous script
  test('client/index.html contains Tier 1 synchronous first-paint --app-height script in <head>', () => {
    const htmlPath = path.join(CLIENT_ROOT, 'index.html');
    assert.ok(fs.existsSync(htmlPath), 'index.html must exist');
    const content = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(
      content.includes("document.documentElement.style.setProperty('--app-height'"),
      'Must set --app-height on document.documentElement synchronously'
    );
    assert.ok(
      content.includes('window.visualViewport'),
      'Must inspect window.visualViewport in inline script'
    );
    assert.ok(
      content.includes('window.innerHeight'),
      'Must provide window.innerHeight fallback in inline script'
    );
  });

  // 2. Verify useViewportHeight.js exists and exports correctly
  test('client/src/hooks/useViewportHeight.js exists with full lifecycle tracking', () => {
    const hookPath = path.join(CLIENT_ROOT, 'src/hooks/useViewportHeight.js');
    assert.ok(fs.existsSync(hookPath), 'useViewportHeight.js must exist');
    const content = fs.readFileSync(hookPath, 'utf8');

    assert.ok(content.includes('export function useViewportHeight'), 'Must export useViewportHeight');
    assert.ok(content.includes('requestAnimationFrame'), 'Must batch with requestAnimationFrame');
    assert.ok(
      content.includes('visualViewport') && content.includes("addEventListener('resize'"),
      'Must track visualViewport events'
    );
    assert.ok(content.includes('orientationchange'), 'Must track orientationchange events');
    assert.ok(content.includes('--keyboard-height'), 'Must track virtual keyboard height');
  });

  // 3. Verify App.jsx mounts useViewportHeight at application root
  test('client/src/App.jsx mounts useViewportHeight at root', () => {
    const appPath = path.join(CLIENT_ROOT, 'src/App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes("import useViewportHeight from './hooks/useViewportHeight"), 'Must import useViewportHeight');
    assert.ok(content.includes('useViewportHeight()'), 'Must invoke useViewportHeight at root component');
  });

  // 4. Verify AppTheme.jsx sets html/body/#root styles with --app-height
  test('client/src/theme/AppTheme.jsx eliminates ICB contradiction and binds to --app-height', () => {
    const themePath = path.join(CLIENT_ROOT, 'src/theme/AppTheme.jsx');
    const content = fs.readFileSync(themePath, 'utf8');

    assert.ok(
      content.includes("height: 'var(--app-height, 100dvh)'"),
      'html must bind height to var(--app-height, 100dvh)'
    );
    assert.ok(
      content.includes("position: 'fixed'"),
      'html must have position: fixed to prevent iOS rubber-band overscroll'
    );
    assert.ok(
      content.includes("overscrollBehavior: 'none'"),
      'body must specify overscrollBehavior: none'
    );
  });

  // 5. Verify AppShell.jsx binds to var(--app-height, 100dvh)
  test('client/src/layouts/AppShell.jsx binds height to var(--app-height, 100dvh)', () => {
    const shellPath = path.join(CLIENT_ROOT, 'src/layouts/AppShell.jsx');
    const content = fs.readFileSync(shellPath, 'utf8');

    assert.ok(
      content.includes("height: 'var(--app-height, 100dvh)'"),
      'AppShell must bind height to var(--app-height, 100dvh)'
    );
    assert.ok(
      content.includes("height: 'var(--app-height, 100vh)'"),
      'AppShell must fallback to var(--app-height, 100vh) in @supports not'
    );
  });

  // 6. Verify PublicLayout.jsx binds to var(--app-height, 100dvh)
  test('client/src/layouts/PublicLayout.jsx binds height to var(--app-height, 100dvh)', () => {
    const layoutPath = path.join(CLIENT_ROOT, 'src/layouts/PublicLayout.jsx');
    const content = fs.readFileSync(layoutPath, 'utf8');

    assert.ok(
      content.includes("height: 'var(--app-height, 100dvh)'"),
      'PublicLayout must bind height to var(--app-height, 100dvh)'
    );
    assert.ok(
      content.includes("height: 'var(--app-height, 100vh)'"),
      'PublicLayout must fallback to var(--app-height, 100vh) in @supports not'
    );
  });

  console.log('='.repeat(80));
  console.log(`PHASE 14B POINT 27 VERIFICATION RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('='.repeat(80));

  if (passed !== total) {
    process.exit(1);
  }
}

runTest();
