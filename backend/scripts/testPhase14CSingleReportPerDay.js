/**
 * @file testPhase14CSingleReportPerDay.js
 * @description Comprehensive automated verification test for Phase 14B Point 28:
 * Dual-calendar uniqueness (Gregorian & Ethiopian), controlled create_report rejection with guidance,
 * flexible update_report target resolution by date, and active <today_report> prompt injection.
 */

import mongoose from 'mongoose';
import assert from 'assert';
import env from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Branch } from '../src/models/Branch.js';
import { Report } from '../src/models/Report.js';
import { executeAgentTool } from '../src/tools/agentTools.js';
import { assembleSystemPrompt } from '../src/utils/promptAssembler.js';
import { toEthiopianDateString } from '../src/utils/ethiopianCalendar.js';

async function runTest() {
  console.log('='.repeat(80));
  console.log('PHASE 14B POINT 28: DUAL-CALENDAR UNIQUENESS & SUFFICIENT REASON TEST');
  console.log('='.repeat(80));

  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB Atlas.');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  const testSuffix = Date.now();
  const testUser = await User.create({
    email: `single_report_test_${testSuffix}@example.com`,
    password: 'Password123!',
    firstName: 'TestSingle',
    lastName: 'Supervisor',
    role: 'supervisor',
  });

  const testBranch = await Branch.create({
    user: testUser._id,
    name: `Test Bole Branch ${testSuffix}`,
    code: `BOLE-${String(testSuffix).slice(-3)}`,
    location: 'Bole Road, Addis Ababa',
  });

  const testDate = '2026-10-25';
  const testEthDate = toEthiopianDateString(new Date(testDate));

  try {
    // 1. Initial report creation succeeds on testDate
    let initialReportId = null;
    await test('Initial report creation for a date succeeds and derives dual calendar fields', async () => {
      const res = await executeAgentTool(
        'create_report',
        {
          date: testDate,
          clockIn: '08:00',
          clockOut: '17:00',
          visits: [
            {
              branch: testBranch._id.toString(),
              clockIn: '08:30',
              clockOut: '12:00',
            },
          ],
          activities: [{ text: 'Morning hygiene and food safety audit' }],
          issues: [{ text: 'Espresso pressure below standard' }],
          comments: [{ text: 'Branch was clean and staff compliant' }],
          transcription: 'የጥቅምት 15 ቀን 2019 የቦሌ ብራንች የጠዋት ሪፖርት',
        },
        { userId: testUser._id }
      );

      assert.strictEqual(res.success, true, 'Tool invocation must succeed');
      const data = res.data;
      assert.strictEqual(data.success, true, 'Result payload must indicate success: true');
      assert.ok(data.reportId, 'Must return reportId');
      assert.strictEqual(data.dateString, testDate, 'Must have normalized dateString');
      assert.strictEqual(data.ethiopianDate, testEthDate, 'Must have normalized ethiopianDate');
      initialReportId = data.reportId;

      const doc = await Report.findById(initialReportId).lean();
      assert.ok(doc, 'Report document must exist in MongoDB');
      assert.strictEqual(doc.dateString, testDate);
      assert.strictEqual(doc.ethiopianDate, testEthDate);
    });

    // 2. Second report creation for the same Gregorian date fails with REPORT_ALREADY_EXISTS and guidance
    await test('Second report creation for same Gregorian date is rejected with REPORT_ALREADY_EXISTS and guidance', async () => {
      const res = await executeAgentTool(
        'create_report',
        {
          date: testDate,
          clockIn: '13:00',
          clockOut: '17:00',
          visits: [
            {
              branch: testBranch._id.toString(),
              clockIn: '13:30',
              clockOut: '16:00',
            },
          ],
          activities: [{ text: 'Afternoon inventory stock count' }],
          issues: [{ text: 'Syrup bottles low in stock' }],
          transcription: 'የቦሌ ከሰዓት በኋላ የተደረገ ቆጠራ',
        },
        { userId: testUser._id }
      );

      assert.strictEqual(res.success, true, 'Tool invocation must return structured result');
      const data = res.data;
      assert.strictEqual(data.success, false, 'Result must indicate success: false');
      assert.strictEqual(data.code, 'REPORT_ALREADY_EXISTS', 'Must return code REPORT_ALREADY_EXISTS');
      assert.ok(data.existingReport, 'Must return existingReport object');
      assert.strictEqual(data.existingReport.reportId, initialReportId, 'Must point to initial reportId');
      assert.ok(data.guidance.includes('update_report'), 'Guidance must instruct agent to invoke update_report');
      console.log('       -> Received rejection message:', data.message);
    });

    // 3. Second report creation using Ethiopian date format for the same day is also rejected
    await test('Second report creation using Ethiopian date format is rejected with REPORT_ALREADY_EXISTS', async () => {
      const res = await executeAgentTool(
        'create_report',
        {
          date: testEthDate, // Ethiopian date string e.g. 15-02-19
          clockIn: '08:00',
          clockOut: '17:00',
          visits: [
            {
              branch: testBranch._id.toString(),
              clockIn: '09:00',
              clockOut: '11:00',
            },
          ],
          activities: [{ text: 'Duplicate check via Ethiopian date' }],
          transcription: 'የተደገመ ሪፖርት ሙከራ',
        },
        { userId: testUser._id }
      );

      assert.strictEqual(res.success, true, 'Tool invocation must return structured result');
      const data = res.data;
      assert.strictEqual(data.success, false, 'Result must indicate success: false');
      assert.strictEqual(data.code, 'REPORT_ALREADY_EXISTS', 'Must return code REPORT_ALREADY_EXISTS');
      assert.strictEqual(data.existingReport.reportId, initialReportId);
    });

    // 4. Assert MongoDB only has ONE active report document for this user on this date
    await test('Database contains strictly 1 active report document for this supervisor on this date', async () => {
      const count = await Report.countDocuments({
        user: testUser._id,
        isArchived: false,
        dateString: testDate,
      });
      assert.strictEqual(count, 1, `Must have exactly 1 report document, found: ${count}`);
    });

    // 5. update_report with reportId appends new activities and issues to the existing report
    await test('update_report with reportId amends existing report cleanly', async () => {
      const updateRes = await executeAgentTool(
        'update_report',
        {
          reportId: initialReportId,
          newActivities: [{ text: 'Afternoon refrigeration temperature audit (4°C)' }],
          newIssues: [{ text: 'Secondary ice machine filter needs replacement' }],
          clockOut: '18:00',
        },
        { userId: testUser._id }
      );

      assert.strictEqual(updateRes.success, true);
      const data = updateRes.data;
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.reportId, initialReportId);
      assert.strictEqual(data.clockOut, '18:00');

      const updatedDoc = await Report.findById(initialReportId).lean();
      assert.strictEqual(updatedDoc.clockOut, '18:00');
      assert.strictEqual(updatedDoc.activities.length, 2, 'Must have 2 activities');
      assert.strictEqual(updatedDoc.issues.length, 2, 'Must have 2 issues');
      assert.ok(
        updatedDoc.activities.some((a) => a.text.includes('refrigeration temperature')),
        'Must contain newly appended activity'
      );
    });

    // 6. update_report with date (omitting reportId) resolves target report and updates it
    await test('update_report with date (omitting reportId) resolves report and updates successfully', async () => {
      const updateRes = await executeAgentTool(
        'update_report',
        {
          date: testDate,
          newComments: [{ text: 'Evening handover completed without incident' }],
          clockOut: '18:30',
        },
        { userId: testUser._id }
      );

      assert.strictEqual(updateRes.success, true);
      const data = updateRes.data;
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.reportId, initialReportId);
      assert.strictEqual(data.clockOut, '18:30');

      const updatedDoc = await Report.findById(initialReportId).lean();
      assert.strictEqual(updatedDoc.clockOut, '18:30');
      assert.strictEqual(updatedDoc.comments.length, 2, 'Must have 2 comments');
      assert.ok(
        updatedDoc.comments.some((c) => c.text.includes('Evening handover')),
        'Must contain newly appended comment'
      );
    });

    // 7. promptAssembler actively injects <today_report> when a report exists for today
    await test('promptAssembler injects active today report into system prompt with update instruction', async () => {
      const today = new Date();
      const todayDateStr = today.toISOString().split('T')[0];
      const todayEthStr = toEthiopianDateString(today);

      // Create a report for today
      const todayRep = await Report.create({
        user: testUser._id,
        date: today,
        dateString: todayDateStr,
        ethiopianDate: todayEthStr,
        clockIn: '08:00',
        clockOut: '17:00',
        visits: [{ branch: testBranch._id, clockIn: '08:30', clockOut: '12:00' }],
        activities: [{ text: 'Today morning inspection' }],
        issues: [{ text: 'Today morning minor defect' }],
        transcription: 'የዛሬ ሪፖርት',
      });

      const assembledPrompt = await assembleSystemPrompt({
        userId: testUser._id,
        user: testUser,
        now: today,
      });

      assert.ok(
        assembledPrompt.includes("[ACTIVE TODAY'S REPORT IN DATABASE]"),
        'Prompt must contain ACTIVE TODAY\'S REPORT section'
      );
      assert.ok(
        assembledPrompt.includes(todayRep._id.toString()),
        'Prompt must contain today\'s report ObjectId'
      );
      assert.ok(
        assembledPrompt.includes('NEVER invoke create_report again for today'),
        'Prompt must instruct NEVER call create_report again for today'
      );
      assert.ok(
        assembledPrompt.includes(`update_report(reportId: "${todayRep._id}")`),
        'Prompt must instruct update_report with today\'s ID'
      );
      console.log('       -> Verified prompt injection of active today report.');
    });

    console.log('='.repeat(80));
    console.log(`PHASE 14B POINT 28 VERIFICATION RESULTS: ${passed} / ${total} TESTS PASSED`);
    console.log('='.repeat(80));
  } finally {
    // Clean up test documents
    await Report.deleteMany({ user: testUser._id });
    await Branch.deleteMany({ user: testUser._id });
    await User.deleteOne({ _id: testUser._id });
    await mongoose.disconnect();
    console.log('Test data cleaned up and disconnected.');
  }

  if (passed !== total) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
