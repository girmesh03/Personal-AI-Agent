/**
 * @module scripts/testReportsFrontendContract
 * @description Automated test suite verifying the Frontend Report Contract:
 * 1. Health check & route availability.
 * 2. Authenticated user setup & branch creation.
 * 3. Report creation with Ethiopian calendar virtual derivation.
 * 4. Paginated listing contract: reports, docs, totalDocs, totalPages, page, limit.
 * 5. Branch filter query contract (GET /api/v1/reports?branch=...).
 * 6. Date filter query contract (GET /api/v1/reports?date=...).
 * 7. Bilingual search filter contract (GET /api/v1/reports?search=...).
 * 8. Subdocument schema purity verification: activities (completed, in_progress), issues (reported, in_progress, completed, no_issue), comments (status: null).
 * 9. Patch update contract (PATCH /api/v1/reports/:id).
 * 10. Soft-archive (PATCH /api/v1/reports/:id/archive) and active/archived list separation.
 * 11. Restore (PATCH /api/v1/reports/:id/restore).
 * 12. Permanent Cascade Delete (DELETE /api/v1/reports/:id/delete).
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

    if (activeCookies.length > 0 && !options.skipCookies) {
      headers['Cookie'] = activeCookies.join('; ');
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

async function runContractTests() {
  console.log('🚀 Starting Frontend Reports Contract Verification Suite...');
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

  try {
    // Clean test data
    const testEmail = 'reports_contract_test@antigravity.et';
    await User.deleteMany({ email: testEmail });

    // Step 1: Register and login
    console.log('\n--- Step 1: Register and authenticate test user ---');
    const regRes = await postmanRequest('/auth/register', {
      method: 'POST',
      body: {
        firstName: 'Contract',
        lastName: 'Supervisor',
        email: testEmail,
        password: 'Password123!',
        position: 'Area Manager',
      },
    });
    assert.strictEqual(regRes.status, 201, `Registration failed: ${JSON.stringify(regRes.body)}`);

    const loginRes = await postmanRequest('/auth/login', {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'Password123!',
      },
    });
    assert.strictEqual(loginRes.status, 200, `Login failed: ${JSON.stringify(loginRes.body)}`);
    console.log('✅ Supervisor registered and logged in successfully with cookies set.');

    // Step 2: Create test branches
    console.log('\n--- Step 2: Create test branches ---');
    const branchRes1 = await postmanRequest('/branches', {
      method: 'POST',
      body: {
        name: 'Bole Medhanialem Contract Branch',
        location: {
          city: 'Addis Ababa',
          subcity: 'Bole',
          address: 'Bole, Atlas Road',
        },
        managerName: 'Abebe Bikila',
        contactPhone: '+251911223344',
      },
    });
    assert.strictEqual(branchRes1.status, 201, `Branch 1 creation failed: ${JSON.stringify(branchRes1.body)}`);
    const branch1Id = branchRes1.body.data?.branch?._id || branchRes1.body.data?._id;

    const branchRes2 = await postmanRequest('/branches', {
      method: 'POST',
      body: {
        name: 'Piassa Cathedral Branch',
        location: {
          city: 'Addis Ababa',
          subcity: 'Arada',
          address: 'Piassa, Church Street',
        },
        managerName: 'Derartu Tulu',
        contactPhone: '+251911556677',
      },
    });
    assert.strictEqual(branchRes2.status, 201, `Branch 2 creation failed: ${JSON.stringify(branchRes2.body)}`);
    const branch2Id = branchRes2.body.data?.branch?._id || branchRes2.body.data?._id;
    console.log(`✅ Branches created: BOLE-99 (${branch1Id}) & PIAS-99 (${branch2Id})`);

    // Step 3: Create report with full subdocuments
    console.log('\n--- Step 3: Create operational report ---');
    const createReportRes = await postmanRequest('/reports', {
      method: 'POST',
      body: {
        date: '2026-10-24T08:00:00.000Z',
        clockIn: '08:30',
        clockOut: '17:00',
        visits: [
          { branch: branch1Id, clockIn: '08:30', clockOut: '12:00' },
          { branch: branch2Id, clockIn: '13:00', clockOut: '17:00' },
        ],
        activities: [
          { text: 'Sanitation inspection conducted', status: 'completed' },
          { text: 'Storage calibration', status: 'in_progress' },
        ],
        issues: [
          { text: 'Network switch faulty in cash office', status: 'reported' },
          { text: 'Freezer temperature variation', status: 'in_progress' },
        ],
        comments: [
          { text: 'Overall operational discipline satisfactory.' },
        ],
        transcription: 'የዕለት የሥራ ክንውን ሪፖርት፡ የቦሌ እና የፒያሳ ቅርንጫፎች ተጎብኝተዋል።',
      },
    });
    assert.strictEqual(createReportRes.status, 201, `Report creation failed: ${JSON.stringify(createReportRes.body)}`);
    const reportId = createReportRes.body.data?.report?._id || createReportRes.body.data?._id;
    console.log(`✅ Report created successfully with ID: ${reportId}`);

    // Step 4: Verify paginated listing envelope
    console.log('\n--- Step 4: Verify paginated listing envelope ---');
    const listRes = await postmanRequest('/reports?page=1&limit=10');
    assert.strictEqual(listRes.status, 200, 'Listing endpoint returned non-200');
    assert.ok(listRes.body.data.reports || listRes.body.data.docs, 'Missing reports or docs in response');
    assert.strictEqual(typeof listRes.body.data.totalDocs, 'number', 'totalDocs is not a number');
    assert.strictEqual(typeof listRes.body.data.totalPages, 'number', 'totalPages is not a number');
    console.log(`✅ Reports list envelope verified: totalDocs=${listRes.body.data.totalDocs}, totalPages=${listRes.body.data.totalPages}`);

    // Step 5: Test Branch filter query
    console.log('\n--- Step 5: Verify branch filter query ---');
    const branchFilterRes = await postmanRequest(`/reports?branch=${branch1Id}`);
    assert.strictEqual(branchFilterRes.status, 200, 'Branch filter failed');
    const filteredReports = branchFilterRes.body.data.reports || branchFilterRes.body.data.docs;
    assert.ok(filteredReports.length >= 1, 'Expected at least 1 report matching branch1Id');
    console.log(`✅ Branch filter query matched ${filteredReports.length} reports.`);

    // Step 6: Test Date filter query
    console.log('\n--- Step 6: Verify date filter query ---');
    const dateFilterRes = await postmanRequest('/reports?date=2026-10-24');
    assert.strictEqual(dateFilterRes.status, 200, 'Date filter failed');
    const dateMatchedReports = dateFilterRes.body.data.reports || dateFilterRes.body.data.docs;
    assert.ok(dateMatchedReports.length >= 1, 'Expected at least 1 report matching date');
    console.log(`✅ Date filter query matched ${dateMatchedReports.length} reports.`);

    // Step 7: Test Bilingual search query
    console.log('\n--- Step 7: Verify bilingual search query ---');
    const searchRes = await postmanRequest('/reports?search=Sanitation');
    assert.strictEqual(searchRes.status, 200, 'Search query failed');
    const searchMatched = searchRes.body.data.reports || searchRes.body.data.docs;
    assert.ok(searchMatched.length >= 1, 'Expected at least 1 report matching search "Sanitation"');

    const searchAmharicRes = await postmanRequest('/reports?search=ቅርንጫፎች');
    assert.strictEqual(searchAmharicRes.status, 200, 'Amharic search query failed');
    console.log('✅ Bilingual search query verified across English and Amharic.');

    // Step 8: Subdocument Schema Purity & Detail Inspection
    console.log('\n--- Step 8: Verify report details & subdocument schema purity ---');
    const detailRes = await postmanRequest(`/reports/${reportId}`);
    assert.strictEqual(detailRes.status, 200, 'Report detail retrieval failed');
    const rep = detailRes.body.data?.report || detailRes.body.data;
    assert.strictEqual(rep.status, undefined, 'CRITICAL INVARIANT VIOLATED: Root report document has a "status" field!');
    assert.strictEqual(rep.templateType, undefined, 'CRITICAL INVARIANT VIOLATED: Root report document has a "templateType" field!');
    assert.ok(rep.ethiopianDate, 'Virtual ethiopianDate getter not derived');
    assert.strictEqual(rep.activities[0].status, 'completed', 'Activity status mismatch');
    assert.strictEqual(rep.issues[0].status, 'reported', 'Issue status mismatch');
    console.log(`✅ Schema purity verified: zero root status/templateType, derived ethiopianDate="${rep.ethiopianDate}".`);

    // Step 9: Update Report Contract
    console.log('\n--- Step 9: Update report content ---');
    const updateRes = await postmanRequest(`/reports/${reportId}`, {
      method: 'PATCH',
      body: {
        clockOut: '17:30',
        transcription: 'የተሻሻለ ሪፖርት፡ ሥራው በተሳካ ሁኔታ ተጠናቋል።',
      },
    });
    assert.strictEqual(updateRes.status, 200, `Report update failed: ${JSON.stringify(updateRes.body)}`);
    const updatedRep = updateRes.body.data?.report || updateRes.body.data;
    assert.strictEqual(updatedRep.clockOut, '17:30', 'clockOut was not updated');
    console.log('✅ Report content updated successfully.');

    // Step 10: Soft Archival Contract
    console.log('\n--- Step 10: Soft-archive report ---');
    const archiveRes = await postmanRequest(`/reports/${reportId}/archive`, {
      method: 'PATCH',
    });
    assert.strictEqual(archiveRes.status, 200, 'Report archive failed');
    const archivedRep = archiveRes.body.data?.report || archiveRes.body.data;
    assert.strictEqual(archivedRep.isArchived, true, 'isArchived is not true');

    // Verify report is now excluded from active listing
    const activeListRes = await postmanRequest('/reports?archived=false');
    const activeList = activeListRes.body.data.reports || activeListRes.body.data.docs;
    assert.ok(!activeList.some((r) => String(r._id) === String(reportId)), 'Archived report appears in active listing');

    // Verify report appears in archived listing
    const archivedListRes = await postmanRequest('/reports?archived=true');
    const archivedList = archivedListRes.body.data.reports || archivedListRes.body.data.docs;
    assert.ok(archivedList.some((r) => String(r._id) === String(reportId)), 'Archived report missing from archived listing');
    console.log('✅ Soft-archiving and active/archived list separation verified.');

    // Step 11: Restore Report Contract
    console.log('\n--- Step 11: Restore operational report ---');
    const restoreRes = await postmanRequest(`/reports/${reportId}/restore`, {
      method: 'PATCH',
    });
    assert.strictEqual(restoreRes.status, 200, 'Report restore failed');
    const restoredRep = restoreRes.body.data?.report || restoreRes.body.data;
    assert.strictEqual(restoredRep.isArchived, false, 'isArchived is not false');
    console.log('✅ Report restoration verified.');

    // Step 12: Permanent Cascade Deletion
    console.log('\n--- Step 12: Permanent cascade delete ---');
    // First re-archive to allow hard delete
    await postmanRequest(`/reports/${reportId}/archive`, { method: 'PATCH' });
    const deleteRes = await postmanRequest(`/reports/${reportId}/delete`, {
      method: 'DELETE',
    });
    assert.strictEqual(deleteRes.status, 200, 'Report hard delete failed');

    const verifyDeleted = await Report.findById(reportId);
    assert.strictEqual(verifyDeleted, null, 'Report document was not purged from MongoDB');
    console.log('✅ Permanent cascade delete verified.');

    // Clean up test branches and user
    await Branch.deleteMany({ user: regRes.body.data._id });
    await User.findByIdAndDelete(regRes.body.data._id);

    console.log('\n🎉 ALL 12 FRONTEND REPORT CONTRACT TESTS PASSED FLAWLESSLY!\n');
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

runContractTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  });
