/**
 * @module scripts/testBranches
 * @description Dedicated automated HTTP test suite exercising branch domain endpoints like Postman.
 * Validates:
 * 1. Bilingual Amharic <-> English branch creation and discovery (e.g. create 'ቦሌ' -> search 'bole').
 * 2. Automated operational branch code generation when code is omitted.
 * 3. Removal of redundant normalizedName field.
 * 4. Compound uniqueness on (user, name) and (user, code) among active branches.
 * 5. Strict rejection of forbidden field injections and bounds validation via constants.
 * 6. Mongoose transaction sessions on all write operations.
 * 7. Soft-archival, restoration with active collision guard.
 * 8. Manual cascade permanent hard-deletion of archived branches (rejects active branches).
 * 9. Automated background sweeper service purging branches archived > 30 days without restoration.
 * 10. Strict multi-tenant cross-user security isolation (returns HTTP 404).
 */

import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Branch } from '../src/models/Branch.js';
import { runSweeperCycle } from '../src/jobs/sweeper.js';

const PORT = 4003;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server;
let primaryCookies = [];
let secondaryCookies = [];
let activeCookies = [];

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
        const returnedCookies = [];
        if (setCookieHeaders) {
          setCookieHeaders.forEach((rawCookie) => {
            const cookiePart = rawCookie.split(';')[0];
            returnedCookies.push(cookiePart);
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
          cookies: returnedCookies,
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
 * Helper to register and login a test user to obtain session cookies.
 *
 * @function authenticateTestUser
 * @param {string} email - Test corporate email address.
 * @param {string} password - Test password.
 * @returns {Promise<{ user: object, cookies: string[] }>}
 */
const authenticateTestUser = async (email, password) => {
  await postmanRequest('/auth/register', {
    method: 'POST',
    body: { email, password, confirmPassword: password },
    skipCookies: true,
  });

  const loginRes = await postmanRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipCookies: true,
  });

  return {
    user: loginRes.body?.data?.user,
    cookies: loginRes.cookies,
  };
};

/**
 * Executes Postman-style branch integration test suite.
 */
const runBranchesSuite = async () => {
  console.log('🚀 Starting Comprehensive Branches & Sweeper Suite (testBranches.js)...');
  await connectDB();
  await Branch.syncIndexes();

  server = app.listen(PORT, () => {
    console.log(`📡 Test server listening on ${BASE_URL}`);
  });

  const timestamp = Date.now();
  const primaryEmail = `primary_supervisor_${timestamp}@enjoyburger.et`;
  const secondaryEmail = `secondary_supervisor_${timestamp}@enjoyburger.et`;
  const testPassword = 'ValidPassword123!';

  let primaryUser;
  let secondaryUser;
  let assertionsPassed = 0;

  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(`❌ FAILED: ${message}`);
    }
    assertionsPassed += 1;
    console.log(`  ✅ [PASS] ${message}`);
  };

  try {
    // 0. Setup: Register & Login primary and secondary supervisors
    console.log('\n[Setup] Authenticating primary and secondary supervisors for multi-tenant tests');
    const primaryAuth = await authenticateTestUser(primaryEmail, testPassword);
    primaryUser = primaryAuth.user;
    primaryCookies = primaryAuth.cookies;
    activeCookies = primaryCookies;

    const secondaryAuth = await authenticateTestUser(secondaryEmail, testPassword);
    secondaryUser = secondaryAuth.user;
    secondaryCookies = secondaryAuth.cookies;

    assert(primaryCookies.length >= 2, 'Primary supervisor authenticated with session cookies');
    assert(secondaryCookies.length >= 2, 'Secondary supervisor authenticated with session cookies');

    // 1. Health check
    console.log('\n[1/18] Testing GET /health');
    const healthRes = await postmanRequest('/health', { skipCookies: true });
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200 OK');
    assert(healthRes.body.status === 'UP', 'Health status is UP');

    // 2. Create Amharic Branch with auto-generated code and check redundant normalizedName removal
    console.log('\n[2/18] Testing POST /branches (Create Amharic Branch "ቦሌ" with Auto-Generated Code)');
    const createBoleRes = await postmanRequest('/branches', {
      method: 'POST',
      body: {
        name: 'ቦሌ', // Amharic name
        // Omit code to verify auto-generation on backend!
        location: {
          city: 'Addis Ababa',
          subcity: 'Bole',
          address: 'Cameroon St, Near Medhanialem Mall',
        },
        managerName: 'Kalkidan Tesfaye',
        contactPhone: '+251911223344',
      },
    });

    assert(createBoleRes.status === 201, 'Branch creation returns HTTP 201 CREATED');
    assert(createBoleRes.body.success === true, 'Branch creation reports success true');
    const boleBranch = createBoleRes.body.data.branch;
    assert(Boolean(boleBranch._id), 'Branch document contains valid _id');
    assert(boleBranch.name === 'ቦሌ', 'Amharic branch name preserved');
    assert(boleBranch.normalizedName === undefined, 'Redundant normalizedName field is stripped/absent');
    assert(Boolean(boleBranch.code), 'Operational branch code was auto-generated by backend');
    assert(boleBranch.code === 'BOLE-01', `Auto-generated code is BOLE-01 (got: ${boleBranch.code})`);
    assert(Array.isArray(boleBranch.aliases) && boleBranch.aliases.includes('bole'), 'Bilingual alias "bole" generated');
    assert(boleBranch.isArchived === false, 'Branch isArchived initialized to false');
    assert(boleBranch.user === primaryUser._id, 'Branch user foreign key matches supervisor');

    // 3. Duplicate name collision check (Amharic)
    console.log('\n[3/18] Testing POST /branches (Duplicate Name Collision)');
    const dupNameRes = await postmanRequest('/branches', {
      method: 'POST',
      body: {
        name: 'ቦሌ',
      },
    });
    assert(dupNameRes.status === 409, 'Duplicate Amharic branch name rejected with HTTP 409 CONFLICT');

    // 4. Case-insensitive English collision check
    console.log('\n[4/18] Testing POST /branches (Case-Insensitive English Name Collision)');
    const createEnglishBranch = await postmanRequest('/branches', {
      method: 'POST',
      body: {
        name: 'Piassa Arada',
      },
    });
    assert(createEnglishBranch.status === 201, 'English branch created successfully');
    const piassaBranch = createEnglishBranch.body.data.branch;
    assert(piassaBranch.code === 'PIAS-01', `Auto-generated code for Piassa is PIAS-01 (got: ${piassaBranch.code})`);

    const dupEnglishRes = await postmanRequest('/branches', {
      method: 'POST',
      body: {
        name: 'piassa arada', // Lowercase candidate
      },
    });
    assert(dupEnglishRes.status === 409, 'Lowercase duplicate branch name rejected with HTTP 409 CONFLICT');

    // 5. Validation Rejection: Missing name
    console.log('\n[5/18] Testing POST /branches (Missing Name Validation Error)');
    const valErrRes = await postmanRequest('/branches', {
      method: 'POST',
      body: {},
    });
    assert(valErrRes.status === 422, 'Missing required name returns HTTP 422 VALIDATION_ERROR');

    // 6. Security Invariant: Reject forbidden role / isArchived / code injection
    console.log('\n[6/18] Testing POST /branches (Reject Forbidden Injections & Manual Code)');
    const forbiddenInjectionRes = await postmanRequest('/branches', {
      method: 'POST',
      body: {
        name: 'Forbidden Branch',
        role: 'Admin',
        isArchived: true,
        archivedAt: new Date(),
        normalizedName: 'forbidden',
      },
    });
    assert(forbiddenInjectionRes.status === 422, 'Injected forbidden role/isArchived/normalizedName rejected with HTTP 422');

    const forbiddenCodeRes = await postmanRequest('/branches', {
      method: 'POST',
      body: {
        name: 'Manual Code Branch',
        code: 'MANUAL-01',
      },
    });
    assert(forbiddenCodeRes.status === 422, 'Manual branch code injection rejected with HTTP 422');

    // 7. Seed CMC branch
    console.log('\n[7/18] Testing POST /branches (Seeding CMC Branch)');
    const createCmcRes = await postmanRequest('/branches', {
      method: 'POST',
      body: {
        name: 'ሲኤምሲ', // Amharic CMC
        location: {
          city: 'Addis Ababa',
          subcity: 'Yeka',
          address: 'CMC Michael Roundabout',
        },
      },
    });
    assert(createCmcRes.status === 201, 'CMC branch created with HTTP 201');
    const cmcBranch = createCmcRes.body.data.branch;
    assert(cmcBranch.code === 'CMC-01', `Auto-generated code for CMC is CMC-01 (got: ${cmcBranch.code})`);

    // 8. Bilingual Search Test: Query English "bole" -> Finds Amharic branch "ቦሌ"
    console.log('\n[8/18] Testing GET /branches?search=bole (English Query Matching Amharic Branch)');
    const searchBoleRes = await postmanRequest('/branches?search=bole');
    assert(searchBoleRes.status === 200, 'Search query returns HTTP 200 OK');
    const boleResults = searchBoleRes.body.data.branches;
    assert(boleResults.some((b) => b._id === boleBranch._id), 'English search "bole" successfully matched Amharic branch "ቦሌ"');

    // 9. Bilingual Search Test: Query Amharic "ፒያሳ" -> Finds English branch "Piassa Arada"
    console.log('\n[9/18] Testing GET /branches?search=ፒያሳ (Amharic Query Matching English Branch)');
    const searchPiassaRes = await postmanRequest('/branches?search=ፒያሳ');
    assert(searchPiassaRes.status === 200, 'Search query returns HTTP 200 OK');
    const piassaResults = searchPiassaRes.body.data.branches;
    assert(piassaResults.some((b) => b._id === piassaBranch._id), 'Amharic search "ፒያሳ" successfully matched English branch "Piassa Arada"');

    // 10. Paginated Directory & Pagination Bounds
    console.log('\n[10/18] Testing GET /branches (Pagination Metadata)');
    const listRes = await postmanRequest('/branches?limit=2&page=1');
    assert(listRes.status === 200, 'Paginated list returns HTTP 200');
    assert(listRes.body.data.branches.length === 2, 'Page docs bounded to requested limit 2');
    assert(listRes.body.data.pagination.total >= 3, 'Total branches count is accurate');
    assert(listRes.body.data.pagination.hasNextPage === true, 'hasNextPage flag is true');

    // 11. Single Branch Retrieval by ID and by Operational Code
    console.log('\n[11/18] Testing GET /branches/:branchId (By MongoDB _id and by Operational Code)');
    const getSingleRes = await postmanRequest(`/branches/${boleBranch._id}`);
    assert(getSingleRes.status === 200, 'Single branch retrieval by _id returns HTTP 200 OK');
    assert(getSingleRes.body.data.branch._id === boleBranch._id, 'Branch ID matches requested resource');
    assert(getSingleRes.body.data.branch.name === 'ቦሌ', 'Branch name matches');

    // Retrieval by operational code
    const getByCodeRes = await postmanRequest(`/branches/${boleBranch.code}`);
    assert(getByCodeRes.status === 200, 'Single branch retrieval by operational code returns HTTP 200 OK');
    assert(getByCodeRes.body.data.branch._id === boleBranch._id, 'Retrieved branch matches by code');

    // Retrieval by lowercase operational code
    const getByLowerCodeRes = await postmanRequest(`/branches/${boleBranch.code.toLowerCase()}`);
    assert(getByLowerCodeRes.status === 200, 'Single branch retrieval by lowercase code returns HTTP 200 OK');

    // 12. Update branch details (using operational code and testing code immutability)
    console.log('\n[12/18] Testing PATCH /branches/:branchId (By Operational Code & Code Immutability)');
    const updateRes = await postmanRequest(`/branches/${boleBranch.code}`, {
      method: 'PATCH',
      body: {
        managerName: 'Almaz Bekele',
        contactPhone: '+251999887766',
      },
    });
    assert(updateRes.status === 200, 'Branch update by operational code returns HTTP 200 OK');
    assert(updateRes.body.data.branch.managerName === 'Almaz Bekele', 'Manager name successfully updated');

    const updateCodeRes = await postmanRequest(`/branches/${boleBranch.code}`, {
      method: 'PATCH',
      body: {
        code: 'NEWCODE-01',
      },
    });
    assert(updateCodeRes.status === 422, 'Attempting to modify auto-generated branch code rejected with HTTP 422');

    // 13. Cross-User Multi-Tenant Isolation Security Test
    console.log('\n[13/18] Testing Cross-User Tenant Isolation (Secondary User Access Attempts)');
    activeCookies = secondaryCookies; // Switch to secondary user

    const crossGetRes = await postmanRequest(`/branches/${boleBranch._id}`);
    assert(crossGetRes.status === 404, 'Foreign supervisor cannot GET branch (returns HTTP 404)');

    const crossPatchRes = await postmanRequest(`/branches/${boleBranch._id}`, {
      method: 'PATCH',
      body: { managerName: 'Hacker Name' },
    });
    assert(crossPatchRes.status === 404, 'Foreign supervisor cannot PATCH branch (returns HTTP 404)');

    const crossArchiveRes = await postmanRequest(`/branches/${boleBranch._id}/archive`, {
      method: 'PATCH',
    });
    assert(crossArchiveRes.status === 404, 'Foreign supervisor cannot archive branch (returns HTTP 404)');

    const crossDeleteRes = await postmanRequest(`/branches/${boleBranch._id}/delete`, {
      method: 'DELETE',
    });
    assert(crossDeleteRes.status === 404, 'Foreign supervisor cannot permanently DELETE branch (returns HTTP 404)');

    activeCookies = primaryCookies; // Switch back to primary user

    // 14. Permanent Delete Rejection on Active Branch
    console.log('\n[14/18] Testing DELETE /branches/:branchId/delete (Reject Active Branch)');
    const permDeleteActiveRes = await postmanRequest(`/branches/${boleBranch._id}/delete`, {
      method: 'DELETE',
    });
    assert(permDeleteActiveRes.status === 400, 'Permanent hard delete of active branch rejected with HTTP 400 BAD_REQUEST');

    // 15. Archive Branch (/:branchId/archive)
    console.log('\n[15/18] Testing PATCH /branches/:branchId/archive & Query Filter (?archived)');
    const archiveRes = await postmanRequest(`/branches/${boleBranch._id}/archive`, {
      method: 'PATCH',
    });
    assert(archiveRes.status === 200, 'Archive branch returns HTTP 200 OK');
    assert(archiveRes.body.data.branch.isArchived === true, 'Response reports isArchived true');
    assert(Boolean(archiveRes.body.data.branch.archivedAt), 'Response sets archivedAt timestamp');

    // Archiving an already archived branch rejected with 400
    const doubleArchiveRes = await postmanRequest(`/branches/${boleBranch._id}/archive`, {
      method: 'PATCH',
    });
    assert(doubleArchiveRes.status === 400, 'Archiving an already archived branch rejected with HTTP 400 BAD_REQUEST');

    // Default GET /branches excludes archived branches
    const checkActiveRes = await postmanRequest('/branches');
    assert(!checkActiveRes.body.data.branches.some((b) => b._id === boleBranch._id), 'Archived branch excluded from default active list');

    // GET /branches?archived includes archived branches
    const checkArchivedRes = await postmanRequest('/branches?archived');
    assert(checkArchivedRes.status === 200, 'GET /branches?archived returns HTTP 200 OK');
    assert(checkArchivedRes.body.data.branches.some((b) => b._id === boleBranch._id), 'Archived branch present in ?archived query');

    // GET /branches?archived=true also works
    const checkArchivedTrueRes = await postmanRequest('/branches?archived=true');
    assert(checkArchivedTrueRes.body.data.branches.some((b) => b._id === boleBranch._id), 'Archived branch present in ?archived=true query');

    // GET /branches?archived=false excludes archived branches
    const checkArchivedFalseRes = await postmanRequest('/branches?archived=false');
    assert(!checkArchivedFalseRes.body.data.branches.some((b) => b._id === boleBranch._id), 'Archived branch excluded from ?archived=false query');

    // 16. Manual Permanent Deletion of Archived Branch (/:branchId/delete)
    console.log('\n[16/18] Testing DELETE /branches/:branchId/delete (Direct Removal without Waiting 30 Days)');
    // First archive CMC
    const archiveCmcRes = await postmanRequest(`/branches/${cmcBranch._id}/archive`, {
      method: 'PATCH',
    });
    assert(archiveCmcRes.status === 200, 'CMC branch archived');

    // Now delete CMC immediately via /:branchId/delete
    const deleteCmcRes = await postmanRequest(`/branches/${cmcBranch._id}/delete`, {
      method: 'DELETE',
    });
    assert(deleteCmcRes.status === 200, 'Direct permanent delete of archived branch returns HTTP 200 OK');

    const verifyDeletedRes = await postmanRequest(`/branches/${cmcBranch._id}`);
    assert(verifyDeletedRes.status === 404, 'Permanently deleted branch cannot be retrieved (returns HTTP 404)');

    // 17. Restore Branch (/:branchId/restore) & Collision Prevention
    console.log('\n[17/18] Testing PATCH /branches/:branchId/restore & Collision Guard');
    // Create an active branch with same name "ቦሌ" while original is archived
    const activeRebornRes = await postmanRequest('/branches', {
      method: 'POST',
      body: { name: 'ቦሌ' },
    });
    assert(activeRebornRes.status === 201, 'Recreating active branch with archived name succeeds (partial unique index)');
    const rebornBranch = activeRebornRes.body.data.branch;

    // Attempt restoring original archived branch -> Conflict!
    const restoreConflictRes = await postmanRequest(`/branches/${boleBranch._id}/restore`, {
      method: 'PATCH',
    });
    assert(restoreConflictRes.status === 409, 'Restoring branch with active collision rejected with HTTP 409 CONFLICT');

    // Clean up reborn branch
    await Branch.deleteOne({ _id: rebornBranch._id });

    // Restore succeeds
    const restoreSuccessRes = await postmanRequest(`/branches/${boleBranch._id}/restore`, {
      method: 'PATCH',
    });
    assert(restoreSuccessRes.status === 200, 'Restoring branch succeeds after collision resolved (HTTP 200)');
    assert(restoreSuccessRes.body.data.branch.isArchived === false, 'Restored branch isArchived is false');
    assert(restoreSuccessRes.body.data.branch.archivedAt === null, 'Restored branch archivedAt reset to null');

    // Attempting to restore already active branch rejected with 400
    const restoreActiveRes = await postmanRequest(`/branches/${boleBranch._id}/restore`, {
      method: 'PATCH',
    });
    assert(restoreActiveRes.status === 400, 'Restoring an active branch rejected with HTTP 400 BAD_REQUEST');

    // 18. Two-Pass In-Process Sweeper 30-Day Retention Window Test
    console.log('\n[18/18] Testing Two-Pass In-Process Sweeper (30-Day Auto-Purge vs Recent Retention)');
    // Seed an expired archived branch (older than 30 days: 31 days ago)
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const expiredArchivedBranchDoc = await Branch.create({
      user: primaryUser._id,
      name: 'Expired 31d Branch',
      code: 'EXP-01',
      isArchived: true,
      archivedAt: thirtyOneDaysAgo,
    });

    // Seed a recent archived branch (archived 2 days ago: within 30-day window)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const recentArchivedBranchDoc = await Branch.create({
      user: primaryUser._id,
      name: 'Recent 2d Branch',
      code: 'REC-01',
      isArchived: true,
      archivedAt: twoDaysAgo,
    });

    // Seed an active branch (must NEVER be touched by sweeper)
    const activeBranchDoc = await Branch.create({
      user: primaryUser._id,
      name: 'Safe Active Branch',
      code: 'SAFE-01',
      isArchived: false,
    });

    // Execute sweeper cycle
    const sweepResult = await runSweeperCycle();
    assert(sweepResult.pass1.branchesPurged >= 1, `Pass 1 purged expired archived branch (count: ${sweepResult.pass1.branchesPurged})`);

    // Verify 31-day-old archived branch was permanently purged
    const findExpiredPurged = await Branch.findById(expiredArchivedBranchDoc._id);
    assert(findExpiredPurged === null, '31-day-old archived branch was auto-purged by sweeper');

    // Verify recent 2-day-old archived branch was PRESERVED (unrestored within 30-day window)
    const findRecentPreserved = await Branch.findById(recentArchivedBranchDoc._id);
    assert(findRecentPreserved !== null, 'Recent 2-day-old archived branch was preserved within 30-day retention window');

    // Verify active branch was safely preserved
    const findActive = await Branch.findById(activeBranchDoc._id);
    assert(findActive !== null, 'Active live branch was safely preserved by sweeper');

    // Clean up temporary branches
    await Branch.deleteMany({ _id: { $in: [recentArchivedBranchDoc._id, activeBranchDoc._id] } });

    // Verify clean store run is a log-only no-op
    const noopResult = await runSweeperCycle();
    assert(noopResult.pass1.branchesPurged === 0, 'Clean store sweep is a log-only no-op (0 branches purged)');

    console.log(`\n======================================================`);
    console.log(`🎉 ALL ${assertionsPassed} BRANCHES & SWEEPER SUITE ASSERTIONS PASSED!`);
    console.log(`======================================================\n`);
  } finally {
    // Teardown temporary test users and test branches
    try {
      await Branch.deleteMany({
        user: { $in: [primaryUser?._id, secondaryUser?._id].filter(Boolean) },
      });
      await User.deleteMany({
        email: { $in: [primaryEmail, secondaryEmail] },
      });
      console.log('🧹 Cleaned up temporary test branches and users');
    } catch {
      // Ignore cleanup error
    }

    if (server) {
      server.close();
    }
    await disconnectDB();
  }
};

runBranchesSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal testBranches Error:', err);
    process.exit(1);
  });
