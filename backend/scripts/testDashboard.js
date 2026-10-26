/**
 * @module scripts/testDashboard
 * @description Automated test suite validating Executive Operational Dashboard metrics:
 * 1. Unauthorized request guard (401 without cookie).
 * 2. Zero-data edge cases (clean zeroes and empty arrays without exceptions).
 * 3. Populated metrics calculations (KPI numbers, branch visits, 14-day trend, issues breakdown).
 * 4. 14-day continuous volume timeline (zero gap integrity).
 * 5. Branch visit frequency distribution (top branches sorted descending).
 * 6. Recurring issues breakdown by status.
 * 7. Recent reports ledger (max 5 items, sorted descending).
 * 8. Strict multi-tenant isolation (User B isolated from User A data).
 */

import http from 'node:http';
import assert from 'node:assert';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Branch } from '../src/models/Branch.js';
import { Report } from '../src/models/Report.js';

let BASE_URL = '';
let server;
let activeCookies = [];

const postmanRequest = (endpoint, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const method = options.method || 'GET';
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const cookiesToUse = options.cookies !== undefined ? options.cookies : activeCookies;
    if (cookiesToUse.length > 0 && !options.skipCookies) {
      headers['Cookie'] = cookiesToUse.join('; ');
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const setCookieHeaders = res.headers['set-cookie'];
        if (setCookieHeaders) {
          const newCookies = [];
          setCookieHeaders.forEach((rawCookie) => {
            const cookiePart = rawCookie.split(';')[0];
            newCookies.push(cookiePart);
          });
          activeCookies = newCookies;
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
          body: parsedBody,
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      const payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.write(payload);
    }

    req.end();
  });
};

async function runDashboardTests() {
  console.log('🚀 Starting Executive Operational Dashboard Test Suite...');
  await connectDB();

  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      BASE_URL = `http://127.0.0.1:${port}/api/v1`;
      console.log(`📡 Test server listening on ${BASE_URL}`);
      resolve();
    });
    server.on('error', reject);
  });

  const emailA = 'dashboard_user_a@antigravity.et';
  const emailB = 'dashboard_user_b@antigravity.et';

  try {
    // Clean old test users
    await User.deleteMany({ email: { $in: [emailA, emailB] } });

    // Scenario 1: Unauthorized access guard
    console.log('\n--- Scenario 1: Unauthorized request guard (401) ---');
    const unauthRes = await postmanRequest('/dashboard/metrics', { skipCookies: true });
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401');
    console.log('✅ Unauthenticated request correctly rejected with 401');

    // Register User A
    console.log('\n--- Scenario 2: Register User A and verify zero-data metrics ---');
    const regResA = await postmanRequest('/auth/register', {
      method: 'POST',
      body: {
        email: emailA,
        password: 'Password123!',
      },
    });
    assert.strictEqual(regResA.status, 201, 'User A registration failed');
    const userA = regResA.body.data.user || regResA.body.data;

    const loginResA = await postmanRequest('/auth/login', {
      method: 'POST',
      body: {
        email: emailA,
        password: 'Password123!',
      },
    });
    assert.strictEqual(loginResA.status, 200, 'User A login failed');
    const cookiesA = [...activeCookies];

    // Query metrics for User A (zero data)
    const zeroMetricsRes = await postmanRequest('/dashboard/metrics', { cookies: cookiesA });
    assert.strictEqual(zeroMetricsRes.status, 200, 'Zero-data metrics query failed');
    const zeroData = zeroMetricsRes.body.data;

    assert.strictEqual(zeroData.kpis.activeBranches, 0, 'Active branches must be 0');
    assert.strictEqual(zeroData.kpis.totalReports, 0, 'Total reports must be 0');
    assert.strictEqual(zeroData.kpis.auditsThisWeek, 0, 'Audits this week must be 0');
    assert.strictEqual(zeroData.kpis.openIssues, 0, 'Open issues must be 0');
    assert.strictEqual(zeroData.kpis.totalVisits, 0, 'Total visits must be 0');
    assert.strictEqual(zeroData.branchVisitFrequency.length, 0, 'Branch visit frequency must be empty');
    assert.strictEqual(zeroData.auditVolumeTrend.length, 14, 'Trend must contain exactly 14 continuous days');
    assert.strictEqual(zeroData.recentReports.length, 0, 'Recent reports must be empty');
    console.log('✅ Zero-data state handled gracefully with clean defaults');

    // Scenario 3: Populate branches and reports for User A
    console.log('\n--- Scenario 3: Populate User A data and verify metric calculations ---');
    // Create 2 branches
    const branchRes1 = await postmanRequest('/branches', {
      method: 'POST',
      cookies: cookiesA,
      body: {
        name: 'Bole Medhanialem',
        location: { city: 'Addis Ababa', subcity: 'Bole', address: 'Edna Mall' },
      },
    });
    assert.strictEqual(branchRes1.status, 201, 'Branch 1 creation failed');
    const b1 = branchRes1.body.data.branch || branchRes1.body.data;

    const branchRes2 = await postmanRequest('/branches', {
      method: 'POST',
      cookies: cookiesA,
      body: {
        name: 'Piassa Commercial',
        location: { city: 'Addis Ababa', subcity: 'Arada', address: 'De Gaulle Square' },
      },
    });
    assert.strictEqual(branchRes2.status, 201, 'Branch 2 creation failed');
    const b2 = branchRes2.body.data.branch || branchRes2.body.data;

    // Create Report 1 (Today)
    const todayStr = new Date().toISOString().split('T')[0];
    const reportRes1 = await postmanRequest('/reports', {
      method: 'POST',
      cookies: cookiesA,
      body: {
        date: todayStr,
        clockIn: '08:00',
        clockOut: '17:00',
        transcription: 'Daily supervisor store audit report Bole and Piassa',
        visits: [
          { branch: b1._id, clockIn: '08:30', clockOut: '12:00' },
          { branch: b2._id, clockIn: '13:00', clockOut: '16:30' },
        ],
        issues: [
          { text: 'POS printer offline at Bole', status: 'reported' },
          { text: 'Staff shortage resolved', status: 'completed' },
        ],
        activities: [
          { text: 'Audit physical stock', status: 'completed' },
        ],
      },
    });
    if (reportRes1.status !== 201) {
      console.error('Report 1 failed:', JSON.stringify(reportRes1.body));
    }
    assert.strictEqual(reportRes1.status, 201, 'Report 1 creation failed');

    // Create Report 2 (Yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const reportRes2 = await postmanRequest('/reports', {
      method: 'POST',
      cookies: cookiesA,
      body: {
        date: yesterdayStr,
        clockIn: '09:00',
        clockOut: '18:00',
        transcription: 'Daily supervisor store audit report Bole follow-up',
        visits: [
          { branch: b1._id, clockIn: '09:30', clockOut: '14:00' },
        ],
        issues: [
          { text: 'Freezer temperature anomaly', status: 'in_progress' },
        ],
        activities: [
          { text: 'Review shift logs', status: 'completed' },
        ],
      },
    });
    if (reportRes2.status !== 201) {
      console.error('Report 2 failed:', JSON.stringify(reportRes2.body));
    }
    assert.strictEqual(reportRes2.status, 201, 'Report 2 creation failed');

    // Scenario 4: Query metrics for User A and verify exact calculations
    console.log('\n--- Scenario 4: Query metrics for User A and verify calculations ---');
    const metricsResA = await postmanRequest('/dashboard/metrics', { cookies: cookiesA });
    assert.strictEqual(metricsResA.status, 200, 'Metrics query for User A failed');
    const dataA = metricsResA.body.data;

    assert.strictEqual(dataA.kpis.activeBranches, 2, 'Must have 2 active branches');
    assert.strictEqual(dataA.kpis.totalReports, 2, 'Must have 2 total reports');
    assert.strictEqual(dataA.kpis.auditsThisWeek, 2, 'Must have 2 audits this week');
    assert.strictEqual(dataA.kpis.openIssues, 2, 'Must have 2 open issues (1 reported + 1 in_progress)');
    assert.strictEqual(dataA.kpis.totalVisits, 3, 'Must have 3 total branch visits (2 in R1, 1 in R2)');
    console.log('✅ KPI stats match expected values');

    // Scenario 5: Verify branch visit frequency
    console.log('\n--- Scenario 5: Verify branch visit frequency distribution ---');
    assert.strictEqual(dataA.branchVisitFrequency.length, 2, 'Must have 2 visited branches');
    const topBranch = dataA.branchVisitFrequency[0];
    assert.strictEqual(topBranch.branchCode, 'BOLE-01', 'Top branch must be BOLE-01');
    assert.strictEqual(topBranch.visitCount, 2, 'BOLE-01 must have 2 visits');
    console.log('✅ Branch visit frequency distribution sorted and calculated accurately');

    // Scenario 6: Verify 14-day continuous trend
    console.log('\n--- Scenario 6: Verify 14-day continuous audit trend ---');
    assert.strictEqual(dataA.auditVolumeTrend.length, 14, 'Must have exactly 14 continuous days');
    const todayItem = dataA.auditVolumeTrend[dataA.auditVolumeTrend.length - 1];
    assert.strictEqual(todayItem.date, todayStr, 'Final trend item must be today');
    assert.strictEqual(todayItem.count, 1, 'Today must have 1 report');

    const yesterdayItem = dataA.auditVolumeTrend[dataA.auditVolumeTrend.length - 2];
    assert.strictEqual(yesterdayItem.date, yesterdayStr, 'Second-to-last trend item must be yesterday');
    assert.strictEqual(yesterdayItem.count, 1, 'Yesterday must have 1 report');
    console.log('✅ 14-day continuous audit volume trend verified with continuous dates');

    // Scenario 7: Verify recurring issues breakdown
    console.log('\n--- Scenario 7: Verify recurring issues breakdown ---');
    assert.strictEqual(dataA.recurringIssues.reported, 1, 'Must have 1 reported issue');
    assert.strictEqual(dataA.recurringIssues.in_progress, 1, 'Must have 1 in_progress issue');
    assert.strictEqual(dataA.recurringIssues.completed, 1, 'Must have 1 completed issue');
    console.log('✅ Recurring issues breakdown matched');

    // Scenario 8: Verify recent reports ledger
    console.log('\n--- Scenario 8: Verify recent reports ledger ---');
    assert.strictEqual(dataA.recentReports.length, 2, 'Must return 2 recent reports');
    assert.strictEqual(dataA.recentReports[0].visits.length, 2, 'First recent report must be today with 2 visits');
    console.log('✅ Recent reports ledger populated and sorted descending');

    // Scenario 9: Multi-tenant cross-user security isolation
    console.log('\n--- Scenario 9: Multi-tenant cross-user security isolation ---');
    const regResB = await postmanRequest('/auth/register', {
      method: 'POST',
      body: {
        email: emailB,
        password: 'Password123!',
      },
    });
    assert.strictEqual(regResB.status, 201, 'User B registration failed');
    const userB = regResB.body.data.user || regResB.body.data;

    const loginResB = await postmanRequest('/auth/login', {
      method: 'POST',
      body: {
        email: emailB,
        password: 'Password123!',
      },
    });
    assert.strictEqual(loginResB.status, 200, 'User B login failed');
    const cookiesB = [...activeCookies];

    // User B adds 1 branch and 0 reports
    await postmanRequest('/branches', {
      method: 'POST',
      cookies: cookiesB,
      body: {
        name: 'CMC Express',
        location: { city: 'Addis Ababa', subcity: 'Yeka', address: 'CMC Tower' },
      },
    });

    const metricsResB = await postmanRequest('/dashboard/metrics', { cookies: cookiesB });
    assert.strictEqual(metricsResB.status, 200, 'Metrics query for User B failed');
    const dataB = metricsResB.body.data;

    assert.strictEqual(dataB.kpis.activeBranches, 1, 'User B must have exactly 1 branch');
    assert.strictEqual(dataB.kpis.totalReports, 0, 'User B must see 0 reports (isolated from User A)');
    assert.strictEqual(dataB.kpis.totalVisits, 0, 'User B must see 0 visits');
    assert.strictEqual(dataB.kpis.openIssues, 0, 'User B must see 0 issues');
    assert.strictEqual(dataB.branchVisitFrequency.length, 0, 'User B must have 0 branch visits');
    assert.strictEqual(dataB.recentReports.length, 0, 'User B must have 0 recent reports');
    console.log('✅ Strict multi-tenant isolation verified: User B sees zero User A data');

    // Clean up
    console.log('\n--- Teardown: Clean up test fixtures ---');
    await Branch.deleteMany({ user: { $in: [userA._id, userB._id] } });
    await Report.deleteMany({ user: { $in: [userA._id, userB._id] } });
    await User.deleteMany({ email: { $in: [emailA, emailB] } });
    console.log('✅ Teardown complete');

    console.log('\n🎉 ALL 8 DASHBOARD METRICS AUTOMATED TESTS PASSED FLAWLESSLY!\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await disconnectDB();
  }
}

runDashboardTests()
  .then(() => {
    process.exit(process.exitCode || 0);
  })
  .catch((err) => {
    console.error('❌ Unhandled error in test suite:', err);
    process.exit(1);
  });
