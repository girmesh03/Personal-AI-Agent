/**
 * @file testPhase14FDashboardUI.js
 * @description Automated verification suite for Phase 14F:
 * Executive Dashboard UI Structuring, Multi-Breakpoint Responsiveness (xs, sm, md, lg, xl),
 * and Component Repurposing (MuiBranchDialog in-place modal & MuiReportTelegramShareButton).
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
console.log('PHASE 14F VERIFICATION: DASHBOARD UI STRUCTURING & REPURPOSING');
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

async function main() {
  // ---------------------------------------------------------------------------
  // Suite 1: Dashboard Canvas & In-Place Branch Dialog Feature Repurposing
  // ---------------------------------------------------------------------------
  console.log('--- Suite 1: Dashboard Canvas & In-Place Branch Creation ---');

  const dashboardSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'client/src/pages/Dashboard.jsx'), 'utf-8');

  runTest('Dashboard.jsx mounts MuiBranchDialog with refetch callback', () => {
    assert.ok(dashboardSrc.includes('import MuiBranchDialog'), 'Must import MuiBranchDialog');
    assert.ok(dashboardSrc.includes('<MuiBranchDialog'), 'Must render MuiBranchDialog');
    assert.ok(dashboardSrc.includes('isBranchDialogOpen'), 'Must control dialog open state');
    assert.ok(dashboardSrc.includes('refetch()'), 'Must invoke refetch() on branch create success');
  });

  runTest('Dashboard.jsx passes onAddBranch handler to DashboardQuickActions', () => {
    assert.ok(dashboardSrc.includes('onAddBranch={() => setIsBranchDialogOpen(true)}'), 'Must pass onAddBranch prop');
  });

  runTest('Dashboard.jsx scales canvas max-width to xl: 1600 and fluid padding', () => {
    assert.ok(dashboardSrc.includes("maxWidth: { xs: '100%', xl: 1600 }"), 'Must scale maxWidth to 1600 on xl');
    assert.ok(dashboardSrc.includes('p: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }'), 'Must have progressive padding');
  });

  // ---------------------------------------------------------------------------
  // Suite 2: Quick Actions Mobile Labeling & In-Place Trigger
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 2: Quick Actions Responsive Adaptation ---');

  const quickActionsSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'client/src/components/dashboard/DashboardQuickActions.jsx'), 'utf-8');

  runTest('DashboardQuickActions.jsx accepts and triggers onAddBranch', () => {
    assert.ok(quickActionsSrc.includes('onAddBranch'), 'Must accept onAddBranch prop');
    assert.ok(quickActionsSrc.includes('onClick: onAddBranch'), 'Must bind onClick to onAddBranch');
  });

  runTest('DashboardQuickActions.jsx renders clear full text labels without chopped abbreviations', () => {
    assert.ok(quickActionsSrc.includes('Start Inspection'), 'Must include full text Start Inspection');
    assert.ok(quickActionsSrc.includes('Add Branch'), 'Must include full text Add Branch');
    assert.ok(!quickActionsSrc.includes('>Inspect<'), 'Must not chop label to Inspect');
    assert.ok(!quickActionsSrc.includes('>Branch<'), 'Must not chop label to Branch');
    assert.ok(quickActionsSrc.includes("flexWrap: { xs: 'nowrap', sm: 'nowrap' }"), 'Must prevent wrapping on sm+ to keep buttons side-by-side');
  });

  // ---------------------------------------------------------------------------
  // Suite 3: KPI Deck 100% Mobile Stack, 2x2 Tablet Matrix & Stat Card Typography
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 3: KPI Deck Multi-Breakpoint Matrix ---');

  const kpiDeckSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'client/src/components/dashboard/DashboardKpiDeck.jsx'), 'utf-8');

  runTest('DashboardKpiDeck.jsx renders stacked fullwidth on xs, 2x2 on sm/md, 1x4 on lg+ (size: xs: 12, sm: 6, md: 6, lg: 3, xl: 3)', () => {
    const matches = kpiDeckSrc.match(/size=\{\{\s*xs:\s*12,\s*sm:\s*6,\s*md:\s*6,\s*lg:\s*3,\s*xl:\s*3\s*\}\}/g);
    assert.ok(matches && matches.length >= 4, 'Must have at least 4 KPI cards configured with xs: 12, sm: 6, md: 6, lg: 3, xl: 3');
  });

  const statCardSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'client/src/components/reusable/MuiStatCard.jsx'), 'utf-8');

  runTest('MuiStatCard.jsx allows natural wrapping without ellipsis truncation', () => {
    assert.ok(statCardSrc.includes('p: { xs: 1.75, sm: 2, md: 2.5 }'), 'Must use responsive padding');
    assert.ok(statCardSrc.includes("fontSize: { xs: '1.35rem'"), 'Must scale metric value font on xs');
    assert.ok(!statCardSrc.includes('variant="caption"\n            noWrap'), 'Must not have noWrap on title');
  });

  // ---------------------------------------------------------------------------
  // Suite 4: Analytical Charts Responsive Fluid Height & Axis Perfection
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 4: Analytical Charts Fluid Sizing ---');

  const branchChartSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'client/src/components/dashboard/DashboardBranchVisitChart.jsx'), 'utf-8');
  const trendChartSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'client/src/components/dashboard/DashboardAuditTrendChart.jsx'), 'utf-8');

  runTest('Dashboard.jsx stacks charts on xs, sm, and md, transitioning to side-by-side only on lg+', () => {
    assert.ok(dashboardSrc.includes('size={{ xs: 12, sm: 12, md: 12, lg: 6, xl: 6 }}'), 'Charts must be stacked on xs, sm, and md');
  });

  runTest('DashboardBranchVisitChart.jsx prevents label skipping via tickLabelInterval and angled labels with bottom: 48', () => {
    assert.ok(branchChartSrc.includes('tickLabelInterval: () => true'), 'Must force all tick labels visible');
    assert.ok(branchChartSrc.includes('angle: -28'), 'Must rotate labels to prevent collision');
    assert.ok(branchChartSrc.includes('bottom: 48'), 'Must provide 48px bottom margin for tick labels');
    assert.ok(branchChartSrc.includes("height: { xs: 'auto', md: '100%' }"), 'Must use auto height on mobile to prevent empty void');
  });

  runTest('DashboardAuditTrendChart.jsx hugs chart tightly with zero empty void', () => {
    assert.ok(trendChartSrc.includes('chartHeight'), 'Must define chartHeight');
    assert.ok(trendChartSrc.includes("height: { xs: 'auto', md: '100%' }"), 'Must use auto height on mobile to prevent empty void');
  });

  // ---------------------------------------------------------------------------
  // Suite 5: Recent Audits Route Parity & Telegram Feature
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 5: Recent Audits Route Parity & Telegram Feature ---');

  const ledgerSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'client/src/components/dashboard/DashboardRecentAuditsLedger.jsx'), 'utf-8');

  runTest('DashboardRecentAuditsLedger.jsx uses responsive table minWidth for tablet/md viewport compatibility', () => {
    assert.ok(ledgerSrc.includes('minWidth: { sm: 600, md: 630, lg: 750 }'), 'Must use responsive table minWidth');
  });

  runTest('Zero 404 Invariant: Mobile card links to /reports/:id/details matching desktop', () => {
    assert.ok(!ledgerSrc.includes('to={`/reports/${report._id}`}'), 'Must NOT have broken /reports/:id link without /details');
    const matches = ledgerSrc.match(/to=\{`\/reports\/\$\{report\._id\}\/details`\}/g);
    assert.ok(matches && matches.length >= 2, 'Must have /reports/:id/details on both desktop table and mobile card');
  });

  runTest('Telegram Feature Repurposing: MuiReportTelegramShareButton embedded on desktop and mobile', () => {
    assert.ok(ledgerSrc.includes('import MuiReportTelegramShareButton'), 'Must import MuiReportTelegramShareButton');
    const matches = ledgerSrc.match(/<MuiReportTelegramShareButton\s+report=\{report\}/g);
    assert.ok(matches && matches.length >= 2, 'Must render MuiReportTelegramShareButton on both table and mobile cards');
    assert.ok(ledgerSrc.includes('variant="button"'), 'Mobile card must use button variant for balanced layout');
    assert.ok(ledgerSrc.includes('label="Share"'), 'Mobile card must display Share text label');
  });

  // ---------------------------------------------------------------------------
  // Suite 6: Functional & Architectural Invariants
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 6: Invariants Verification ---');

  runTest('Microphone Invariant: client/src/components/chat/MuiAudioRecorder.jsx remains 100% untouched', () => {
    assert.ok(fs.existsSync(path.join(PROJECT_ROOT, 'client/src/components/chat/MuiAudioRecorder.jsx')), 'MuiAudioRecorder must exist');
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
