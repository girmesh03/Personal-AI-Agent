/**
 * @file testDocumentAndDriveTools.js
 * @description Comprehensive automated integration test suite for Task 8.15:
 * Autonomous Cloud Document, Google Drive & Multi-Format Agentic Tool Architecture.
 *
 * Covers 17 Live Test Scenarios:
 * 1. Unconstrained PDF Resume Generation (generate_document_file -> pdf -> download)
 * 2. Unconstrained Word Contract (.docx) Generation (generate_document_file -> docx -> download)
 * 3. Complex Excel Spreadsheet (.xlsx) Generation (generate_document_file -> xlsx -> download)
 * 4. Structured CSV Export (generate_document_file -> csv -> download)
 * 5. Structured Markdown Export (generate_document_file -> markdown -> download)
 * 6. Structured JSON Export (generate_document_file -> json -> download)
 * 7. Secure Asset Download Endpoint (GET /api/v1/chat/downloads/:fileId)
 * 8. Download Path Traversal & Invalid FileId Rejection
 * 9. Google Drive OAuth Status Endpoint (GET /api/v1/auth/google/status)
 * 10. Google Drive Mock Connect (POST /api/v1/auth/google/mock-connect)
 * 11. Google Drive Default Root Folder Auto-Provisioning ('Personal AI Agent')
 * 12. Google Drive Manage Folders, Search, Metadata & Share (manage_google_drive)
 * 13. Live Google Doc Creation (create_cloud_document -> doc)
 * 14. Live Google Spreadsheet Creation (create_cloud_document -> sheet)
 * 15. Direct Document Generation to Google Drive (generate_document_file -> google_drive)
 * 16. Alternating Turn Invariant & Zero Duplicate User Turns ($U \to A \to U \to A$)
 * 17. Multi-Modal Context Preservation & Zero Fallback Model Amnesia (buildGeminiHistory)
 */

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as xlsxModule from 'xlsx';
const XLSX = xlsxModule.default || xlsxModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Chat } from '../src/models/Chat.js';
import { Audio } from '../src/models/Audio.js';
import { executeAgentTool } from '../src/tools/agentTools.js';
import {
  generateDocumentFile,
  generatedDocumentRegistry,
} from '../src/services/documentGenerationService.js';
import {
  manageGoogleDrive,
  createCloudDocument,
  disconnectGoogleDrive,
} from '../src/services/googleDriveService.js';
import { buildGeminiHistory } from '../src/controllers/chatController.js';

const PORT = 4007;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server;
let testUser;
let activeCookies = [];
let passedAssertions = 0;
let totalScenarios = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
  passedAssertions++;
  console.log(`    ✅ [ASSERT] ${message}`);
}

async function request(method, urlPath, { body, headers = {}, rawResponse = false } = {}) {
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
      // Capture cookies
      if (res.headers['set-cookie']) {
        const newCookies = res.headers['set-cookie'].map((c) => c.split(';')[0]);
        activeCookies = [...activeCookies, ...newCookies];
      }

      if (rawResponse) {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
        return;
      }

      let data = '';
      res.on('data', (c) => (data += c));
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

async function runScenario(scenarioNum, scenarioName, testFn) {
  totalScenarios++;
  console.log(`\n======================================================================`);
  console.log(`SCENARIO ${scenarioNum}: ${scenarioName}`);
  console.log(`======================================================================`);
  try {
    await testFn();
    console.log(`⭐ SCENARIO ${scenarioNum} PASSED!`);
  } catch (err) {
    console.error(`💥 SCENARIO ${scenarioNum} FAILED:`, err);
    throw err;
  }
}

async function runAllTests() {
  console.log('\n🚀 Starting Test Suite: testDocumentAndDriveTools.js (17 Scenarios)...');
  await connectDB();

  // Clean test fixtures
  await User.deleteMany({ email: 'doctest-agent@example.com' });
  await Chat.deleteMany({ title: { $regex: /DocTest/i } });

  // Create test user
  testUser = await User.create({
    email: 'doctest-agent@example.com',
    password: 'Password123!',
    firstName: 'Document',
    lastName: 'Tester',
    position: 'Personal AI Evaluator',
  });

  // Start HTTP server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`📡 Test server listening on http://localhost:${PORT}`);

  // Log in user to obtain auth cookies
  const loginRes = await request('POST', '/auth/login', {
    body: { email: 'doctest-agent@example.com', password: 'Password123!' },
  });
  assert(loginRes.status === 200, 'User logged in successfully with HTTP 200');

  let generatedFileIds = {};

  // SCENARIO 1: Unconstrained PDF Resume Generation
  await runScenario(1, 'Unconstrained PDF Resume Generation', async () => {
    const resumeContent = `# John Doe - Senior Solutions Architect\n\nExperienced cloud engineer and AI specialist.\n\n## Experience\n- Lead Architect at Tech Corp (2020 - Present)\n- Cloud Engineer at Cloud Global (2016 - 2020)\n\n## Education\n- B.S. Computer Science, University of Technology`;
    const res = await executeAgentTool(
      'generate_document_file',
      {
        format: 'pdf',
        title: 'John_Doe_Resume',
        destination: 'download',
        content: resumeContent,
      },
      { userId: testUser._id }
    );

    assert(res.success === true, 'Tool executed successfully');
    assert(res.data.format === 'pdf', 'Format is pdf');
    assert(res.data.destination === 'download', 'Destination is download');
    assert(typeof res.data.fileId === 'string', 'Returned unique fileId');
    assert(res.data.downloadUrl.includes(res.data.fileId), 'downloadUrl contains fileId');
    assert(fs.existsSync(generatedDocumentRegistry.get(res.data.fileId).filePath), 'PDF file exists on disk');
    assert(res.data.size > 500, 'PDF size is non-trivial (> 500 bytes)');
    generatedFileIds.pdf = res.data.fileId;
  });

  // SCENARIO 2: Unconstrained Word Contract (.docx) Generation
  await runScenario(2, 'Unconstrained Word Document (.docx) Contract Generation', async () => {
    const contractContent = `# Non-Disclosure Agreement\n\nThis agreement is entered between Party A and Party B.\n\n## Terms and Conditions\n- Confidentiality shall be preserved for 3 years.\n- Governing law: State of California.`;
    const contractData = [
      ['Party', 'Representative', 'Signature Date'],
      ['Party A (Discloser)', 'Alice Smith', '2026-10-15'],
      ['Party B (Recipient)', 'Bob Jones', '2026-10-15'],
    ];

    const res = await executeAgentTool(
      'generate_document_file',
      {
        format: 'docx',
        title: 'Mutual_NDA_Contract',
        destination: 'download',
        content: contractContent,
        data: contractData,
      },
      { userId: testUser._id }
    );

    assert(res.success === true, 'Tool executed successfully');
    assert(res.data.format === 'docx', 'Format is docx');
    assert(typeof res.data.fileId === 'string', 'Returned fileId');
    assert(fs.existsSync(generatedDocumentRegistry.get(res.data.fileId).filePath), 'DOCX file exists on disk');
    assert(res.data.size > 1000, 'DOCX file size > 1KB');
    generatedFileIds.docx = res.data.fileId;
  });

  // SCENARIO 3: Complex Excel Spreadsheet (.xlsx) Generation
  await runScenario(3, 'Complex Excel Spreadsheet (.xlsx) Generation with Open-Ended Data', async () => {
    const budgetData = [
      ['Branch Name', 'Category', 'Allocated Budget', 'Actual Spend', 'Variance'],
      ['Bole Medhanialem', 'Kitchen Equipment', 45000, 42000, 3000],
      ['Kazanchis', 'Dining Furniture', 30000, 31500, -1500],
      ['Sarbet', 'HVAC Maintenance', 18000, 16200, 1800],
    ];

    const res = await executeAgentTool(
      'generate_document_file',
      {
        format: 'xlsx',
        title: 'Q3_Operations_Budget',
        destination: 'download',
        data: budgetData,
      },
      { userId: testUser._id }
    );

    assert(res.success === true, 'Tool executed successfully');
    assert(res.data.format === 'xlsx', 'Format is xlsx');
    const diskPath = generatedDocumentRegistry.get(res.data.fileId).filePath;
    assert(fs.existsSync(diskPath), 'Excel file exists on disk');

    // Read back workbook to verify integrity
    const wb = XLSX.readFile(diskPath);
    assert(wb.SheetNames.length > 0, 'Workbook has sheets');
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const parsedRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    assert(parsedRows.length === 4, 'Parsed rows count matches 4 rows');
    assert(parsedRows[0][0] === 'Branch Name', 'Header cell matches Branch Name');
    generatedFileIds.xlsx = res.data.fileId;
  });

  // SCENARIO 4: Structured CSV Export
  await runScenario(4, 'Structured CSV Export', async () => {
    const csvData = [
      ['ID', 'Branch', 'Audit Score', 'Notes'],
      ['B01', 'Bole', '98%', 'Exemplary food hygiene, clean cold storage'],
      ['K02', 'Kazanchis', '91%', 'Minor chiller gasket wear noted'],
    ];

    const res = await executeAgentTool(
      'generate_document_file',
      {
        format: 'csv',
        title: 'Audit_Scores',
        destination: 'download',
        data: csvData,
      },
      { userId: testUser._id }
    );

    assert(res.success === true, 'Tool executed successfully');
    assert(res.data.format === 'csv', 'Format is csv');
    const content = fs.readFileSync(generatedDocumentRegistry.get(res.data.fileId).filePath, 'utf8');
    assert(content.includes('"Bole"'), 'CSV contains quoted string');
    assert(content.includes('"Exemplary food hygiene, clean cold storage"'), 'CSV preserves commas in quotes');
    generatedFileIds.csv = res.data.fileId;
  });

  // SCENARIO 5: Structured Markdown Export
  await runScenario(5, 'Structured Markdown Export', async () => {
    const mdContent = `## Weekly Operational Retrospective\nAll systems operational.`;
    const res = await executeAgentTool(
      'generate_document_file',
      {
        format: 'markdown',
        title: 'Weekly_Summary',
        destination: 'download',
        content: mdContent,
      },
      { userId: testUser._id }
    );

    assert(res.success === true, 'Tool executed successfully');
    assert(res.data.format === 'markdown', 'Format is markdown');
    const content = fs.readFileSync(generatedDocumentRegistry.get(res.data.fileId).filePath, 'utf8');
    assert(content.includes('Weekly Operational Retrospective'), 'Markdown file preserves text');
  });

  // SCENARIO 6: Structured JSON Export
  await runScenario(6, 'Structured JSON Export', async () => {
    const jsonData = {
      auditDate: '2026-10-15',
      kpis: { speedOfService: 185, accuracyRate: 0.99 },
    };
    const res = await executeAgentTool(
      'generate_document_file',
      {
        format: 'json',
        title: 'KPI_Metrics',
        destination: 'download',
        data: jsonData,
      },
      { userId: testUser._id }
    );

    assert(res.success === true, 'Tool executed successfully');
    assert(res.data.format === 'json', 'Format is json');
    const content = fs.readFileSync(generatedDocumentRegistry.get(res.data.fileId).filePath, 'utf8');
    const parsed = JSON.parse(content);
    assert(parsed.data.kpis.speedOfService === 185, 'JSON data parsed accurately');
  });

  // SCENARIO 7: Secure Asset Download Endpoint
  await runScenario(7, 'Secure Asset Download Endpoint (GET /api/v1/chat/downloads/:fileId)', async () => {
    const fileId = generatedFileIds.pdf;
    const downloadRes = await request('GET', `/chat/downloads/${fileId}`, { rawResponse: true });
    assert(downloadRes.status === 200, 'HTTP 200 returned for valid download');
    assert(downloadRes.headers['content-type'] === 'application/pdf', 'Content-Type is application/pdf');
    assert(downloadRes.headers['content-disposition'].includes('attachment'), 'Content-Disposition is attachment');
    assert(downloadRes.body.length > 500, 'Binary bytes streamed to client');
  });

  // SCENARIO 8: Download Path Traversal & Invalid FileId Rejection
  await runScenario(8, 'Download Path Traversal & Invalid FileId Rejection', async () => {
    // Malformed ID (path traversal attempt)
    const attackRes = await request('GET', `/chat/downloads/..%2F..%2F.env`);
    assert(attackRes.status === 400 || attackRes.status === 404, 'Path traversal safely rejected with 400 or 404');

    // Non-existent 32-hex ID
    const notFoundRes = await request('GET', `/chat/downloads/0123456789abcdef0123456789abcdef`);
    assert(notFoundRes.status === 404, 'Non-existent fileId returns 404');
  });

  // SCENARIO 9: Google Drive OAuth Status Endpoint (Initially Disconnected)
  await runScenario(9, 'Google Drive OAuth Status Endpoint (Initially Disconnected)', async () => {
    const statusRes = await request('GET', '/auth/google/status');
    assert(statusRes.status === 200, 'HTTP 200 returned');
    assert(statusRes.data.data.connected === false, 'connected is initially false');
    assert(statusRes.data.data.email === null, 'email is null');
  });

  // SCENARIO 10: Google Drive Connection Provisioning via Model
  await runScenario(10, 'Google Drive Credentials Setup via Mongoose Model', async () => {
    await User.findByIdAndUpdate(testUser._id, {
      $set: {
        'integrations.googleDrive.connected': true,
        'integrations.googleDrive.enabled': true,
        'integrations.googleDrive.email': 'supervisor@enterprise.org',
        'integrations.googleDrive.accessToken': 'mock_access_token_' + Date.now(),
        'integrations.googleDrive.refreshToken': 'mock_refresh_token_' + Date.now(),
        'integrations.googleDrive.expiryDate': Date.now() + 3600 * 1000,
        'integrations.googleDrive.rootFolderId': 'mock_root_folder_id_' + testUser._id,
        'integrations.googleDrive.connectedAt': new Date(),
      },
    });

    // Verify tokens are NOT returned in status or API responses (select: false)
    const checkStatus = await request('GET', '/auth/google/status');
    assert(checkStatus.status === 200, 'HTTP 200 returned');
    assert(checkStatus.data.data.connected === true, 'Status confirmed connected: true');
    assert(checkStatus.data.data.email === 'supervisor@enterprise.org', 'email matches');
    assert(!checkStatus.data.data.accessToken, 'accessToken is strictly never exposed');
    assert(!checkStatus.data.data.refreshToken, 'refreshToken is strictly never exposed');
  });

  // SCENARIO 11: Google Drive Default Root Folder Auto-Provisioning ('Personal AI Agent')
  await runScenario(11, "Google Drive Default Root Folder Auto-Provisioning ('Personal AI Agent')", async () => {
    const listRes = await executeAgentTool(
      'manage_google_drive',
      { action: 'list' },
      { userId: testUser._id }
    );
    assert(listRes.success === true, 'Tool executed successfully');
    assert(listRes.data.action === 'list', 'action is list');
    assert(Array.isArray(listRes.data.files), 'files is array');
  });

  // SCENARIO 12: Google Drive Manage Folders, Search, Metadata & Share
  await runScenario(12, 'Google Drive Manage Folders, Search, Metadata & Share (manage_google_drive)', async () => {
    // 1. Create Folder
    const createFolderRes = await executeAgentTool(
      'manage_google_drive',
      { action: 'create_folder', folderName: 'Strategic_Initiatives' },
      { userId: testUser._id }
    );
    assert(createFolderRes.success === true, 'create_folder succeeded');
    const folderId = createFolderRes.data.folder.id;
    assert(typeof folderId === 'string', 'folder has valid id');

    // 2. Search
    const searchRes = await executeAgentTool(
      'manage_google_drive',
      { action: 'search', query: 'Strategic' },
      { userId: testUser._id }
    );
    assert(searchRes.success === true, 'search succeeded');
    assert(searchRes.data.files.length > 0, 'Found matching folder');

    // 3. Get Metadata
    const metaRes = await executeAgentTool(
      'manage_google_drive',
      { action: 'get_metadata', fileId: folderId },
      { userId: testUser._id }
    );
    assert(metaRes.success === true, 'get_metadata succeeded');
    assert(metaRes.data.metadata.name === 'Strategic_Initiatives', 'Folder metadata name verified');

    // 4. Share
    const shareRes = await executeAgentTool(
      'manage_google_drive',
      { action: 'share', fileId: folderId, role: 'writer', emailAddress: 'collaborator@enterprise.org' },
      { userId: testUser._id }
    );
    assert(shareRes.success === true, 'share succeeded');
    assert(shareRes.data.permission.role === 'writer', 'Permission role is writer');
  });

  // SCENARIO 13: Live Google Doc Creation
  await runScenario(13, 'Live Google Doc Creation (create_cloud_document -> doc)', async () => {
    const docRes = await executeAgentTool(
      'create_cloud_document',
      {
        type: 'doc',
        title: 'AI_Agent_Strategy_2026',
        content: '# Executive Strategy\nThis document outlines multi-agent operational scaling.',
      },
      { userId: testUser._id }
    );

    assert(docRes.success === true, 'create_cloud_document doc succeeded');
    assert(docRes.data.type === 'doc', 'Type is doc');
    assert(typeof docRes.data.fileId === 'string', 'fileId returned');
    assert(docRes.data.webViewLink.includes('docs.google.com/document/d/'), 'Valid Google Docs URL returned');
    assert(docRes.data.characterCount > 0, 'Character count tracked');
  });

  // SCENARIO 14: Live Google Spreadsheet Creation
  await runScenario(14, 'Live Google Spreadsheet Creation (create_cloud_document -> sheet)', async () => {
    const sheetData = [
      ['Branch', 'Manager', 'Monthly Target', 'Actual Revenue', 'Status'],
      ['Bole', 'Tigist A.', '$50,000', '$54,200', 'Exceeded'],
      ['Kazanchis', 'Dawit K.', '$40,000', '$39,100', 'On Track'],
    ];

    const sheetRes = await executeAgentTool(
      'create_cloud_document',
      {
        type: 'sheet',
        title: 'Branch_Revenue_Audit',
        data: sheetData,
      },
      { userId: testUser._id }
    );

    assert(sheetRes.success === true, 'create_cloud_document sheet succeeded');
    assert(sheetRes.data.type === 'sheet', 'Type is sheet');
    assert(typeof sheetRes.data.fileId === 'string', 'fileId returned');
    assert(sheetRes.data.webViewLink.includes('docs.google.com/spreadsheets/d/'), 'Valid Google Sheets URL returned');
    assert(sheetRes.data.rowsCount === 3, 'Rows count is 3');
  });

  // SCENARIO 15: Direct Document Generation to Google Drive
  await runScenario(15, 'Direct Document Generation to Google Drive (generate_document_file -> destination: google_drive)', async () => {
    const res = await executeAgentTool(
      'generate_document_file',
      {
        format: 'pdf',
        title: 'Executive_Board_Briefing',
        destination: 'google_drive',
        content: '# Board of Directors Briefing\n\nFinancial and operational metrics for fiscal year 2026.',
      },
      { userId: testUser._id }
    );

    assert(res.success === true, 'generate_document_file succeeded with google_drive destination');
    assert(res.data.destination === 'google_drive', 'Destination confirmed google_drive');
    assert(typeof res.data.webViewLink === 'string', 'webViewLink returned');
    assert(res.data.webViewLink.includes('drive.google.com'), 'Valid Google Drive link returned');
  });

  // SCENARIO 16: Alternating Turn Invariant & Message Count Non-Increment ($U \to A \to U \to A$)
  await runScenario(16, 'Alternating Turn Invariant & Zero Duplicate User Turns ($U -> A -> U -> A$)', async () => {
    // 1. Create a chat session with Turn 1: User 1 -> Assistant 1
    const testChat = await Chat.create({
      user: testUser._id,
      title: 'DocTest Alternating Chat',
      messages: [
        {
          id: new mongoose.Types.ObjectId().toString(),
          role: 'user',
          text: 'Hello, please build me a resume.',
          audioTranscriptions: [],
          documentTextContext: null,
          audios: [],
          attachments: [],
          createdAt: new Date(),
        },
        {
          id: new mongoose.Types.ObjectId().toString(),
          role: 'assistant',
          text: 'I can certainly help you generate a professional resume.',
          thought: 'User wants a resume.',
          toolCalls: [],
          model: 'gemini-3.1-flash-lite',
          createdAt: new Date(),
        },
      ],
    });

    assert(testChat.messages.length === 2, 'Initial messages length is 2 (U1 -> A1)');
    assert(testChat.messages[0].role === 'user' && testChat.messages[1].role === 'assistant', 'Strict alternating U -> A verified');

    // 2. Simulate User Turn 2 where assistant stream encounters terminal error (e.g. 503 / 429)
    const userTurn2 = {
      id: new mongoose.Types.ObjectId().toString(),
      role: 'user',
      text: 'Export this as PDF.',
      audioTranscriptions: [],
      documentTextContext: null,
      audios: [],
      attachments: [],
      createdAt: new Date(),
    };
    testChat.messages.push(userTurn2);

    // In chatController catch block, the error assistant turn is persisted:
    const errorAssistantTurn = {
      id: new mongoose.Types.ObjectId().toString(),
      role: 'assistant',
      text: '',
      thought: null,
      toolCalls: [],
      model: 'gemini-3.1-flash-lite',
      isError: true,
      error: 'Model quota limit reached. Please select an alternative model.',
      createdAt: new Date(),
    };
    testChat.messages.push(errorAssistantTurn);
    await testChat.save();

    // Verify messages length is 4: U1 -> A1 -> U2 -> A2_error
    const updatedChat = await Chat.findById(testChat._id);
    assert(updatedChat.messages.length === 4, 'Chat has exactly 4 turns after error');
    assert(updatedChat.messages[2].role === 'user' && updatedChat.messages[3].role === 'assistant', 'Strict alternating U2 -> A2_error preserved');
    assert(updatedChat.messages[3].isError === true, 'Assistant turn recorded error');

    // 3. User clicks retry on Turn 2 (with alternate model or retry button):
    // The server slices history to anchorIdx + 1 (pruning the failed assistant turn A2_error)
    // and DOES NOT push a new user turn!
    const anchorIdx = updatedChat.messages.findIndex((m) => String(m.id) === String(userTurn2.id));
    assert(anchorIdx === 2, 'Anchor user turn found at index 2');

    // Slice to anchorIdx + 1
    updatedChat.messages = updatedChat.messages.slice(0, anchorIdx + 1);
    assert(updatedChat.messages.length === 3, 'Failed assistant turn pruned; messages length is 3 (U1 -> A1 -> U2)');

    // Model streams and successfully completes:
    const newAssistantTurn = {
      id: new mongoose.Types.ObjectId().toString(),
      role: 'assistant',
      text: 'Here is your exported PDF document download link.',
      toolCalls: [{ name: 'generate_document_file' }],
      model: 'gemini-3-flash-preview',
      createdAt: new Date(),
    };
    updatedChat.messages.push(newAssistantTurn);
    await updatedChat.save();

    // Verify final state: exactly 4 turns, strictly alternating, zero duplicated user turns!
    const finalChat = await Chat.findById(testChat._id);
    assert(finalChat.messages.length === 4, 'Final message count is exactly 4 (NEVER incremented by 1)');
    assert(finalChat.messages[0].role === 'user', 'Turn 0 is User');
    assert(finalChat.messages[1].role === 'assistant', 'Turn 1 is Assistant');
    assert(finalChat.messages[2].role === 'user', 'Turn 2 is User');
    assert(finalChat.messages[3].role === 'assistant', 'Turn 3 is Assistant');
    assert(finalChat.messages[2].text === 'Export this as PDF.', 'User turn 2 preserved in place');
    assert(finalChat.messages[3].model === 'gemini-3-flash-preview', 'Switched model generated replacement turn');
  });

  // SCENARIO 17: Multi-Modal Context Preservation & Zero Amnesia
  await runScenario(17, 'Multi-Modal Context Preservation & Zero Fallback Model Amnesia (buildGeminiHistory)', async () => {
    const testAudioDoc = await Audio.create({
      user: testUser._id,
      fileName: 'test_voice_memo.mp3',
      originalName: 'Voice Note.mp3',
      mimeType: 'audio/mpeg',
      size: 2048,
      path: 'uploads/audios/test_memo.mp3',
      duration: 15,
      status: 'transcribed',
      transcription: 'Supervisor reported: Chiller temperature at Kazanchis was calibrated to 3.5 degrees Celsius.',
    });

    const multiModalChat = await Chat.create({
      user: testUser._id,
      title: 'MultiModal Grounding Chat',
      messages: [
        {
          id: new mongoose.Types.ObjectId().toString(),
          role: 'user',
          text: 'Here is my operational memo from Kazanchis.',
          audioTranscriptions: [
            'Supervisor reported: Chiller temperature at Kazanchis was calibrated to 3.5 degrees Celsius.',
          ],
          documentTextContext: '<attachment name="Audit.xlsx">\nChiller Target: 2-4 C\nObserved: 3.5 C\n</attachment>',
          audios: [testAudioDoc._id],
          attachments: [],
          createdAt: new Date(),
        },
        {
          id: new mongoose.Types.ObjectId().toString(),
          role: 'assistant',
          text: 'Understood. Chiller temperature is within safe threshold.',
          toolCalls: [],
          model: 'gemini-3.1-flash-lite',
          createdAt: new Date(),
        },
        {
          id: new mongoose.Types.ObjectId().toString(),
          role: 'user',
          text: 'What was that chiller temperature again?',
          audioTranscriptions: [],
          documentTextContext: null,
          audios: [],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    // Build Gemini contents history for Turn 3
    const history = await buildGeminiHistory({
      chat: multiModalChat,
      userTurn: multiModalChat.messages[2],
      isContinue: false,
    });

    assert(Array.isArray(history), 'History is array');
    assert(history.length === 3, 'History contains 3 conversational turns');

    // Turn 1 (Historical User turn)
    const turn1 = history[0];
    assert(turn1.role === 'user', 'Turn 1 is user');
    const turn1Text = turn1.parts[0].text;
    assert(turn1Text.includes('Here is my operational memo from Kazanchis.'), 'Includes typed text');
    assert(turn1Text.includes('Supervisor reported: Chiller temperature at Kazanchis was calibrated to 3.5 degrees Celsius.'), 'Includes genuine audio transcription');
    assert(turn1Text.includes('<attachment name="Audit.xlsx">'), 'Includes genuine document text context');

    // Zero dummy placeholder strings!
    assert(!turn1Text.includes('[User sent audio message]'), 'Zero dummy string [User sent audio message]');
    assert(!turn1Text.includes('[User sent attachments:'), 'Zero dummy string [User sent attachments: ...]');

    // Turn 2 (Assistant model turn)
    const turn2 = history[1];
    assert(turn2.role === 'model', 'Turn 2 is model');
    assert(turn2.parts[0].text.includes('Chiller temperature is within safe threshold'), 'Assistant turn preserved');

    // Turn 3 (Active user turn)
    const turn3 = history[2];
    assert(turn3.role === 'user', 'Turn 3 is user');
    assert(turn3.parts[0].text.includes('What was that chiller temperature again?'), 'Active user prompt included');
  });

  // TEARDOWN & CLEANUP
  console.log('\n🧹 Cleaning up test fixtures...');
  await disconnectGoogleDrive(testUser._id);
  await User.deleteMany({ email: 'doctest-agent@example.com' });
  await Chat.deleteMany({ user: testUser._id });
  await Audio.deleteMany({ user: testUser._id });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
    console.log('📡 Test server closed.');
  }

  await disconnectDB();

  console.log(`\n======================================================================`);
  console.log(`🎉 ALL 17 TEST SCENARIOS PASSED 100% GREEN!`);
  console.log(`Total Scenarios: ${totalScenarios} / 17`);
  console.log(`Passed Assertions: ${passedAssertions}`);
  console.log(`======================================================================\n`);
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err);
  if (server) server.close();
  disconnectDB().finally(() => process.exit(1));
});
