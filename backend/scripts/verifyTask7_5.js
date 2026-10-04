/**
 * @module scripts/verifyTask7_5
 * @description Comprehensive automated verification test suite for Task 7.5 + Task 7.5b:
 * The Complete 17-Tool Enterprise Operational Matrix (agentTools.js) and
 * Configurable Dynamic Prompt Assembler Engine (promptAssembler.js).
 */

import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Branch } from '../src/models/Branch.js';
import { Report } from '../src/models/Report.js';
import { Type } from '@google/genai';
import {
  agentToolDeclarations,
  toolHandlers,
  executeAgentTool,
} from '../src/tools/agentTools.js';
import {
  DEFAULT_PERSONA,
  DEFAULT_SINGLE_BRANCH_TEMPLATE,
  DEFAULT_MULTI_BRANCH_TEMPLATE,
  formatSingleBranchTemplate,
  formatMultiBranchTemplate,
  assembleSystemPrompt,
} from '../src/utils/promptAssembler.js';
import { toEthiopianDateString } from '../src/utils/ethiopianCalendar.js';
import { CHAT_CONSTANTS, REPORT_CONSTANTS, BRANCH_CONSTANTS } from '../src/utils/constants.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAILED: ${message}`);
  }
}

async function runTask75Verification() {
  console.log('\n================================================================');
  console.log('--- TASK 7.5 + 7.5b VERIFICATION SUITE: 17 TOOLS & PROMPT ASSEMBLER ---');
  console.log('================================================================\n');

  // ==============================================================
  // 1. Checking Tool Declarations & Schemas (@google/genai format)
  // ==============================================================
  console.log('1. Checking Agent Tool Declarations (@google/genai specification)...');

  assert(Array.isArray(agentToolDeclarations), 'agentToolDeclarations is an array');
  assert(
    agentToolDeclarations.length === 17,
    `Declares exactly 17 tools in the enterprise matrix (got: ${agentToolDeclarations.length})`
  );

  const toolNames = agentToolDeclarations.map((t) => t.name);
  const expectedTools = [
    // Branch Scope (6)
    'lookup_user_branches',
    'create_branch',
    'update_branch',
    'archive_branch',
    'restore_branch',
    'delete_branch_permanently',
    // Report Scope (6)
    'create_report',
    'update_report',
    'update_branch_record_status',
    'archive_report',
    'restore_report',
    'delete_report_permanently',
    // Enterprise Intelligence (2)
    'query_historical_reports',
    'query_branch_records',
    // External Channels & SSOT (3)
    'export_report',
    'share_to_telegram',
    'save_supervisor_directive',
  ];

  expectedTools.forEach((expected) => {
    assert(toolNames.includes(expected), `Declares tool: ${expected}`);
  });

  agentToolDeclarations.forEach((decl) => {
    assert(
      typeof decl.name === 'string' && decl.name.length > 0,
      `Tool "${decl.name}" has valid name`
    );
    assert(
      typeof decl.description === 'string' && decl.description.length > 10,
      `Tool "${decl.name}" has descriptive documentation`
    );
    assert(
      decl.parameters && decl.parameters.type === Type.OBJECT,
      `Tool "${decl.name}" parameters type is Type.OBJECT`
    );
    assert(
      typeof decl.parameters.properties === 'object',
      `Tool "${decl.name}" parameters properties is an object`
    );
  });

  // Verify Branch Creation schema
  const createBranchDecl = agentToolDeclarations.find((t) => t.name === 'create_branch');
  assert(
    createBranchDecl.parameters.required.includes('name') &&
      createBranchDecl.parameters.required.includes('address') &&
      createBranchDecl.parameters.required.includes('phone') &&
      createBranchDecl.parameters.required.includes('managerName'),
    'create_branch enforces required name, address, phone, managerName'
  );

  // Verify Report Creation schema
  const createReportDecl = agentToolDeclarations.find((t) => t.name === 'create_report');
  const requiredCreateFields = [
    'date',
    'clockIn',
    'clockOut',
    'visits',
    'transcription',
    'activities',
    'issues',
    'comments',
  ];
  requiredCreateFields.forEach((field) => {
    assert(
      createReportDecl.parameters.required.includes(field),
      `create_report requires field: "${field}"`
    );
  });

  // Verify Plural Query parameter schemas
  const histDecl = agentToolDeclarations.find((t) => t.name === 'query_historical_reports');
  assert(
    histDecl.parameters.properties.branchIds &&
      histDecl.parameters.properties.branchIds.type === Type.ARRAY,
    'query_historical_reports accepts plural branchIds array'
  );

  const branchRecordsDecl = agentToolDeclarations.find((t) => t.name === 'query_branch_records');
  assert(
    branchRecordsDecl.parameters.properties.branchIds &&
      branchRecordsDecl.parameters.properties.branchIds.type === Type.ARRAY,
    'query_branch_records accepts plural branchIds array'
  );

  // Verify Export and Telegram schemas
  const exportDecl = agentToolDeclarations.find((t) => t.name === 'export_report');
  assert(exportDecl.parameters.required.includes('format'), 'export_report requires format');

  const telegramDecl = agentToolDeclarations.find((t) => t.name === 'share_to_telegram');
  assert(telegramDecl.parameters.properties.targetChannel !== undefined, 'share_to_telegram defines targetChannel');

  // ==============================================================
  // 2. Checking Prompt Assembler 6 Building Blocks & Architectural Laws
  // ==============================================================
  console.log('\n2. Checking Configurable Prompt Assembler (6 Building Blocks & Invariants)...');

  const mockUserWithTemplates = {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'Abebe',
    lastName: 'Bikila',
    fullName: 'Abebe Bikila',
    settings: {
      agentConfig: {
        persona: 'Custom Corporate Senior Auditor for Addis Fine Dining',
        defaultLanguage: 'am',
      },
      reportTemplates: {
        singleBranch:
          'ቀን: [DD-MM-YY]\nብራንች: [ብራንች ስም]\nየገንዘብ ቁጥጥር: [ያለቀለት]\nየፍሪጅ ሙቀት: 3.5°C\nየተሰሩ ስራዎች:\n - [ስራ 1]\nመፍትሄ የሚፈልጉ ጉዳዮች:\n - [ችግር 1]',
        multiBranch:
          'ቀን: [DD-MM-YY]\nብራንቾች: [ዝርዝር]\nየገንዘብ ቁጥጥር: [ሁሉም]\nየተሰሩ ስራዎች:\n - [ስራ 1]\nመፍትሄ የሚፈልጉ ጉዳዮች:\n - [ችግር 1]',
      },
      directives: {
        negativeVocabulary: ['ችግር', 'ተበላሽቷል'],
        phraseMappings: new Map([
          ['ችግር', 'ማሻሻያ የሚያስፈልገው ነጥብ'],
          ['ተዘግቷል', 'ለጥገና ስራ ለጊዜው አገልግሎት አቋርጧል'],
        ]),
        customInstructions: ['Always check refrigeration temperatures below 4°C'],
      },
    },
  };

  const mockBranches = [
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Bole Medhanialem',
      code: 'BOLE-01',
      location: { address: 'Cameroon St.' },
      managerName: 'Dawit Tadesse',
      contactPhone: '0911223344',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Piassa Arada',
      code: 'PIAS-01',
      location: { address: 'Churchill Ave.' },
      managerName: 'Selam Haile',
      contactPhone: '0922334455',
    },
  ];

  const mockReports = [
    {
      date: new Date('2026-10-01T00:00:00.000Z'),
      visits: [{ branch: { name: 'Bole Medhanialem', code: 'BOLE-01' }, clockIn: '08:30', clockOut: '12:00' }],
      issues: [
        { text: 'Walk-in freezer seal damaged', status: 'reported' },
        { text: 'Chiller temperature normal', status: 'no_issue' },
      ],
    },
  ];

  const fixedDate = new Date('2026-10-03T10:00:00.000Z');
  const compiledPrompt = await assembleSystemPrompt({
    user: mockUserWithTemplates,
    chatConfig: { language: 'am', prompt: 'Focus especially on hygiene standards today.' },
    activeBranches: mockBranches,
    recentReports: mockReports,
    now: fixedDate,
  });

  assert(typeof compiledPrompt === 'string' && compiledPrompt.length > 500, 'Compiled system prompt is a non-empty string');

  // Block 1 assertions
  assert(
    compiledPrompt.includes('CONSTITUTIONAL PRECEDENCE CLAUSE (SYSTEM CORE AUTHORITY)'),
    'Block 1: Injects Constitutional Precedence Clause'
  );
  assert(
    compiledPrompt.includes('You are Operon, an elite Personal AI Agent and Operations Copilot'),
    'Block 1: Codifies Operon core identity'
  );
  assert(
    compiledPrompt.includes('You embody Dual Excellence'),
    'Block 1: Codifies Dual Excellence (operations + personal versatility)'
  );
  assert(
    compiledPrompt.includes('<user_persona>Custom Corporate Senior Auditor for Addis Fine Dining</user_persona>'),
    'Block 1: Injects sandboxed <user_persona> as specialized lens'
  );
  assert(
    compiledPrompt.includes('OPERATIONAL LENS RULE'),
    'Block 1: Mandates persona must never restrict general intelligence or tools'
  );

  // Block 2 assertions
  assert(compiledPrompt.includes('23-01-19'), 'Block 2: Injects calculated Ethiopian date (23-01-19)');
  assert(
    compiledPrompt.includes('DYNAMIC LINGUISTIC EMPATHY:'),
    'Block 2: Codifies Dynamic Linguistic Empathy'
  );
  assert(
    compiledPrompt.includes('<custom_single_branch_template>') &&
      compiledPrompt.includes('የገንዘብ ቁጥጥር: [ያለቀለት]'),
    'Block 2: Injects custom user Single-Branch template from User.settings.reportTemplates'
  );
  assert(
    compiledPrompt.includes('<custom_multi_branch_template>') &&
      compiledPrompt.includes('የገንዘብ ቁጥጥር: [ሁሉም]'),
    'Block 2: Injects custom user Multi-Branch template from User.settings.reportTemplates'
  );
  assert(
    compiledPrompt.includes('TEMPLATE ISOLATION BOUNDARY:'),
    'Block 2: Mandates Template Isolation Boundary (templates strictly for Quadrant 2)'
  );

  // Block 3 assertions
  assert(
    compiledPrompt.includes('SCOPE GUARD: Directives apply strictly to corporate operational deliverables'),
    'Block 3: Injects Directives Scope Guard'
  );
  assert(compiledPrompt.includes('FORBIDDEN NEGATIVE VOCABULARY:'), 'Block 3: Injects forbidden negative vocabulary header');
  assert(compiledPrompt.includes('ችግር'), 'Block 3: Lists forbidden word "ችግር"');
  assert(compiledPrompt.includes('ማሻሻያ የሚያስፈልገው ነጥብ'), 'Block 3: Injects phrase mapping replacement "ማሻሻያ የሚያስፈልገው ነጥብ"');
  assert(
    compiledPrompt.includes('Always check refrigeration temperatures below 4°C'),
    'Block 3: Injects custom corporate operational instruction'
  );

  // Block 4 assertions
  assert(
    compiledPrompt.includes('PASSIVE CONTEXT BOUNDARY LAW: The branch registry and operational codes represent passive background knowledge'),
    'Block 4: Enforces Passive Context Boundary Law on active branch registry'
  );
  assert(compiledPrompt.includes('Bole Medhanialem'), 'Block 4: Lists active branch name');
  assert(compiledPrompt.includes('BOLE-01'), 'Block 4: Lists active branch code');
  assert(
    compiledPrompt.includes(mockBranches[0]._id.toString()),
    'Block 4: Grounding with exact 24-hex MongoDB ObjectId'
  );

  // Block 5 assertions
  assert(
    compiledPrompt.includes('PASSIVE CONTEXT BOUNDARY LAW: Baseline audit logs provide longitudinal context'),
    'Block 5: Enforces Passive Context Boundary Law on historical baseline'
  );
  assert(
    compiledPrompt.includes('Walk-in freezer seal damaged'),
    'Block 5: Injects unresolved historical issue into baseline'
  );
  assert(
    !compiledPrompt.includes('Chiller temperature normal'),
    'Block 5: Excludes non-issue status items from unresolved baseline issues'
  );

  // Block 6 assertions
  assert(
    compiledPrompt.includes('<turn_guidance>Focus especially on hygiene standards today.</turn_guidance>'),
    'Block 6: Injects sandboxed <turn_guidance> from composer prompt'
  );
  assert(
    compiledPrompt.includes('THE 4-QUADRANT INTENT ROUTING PROTOCOL:'),
    'Block 6: Injects the complete 4-Quadrant Intent Routing Protocol'
  );
  assert(
    compiledPrompt.includes('1. QUADRANT 1: BRANCH SCOPE'),
    'Block 6: Defines Quadrant 1 (Branch Scope infrastructure)'
  );
  assert(
    compiledPrompt.includes('2. QUADRANT 2: REPORT SCOPE'),
    'Block 6: Defines Quadrant 2 (Report Scope deliverables & completeness loop)'
  );
  assert(
    compiledPrompt.includes('archive_report') &&
      compiledPrompt.includes('restore_report') &&
      compiledPrompt.includes('delete_report_permanently'),
    'Block 6: Quadrant 2 explicitly enumerates full report lifecycle tools'
  );
  assert(
    compiledPrompt.includes('3. QUADRANT 3: RELATED DOMAIN THINGS'),
    'Block 6: Defines Quadrant 3 (Hospitality & ops advisory with ZERO tools)'
  );
  assert(
    compiledPrompt.includes('4. QUADRANT 4: COMPLETELY UNKNOWN / UNRELATED'),
    'Block 6: Defines Quadrant 4 (General Personal AI with ZERO tools)'
  );
  assert(
    compiledPrompt.includes('CONVERSATIONAL DYNAMICS:'),
    'Block 6: Defines dynamic Work-Life Pivots & Compound Multi-Intent Turns'
  );

  // Test empty/new user defaults and fallbacks
  const emptyUser = { _id: new mongoose.Types.ObjectId(), firstName: 'Newbie' };
  const fallbackPrompt = await assembleSystemPrompt({
    user: emptyUser,
    activeBranches: [],
    recentReports: [],
    now: fixedDate,
  });
  assert(
    fallbackPrompt.includes(DEFAULT_PERSONA),
    'Fallback: Uses DEFAULT_PERSONA dual identity for newly registered supervisor'
  );
  assert(
    fallbackPrompt.includes('1. SINGLE-BRANCH REPORT TEMPLATE') &&
      fallbackPrompt.includes('ስራ የገባሁበት ሰዓት: [HH:mm]'),
    'Fallback: Injects authoritative default Single-Branch template when settings.reportTemplates is empty'
  );
  assert(
    fallbackPrompt.includes('2. MULTI-BRANCH REPORT TEMPLATE') &&
      fallbackPrompt.includes('እና [ሶስተኛ ብራንች]'),
    'Fallback: Injects authoritative default Multi-Branch template when settings.reportTemplates is empty'
  );
  assert(
    fallbackPrompt.includes('No active branches are currently registered'),
    'Fallback: Handles empty branch list gracefully'
  );
  assert(
    fallbackPrompt.includes('No prior operational inspection reports recorded yet'),
    'Fallback: Handles empty historical reports gracefully'
  );

  // ==============================================================
  // 3. Testing Tool Handlers In-Process Execution with Live Database
  // ==============================================================
  console.log('\n3. Testing In-Process Tool Execution Handlers against Database...');
  await connectDB();

  let testUser = null;
  let branchBole = null;
  let branchPiassa = null;
  let branchSarbet = null;
  let createdReportId = null;
  let createdIssueId = null;

  try {
    // 3.1 Setup test supervisor
    testUser = await User.create({
      firstName: 'Almaz',
      lastName: 'Ayana',
      email: `test_matrix_${Date.now()}@enjoyburger.et`,
      password: 'StrongPassword123!',
      settings: {
        agentConfig: {
          persona: 'Area Operations Partner',
          defaultLanguage: 'am',
        },
        reportTemplates: {
          singleBranch: null,
          multiBranch: null,
        },
        directives: {
          negativeVocabulary: ['መጥፎ'],
          phraseMappings: new Map([['መጥፎ', 'መሻሻል ያለበት']]),
          customInstructions: ['Inspect chiller daily'],
        },
      },
    });

    // --------------------------------------------------------------------------
    // 3.2 Branch Scope Tools (CRUD & Lifecycle)
    // --------------------------------------------------------------------------
    console.log('   Testing Category 1: Branch Scope Tools (ACID Lifecycle)...');

    // Tool 2: create_branch
    const createBoleRes = await executeAgentTool(
      'create_branch',
      {
        name: 'Bole Medhanialem Branch',
        address: 'Bole Road near Edna Mall',
        phone: '0911002233',
        managerName: 'Dawit Tadesse',
      },
      { userId: testUser._id }
    );
    assert(createBoleRes.success === true, 'create_branch creates Bole branch successfully');
    assert(createBoleRes.data.code && createBoleRes.data.code.startsWith('BOLE'), 'create_branch auto-generates operational code');
    branchBole = await Branch.findById(createBoleRes.data.branchId);
    assert(branchBole !== null && branchBole.aliases.length > 0, 'create_branch populates transliterated aliases');

    // create_branch collision test
    const duplicateRes = await executeAgentTool(
      'create_branch',
      {
        name: 'Bole Medhanialem Branch',
        address: 'Different address',
        phone: '0911999999',
        managerName: 'Someone Else',
      },
      { userId: testUser._id }
    );
    assert(duplicateRes.success === false, 'create_branch prevents duplicate active branch name collision');

    // Create a second branch: Piassa
    const createPiassaRes = await executeAgentTool(
      'create_branch',
      {
        name: 'Piassa Arada Express',
        address: 'Churchill Ave',
        phone: '0922114455',
        managerName: 'Selam Haile',
      },
      { userId: testUser._id }
    );
    assert(createPiassaRes.success === true, 'create_branch creates Piassa branch successfully');
    branchPiassa = await Branch.findById(createPiassaRes.data.branchId);

    // Tool 1: lookup_user_branches
    const lookupRes = await executeAgentTool('lookup_user_branches', {}, { userId: testUser._id });
    assert(lookupRes.success === true, 'lookup_user_branches executes successfully');
    assert(lookupRes.data.count === 2, `lookup_user_branches returns 2 active branches (got: ${lookupRes.data.count})`);

    const searchRes = await executeAgentTool(
      'lookup_user_branches',
      { search: 'Piassa' },
      { userId: testUser._id }
    );
    assert(searchRes.data.count === 1 && searchRes.data.branches[0].name.includes('Piassa'), 'lookup_user_branches supports search query');

    // Tool 3: update_branch
    const updateBranchRes = await executeAgentTool(
      'update_branch',
      {
        branchId: branchBole._id.toString(),
        managerName: 'Tigist Alemu',
        phone: '0988776655',
        address: 'Bole Medhanialem Mall 2nd Floor',
      },
      { userId: testUser._id }
    );
    assert(updateBranchRes.success === true, 'update_branch updates branch manager and address');
    assert(updateBranchRes.data.managerName === 'Tigist Alemu', 'update_branch confirms updated managerName');

    // Create a temporary branch to test archive, restore, and permanent deletion
    const createTempRes = await executeAgentTool(
      'create_branch',
      {
        name: 'Sarbet Takeaway',
        address: 'Sarbet Roundabout',
        phone: '0933445566',
        managerName: 'Kenenisa',
      },
      { userId: testUser._id }
    );
    branchSarbet = await Branch.findById(createTempRes.data.branchId);

    // Tool 4: archive_branch
    const archiveBranchRes = await executeAgentTool(
      'archive_branch',
      { branchId: branchSarbet._id.toString() },
      { userId: testUser._id }
    );
    assert(archiveBranchRes.success === true, 'archive_branch soft-archives branch');
    assert(archiveBranchRes.data.isArchived === true, 'archive_branch returns isArchived: true');

    const lookupArchivedRes = await executeAgentTool(
      'lookup_user_branches',
      { status: 'archived' },
      { userId: testUser._id }
    );
    assert(
      lookupArchivedRes.data.count === 1 && lookupArchivedRes.data.branches[0].name.includes('Sarbet'),
      'lookup_user_branches with status: "archived" retrieves archived branch'
    );

    // Tool 5: restore_branch
    const restoreBranchRes = await executeAgentTool(
      'restore_branch',
      { branchId: branchSarbet._id.toString() },
      { userId: testUser._id }
    );
    assert(restoreBranchRes.success === true, 'restore_branch restores archived branch');
    assert(restoreBranchRes.data.isArchived === false, 'restore_branch returns isArchived: false');

    // Tool 6: delete_branch_permanently
    // Attempt deletion while active -> must fail
    const prematureDeleteRes = await executeAgentTool(
      'delete_branch_permanently',
      { branchId: branchSarbet._id.toString() },
      { userId: testUser._id }
    );
    assert(prematureDeleteRes.success === false, 'delete_branch_permanently rejects deleting active branch');

    // Re-archive and permanently delete
    await executeAgentTool('archive_branch', { branchId: branchSarbet._id.toString() }, { userId: testUser._id });
    const deleteBranchRes = await executeAgentTool(
      'delete_branch_permanently',
      { branchId: branchSarbet._id.toString() },
      { userId: testUser._id }
    );
    assert(deleteBranchRes.success === true, 'delete_branch_permanently cascades hard delete for archived branch');
    const checkedSarbet = await Branch.findById(branchSarbet._id);
    assert(checkedSarbet === null, 'Sarbet branch is confirmed deleted from MongoDB');
    branchSarbet = null;

    // --------------------------------------------------------------------------
    // 3.3 Report Scope Tools (CRUD & Lifecycle)
    // --------------------------------------------------------------------------
    console.log('\n   Testing Category 2: Report Scope Tools (ACID Lifecycle)...');

    // Tool 7: create_report
    const reportPayload = {
      date: '2026-10-02T00:00:00.000Z',
      clockIn: '08:30',
      clockOut: '17:30',
      visits: [
        {
          branch: branchBole._id.toString(),
          clockIn: '08:30',
          clockOut: '12:00',
        },
        {
          branch: branchPiassa._id.toString(),
          clockIn: '13:00',
          clockOut: '17:30',
        },
      ],
      activities: [
        { text: 'Audited kitchen cleanliness and oil quality', status: 'completed' },
        { text: 'Conducted POS cash count reconciliation', status: 'completed' },
      ],
      issues: [
        { text: 'Walk-in chiller temperature high at 8°C', status: 'reported' },
      ],
      comments: [
        { text: 'Staff adhered to food hygiene protocols excellently' },
      ],
      transcription:
        'ቀን: 22-01-19\nብራንች: Bole Medhanialem Branch እና Piassa Arada Express\nስም: Almaz Ayana\nስራ የገባሁበት ሰዓት: 08:30\nከ 08:30 – 12:00 (Bole Medhanialem Branch ብራንች)\nከ 13:00 – 17:30 (Piassa Arada Express ብራንች)\n\nየተሰሩ ስራዎች:\n - Audited kitchen cleanliness\n - POS cash count\n\nመፍትሄ የሚፈልጉ ጉዳዮች:\n - Walk-in chiller temperature high\n\nአጠቃላይ አስተያየት:\n - Staff adhered to hygiene protocols\n\nከስራ የወጣሁበት ሰዓት: 17:30',
    };

    const createReportRes = await executeAgentTool('create_report', reportPayload, { userId: testUser._id });
    assert(createReportRes.success === true, 'create_report creates multi-branch report');
    createdReportId = createReportRes.data.reportId;
    assert(createReportRes.data.visitsCount === 2, 'create_report returns correct visitsCount (2)');

    const loadedReport = await Report.findById(createdReportId);
    createdIssueId = loadedReport.issues[0]._id.toString();

    // Tool 8: update_report
    const updateReportRes = await executeAgentTool(
      'update_report',
      {
        reportId: createdReportId,
        clockOut: '18:30',
        newActivities: [{ text: 'Conducted evening debrief with branch manager' }],
        newIssues: [{ text: 'POS thermal printer out of paper' }],
        newComments: [{ text: 'Additional debrief concluded smoothly' }],
      },
      { userId: testUser._id }
    );
    assert(updateReportRes.success === true, 'update_report amends report fields and appends items');
    assert(updateReportRes.data.clockOut === '18:30', 'update_report confirms clockOut: 18:30');
    assert(updateReportRes.data.activitiesCount === 3, 'update_report confirms activitiesCount: 3');
    assert(updateReportRes.data.issuesCount === 2, 'update_report confirms issuesCount: 2');

    // Update date and visits
    const updateDateVisitRes = await executeAgentTool(
      'update_report',
      {
        reportId: createdReportId,
        date: '2026-10-01T00:00:00.000Z',
        visits: [
          {
            branch: branchBole._id.toString(),
            clockIn: '09:00',
            clockOut: '12:30',
          },
        ],
      },
      { userId: testUser._id }
    );
    assert(updateDateVisitRes.success === true, 'update_report updates date and visits successfully');

    // Tool 9: update_branch_record_status
    const updateStatusRes = await executeAgentTool(
      'update_branch_record_status',
      {
        reportId: createdReportId,
        recordType: 'issue',
        recordId: createdIssueId,
        newStatus: 'completed',
        resolutionNotes: 'Compressor refrigerant recharged and calibrated to 3°C.',
      },
      { userId: testUser._id }
    );
    assert(updateStatusRes.success === true, 'update_branch_record_status updates subdocument status');
    assert(updateStatusRes.data.newStatus === 'completed', 'update_branch_record_status confirms completed status');

    // --------------------------------------------------------------------------
    // 3.4 Enterprise Intelligence & Cross-Branch Queries
    // --------------------------------------------------------------------------
    console.log('\n   Testing Category 3: Enterprise Intelligence & Cross-Branch Queries...');

    // Tool 13: query_historical_reports (Plural branchIds)
    const histPluralRes = await executeAgentTool(
      'query_historical_reports',
      {
        branchIds: [branchBole._id.toString(), branchPiassa._id.toString()],
        limit: 5,
      },
      { userId: testUser._id }
    );
    assert(histPluralRes.success === true, 'query_historical_reports executes with plural branchIds array');
    assert(histPluralRes.data.count >= 1, 'query_historical_reports retrieves matching report');
    assert(Array.isArray(histPluralRes.data.reports[0].openIssues), 'query_historical_reports populates openIssues array');
    assert(
      histPluralRes.data.reports[0].openIssues.every((i) => i.status !== 'completed' && i.status !== 'no_issue'),
      'openIssues strictly excludes completed and no_issue'
    );

    // Keyword search in historical reports
    const histKeywordRes = await executeAgentTool(
      'query_historical_reports',
      { keyword: 'chiller' },
      { userId: testUser._id }
    );
    assert(histKeywordRes.success === true, 'query_historical_reports supports keyword search');
    assert(histKeywordRes.data.count >= 1, 'query_historical_reports finds reports containing keyword "chiller"');

    // Tool 14: query_branch_records (Plural branchIds, recordType, status, keyword)
    const recordsRes = await executeAgentTool(
      'query_branch_records',
      {
        branchIds: [branchBole._id.toString()],
        recordType: 'issues',
        status: 'all',
        keyword: 'chiller',
      },
      { userId: testUser._id }
    );
    assert(recordsRes.success === true, 'query_branch_records executes across branch with filters');
    assert(recordsRes.data.count >= 1, 'query_branch_records finds matching chiller issue');
    assert(recordsRes.data.records[0].type === 'issue', 'query_branch_records returns structured issue record');

    // --------------------------------------------------------------------------
    // 3.5 External Channels, Exports & SSOT Directives
    // --------------------------------------------------------------------------
    console.log('\n   Testing Category 4: External Channels, Export & Directives SSOT...');

    // Tool 15: export_report (Markdown, Plain Text, CSV Spreadsheet, Google Drive Stub)
    const exportMdRes = await executeAgentTool(
      'export_report',
      { reportId: createdReportId, format: 'markdown' },
      { userId: testUser._id }
    );
    assert(exportMdRes.success === true, 'export_report produces Markdown format');
    assert(exportMdRes.data.exportContent.includes('## Activities Conducted'), 'export_report Markdown includes headers');

    const exportCsvRes = await executeAgentTool(
      'export_report',
      { reportId: createdReportId, format: 'csv' },
      { userId: testUser._id }
    );
    assert(exportCsvRes.success === true, 'export_report produces Tabular CSV format');
    assert(
      exportCsvRes.data.exportContent.includes('Date,EthiopianDate,Branch,RecordType,Description,Status'),
      'export_report CSV includes tabular header row'
    );

    // Cross-branch multi-report export without single reportId
    const exportCrossBranchCsv = await executeAgentTool(
      'export_report',
      {
        format: 'csv',
        branchIds: [branchBole._id.toString(), branchPiassa._id.toString()],
      },
      { userId: testUser._id }
    );
    assert(exportCrossBranchCsv.success === true, 'export_report supports cross-branch multi-report CSV export');
    assert(exportCrossBranchCsv.data.reportsCount >= 1, 'export_report finds matching reports across branches');
    assert(exportCrossBranchCsv.data.exportContent.includes('Audited kitchen cleanliness'), 'export_report cross-branch CSV includes report rows');

    // Functional Stub: Google Drive
    const exportDriveRes = await executeAgentTool(
      'export_report',
      { reportId: createdReportId, format: 'csv', destination: 'google_drive' },
      { userId: testUser._id }
    );
    assert(exportDriveRes.success === true, 'export_report Google Drive stub executes successfully');
    assert(exportDriveRes.data.isStub === true, 'export_report returns isStub: true for Google Drive');
    assert(exportDriveRes.data.fileName.includes('.csv'), 'export_report Google Drive stub generates appropriate fileName');

    // Tool 16: share_to_telegram (Telegram Broadcast Stub)
    const telegramRes = await executeAgentTool(
      'share_to_telegram',
      {
        reportId: createdReportId,
        targetChannel: 'management',
        customNote: 'Daily Operations Round Complete',
      },
      { userId: testUser._id }
    );
    assert(telegramRes.success === true, 'share_to_telegram stub executes successfully');
    assert(telegramRes.data.isStub === true, 'share_to_telegram returns isStub: true');
    assert(telegramRes.data.targetChannel === 'management', 'share_to_telegram targets management channel');
    assert(
      telegramRes.data.formattedPayload.includes('📋 *የስራ ሪፖርት (Operational Report)*'),
      'share_to_telegram formats high-fidelity Telegram Markdown payload'
    );
    assert(telegramRes.data.characterCount <= 4096, 'share_to_telegram enforces Telegram 4096-char bound');

    // Tool 17: save_supervisor_directive (SSOT: User.settings.directives)
    const directiveRes = await executeAgentTool(
      'save_supervisor_directive',
      {
        negativeVocabularyToAdd: ['አስቀያሚ'],
        phraseMappingsToAdd: { 'አስቀያሚ': 'ያልተሟላ' },
        customInstructionsToAdd: ['Verify cold room temperature sensors weekly'],
        singleBranchTemplate: 'ቀን: [DD-MM-YY]\nብራንች: [ብራንች ስም]\nብጁ ቴምፕሌት',
      },
      { userId: testUser._id }
    );
    assert(directiveRes.success === true, 'save_supervisor_directive updates User.settings.directives');
    assert(directiveRes.data.negativeVocabulary.includes('አስቀያሚ'), 'Negative vocabulary includes new word');
    assert(directiveRes.data.phraseMappings['አስቀያሚ'] === 'ያልተሟላ', 'Phrase mappings includes new entry');
    assert(
      directiveRes.data.reportTemplates.singleBranch.includes('ብጁ ቴምፕሌት'),
      'save_supervisor_directive updates custom reportTemplates'
    );

    const freshUser = await User.findById(testUser._id);
    assert(freshUser.settings.directives.negativeVocabulary.includes('አስቀያሚ'), 'DB confirms directive persisted to User SSOT');
    assert(
      freshUser.settings.reportTemplates.singleBranch.includes('ብጁ ቴምፕሌት'),
      'DB confirms singleBranchTemplate persisted to User.settings.reportTemplates'
    );

    // --------------------------------------------------------------------------
    // 3.6 Report Archival, Restoration & Permanent Deletion Lifecycle
    // --------------------------------------------------------------------------
    console.log('\n   Testing Report Archival, Restoration & Permanent Deletion...');

    // Tool 10: archive_report
    const archiveReportRes = await executeAgentTool(
      'archive_report',
      { reportId: createdReportId },
      { userId: testUser._id }
    );
    assert(archiveReportRes.success === true, 'archive_report soft-archives report');
    assert(archiveReportRes.data.isArchived === true, 'archive_report confirms isArchived: true');

    // Tool 11: restore_report
    const restoreReportRes = await executeAgentTool(
      'restore_report',
      { reportId: createdReportId },
      { userId: testUser._id }
    );
    assert(restoreReportRes.success === true, 'restore_report restores archived report');
    assert(restoreReportRes.data.isArchived === false, 'restore_report confirms isArchived: false');

    // Re-archive and Tool 12: delete_report_permanently
    await executeAgentTool('archive_report', { reportId: createdReportId }, { userId: testUser._id });
    const deleteReportRes = await executeAgentTool(
      'delete_report_permanently',
      { reportId: createdReportId },
      { userId: testUser._id }
    );
    assert(deleteReportRes.success === true, 'delete_report_permanently hard-deletes report');
    const checkedReport = await Report.findById(createdReportId);
    assert(checkedReport === null, 'Report is confirmed permanently deleted from MongoDB');
    createdReportId = null;

    // --------------------------------------------------------------------------
    // 3.7 Error Containment in executeAgentTool
    // --------------------------------------------------------------------------
    console.log('\n   Testing Tool Dispatcher Error Containment...');
    const unknownRes = await executeAgentTool('non_existent_tool', {}, { userId: testUser._id });
    assert(unknownRes.success === false, 'Unknown tool returns success: false');
    assert(unknownRes.error.includes('Unknown tool'), 'Unknown tool returns descriptive error message');

    const invalidBranchRes = await executeAgentTool('create_branch', { name: '' }, { userId: testUser._id });
    assert(invalidBranchRes.success === false, 'Invalid branch payload returns success: false without crashing');
  } finally {
    // Cleanup
    if (createdReportId) {
      await Report.findByIdAndDelete(createdReportId);
    }
    if (branchBole) {
      await Branch.findByIdAndDelete(branchBole._id);
    }
    if (branchPiassa) {
      await Branch.findByIdAndDelete(branchPiassa._id);
    }
    if (branchSarbet) {
      await Branch.findByIdAndDelete(branchSarbet._id);
    }
    if (testUser) {
      await User.findByIdAndDelete(testUser._id);
    }
    await disconnectDB();
  }

  console.log('\n================================================================');
  console.log(`TASK 7.5 + 7.5b RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTask75Verification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
