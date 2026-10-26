/**
 * @file testReportExport.js
 * @description Contract test verifying the backend report export endpoint:
 * POST /api/v1/reports/:reportId/export across text, csv, docx, pdf, xlsx.
 */

import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Branch } from '../src/models/Branch.js';
import { Report } from '../src/models/Report.js';

let BASE_URL = '';
let server;
let activeCookies = [];

function request(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const method = options.method || 'GET';
    const bodyStr = options.body ? JSON.stringify(options.body) : null;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      ...(activeCookies.length > 0 ? { Cookie: activeCookies.join('; ') } : {}),
      ...(options.headers || {}),
    };

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        const setCookieHeaders = res.headers['set-cookie'];
        if (setCookieHeaders) {
          activeCookies = setCookieHeaders.map((c) => c.split(';')[0]);
        }
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function run() {
  console.log('🚀 Starting Report Export Verification Suite...');
  await connectDB();

  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      BASE_URL = `http://127.0.0.1:${port}`;
      console.log(`📡 Test server listening on ${BASE_URL}`);
      resolve();
    });
    server.on('error', reject);
  });

  try {
    const testEmail = `export_test_${Date.now()}@example.com`;
    const regRes = await request('/api/v1/auth/register', {
      method: 'POST',
      body: { email: testEmail, password: 'StrongPassword123!' },
    });
    console.log(`✅ Register status: ${regRes.status}`);

    const loginRes = await request('/api/v1/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'StrongPassword123!' },
    });
    console.log(`✅ Login status: ${loginRes.status}`);

    const user = await User.findOne({ email: testEmail });
    const branch = await Branch.create({
      user: user._id,
      name: `Export Branch ${Date.now()}`,
      code: 'EX-01',
      managerName: 'Dawit Abebe',
    });

    const report = await Report.create({
      user: user._id,
      branch: branch._id,
      date: new Date('2026-10-24T00:00:00.000Z'),
      clockIn: '08:30',
      clockOut: '17:30',
      transcription: 'Sanitation audit and compliance review completed successfully across all stations.',
      visits: [
        {
          branch: branch._id,
          clockIn: '09:00',
          clockOut: '12:00',
        },
      ],
      activities: [{ text: 'Sanitation inspection and audit', status: 'completed' }],
      issues: [{ text: 'Cooler temperature sensor calibration', status: 'reported' }],
      comments: [{ text: 'Staff compliance is satisfactory.' }],
    });
    console.log(`✅ Test report created with ID: ${report._id}`);

    // Test 1: Export as Text
    const textRes = await request(`/api/v1/reports/${report._id}/export`, {
      method: 'POST',
      body: { format: 'text', destination: 'download' },
    });
    if (textRes.status !== 200 || !textRes.body?.data?.downloadUrl) {
      throw new Error(`Text export failed: ${JSON.stringify(textRes.body)}`);
    }
    console.log(`✅ Text export verified: ${textRes.body.data.downloadUrl}`);

    // Test 2: Export as PDF
    const pdfRes = await request(`/api/v1/reports/${report._id}/export`, {
      method: 'POST',
      body: { format: 'pdf', destination: 'download' },
    });
    if (pdfRes.status !== 200 || !pdfRes.body?.data?.downloadUrl) {
      throw new Error(`PDF export failed: ${JSON.stringify(pdfRes.body)}`);
    }
    console.log(`✅ PDF export verified: ${pdfRes.body.data.downloadUrl}`);

    // Test 3: Export as DOCX
    const docxRes = await request(`/api/v1/reports/${report._id}/export`, {
      method: 'POST',
      body: { format: 'docx', destination: 'download' },
    });
    if (docxRes.status !== 200 || !docxRes.body?.data?.downloadUrl) {
      throw new Error(`DOCX export failed: ${JSON.stringify(docxRes.body)}`);
    }
    console.log(`✅ DOCX export verified: ${docxRes.body.data.downloadUrl}`);

    // Test 4: Export as CSV
    const csvRes = await request(`/api/v1/reports/${report._id}/export`, {
      method: 'POST',
      body: { format: 'csv', destination: 'download' },
    });
    if (csvRes.status !== 200 || !csvRes.body?.data?.downloadUrl) {
      throw new Error(`CSV export failed: ${JSON.stringify(csvRes.body)}`);
    }
    console.log(`✅ CSV export verified: ${csvRes.body.data.downloadUrl}`);

    // Test 5: Export as Spreadsheet
    const xlsxRes = await request(`/api/v1/reports/${report._id}/export`, {
      method: 'POST',
      body: { format: 'spreadsheet', destination: 'download' },
    });
    if (xlsxRes.status !== 200 || !xlsxRes.body?.data?.downloadUrl) {
      throw new Error(`Spreadsheet export failed: ${JSON.stringify(xlsxRes.body)}`);
    }
    console.log(`✅ Spreadsheet export verified: ${xlsxRes.body.data.downloadUrl}`);

    // Test 6: Verify file retrieval via downloadUrl
    const downloadRes = await request(textRes.body.data.downloadUrl);
    if (downloadRes.status !== 200) {
      throw new Error(`Download retrieval failed with status: ${downloadRes.status}`);
    }
    console.log(`✅ File download retrieval verified (Status 200)`);

    // Clean up test documents
    await Report.deleteOne({ _id: report._id });
    await Branch.deleteOne({ _id: branch._id });
    await User.deleteOne({ _id: user._id });

    console.log('🎉 ALL REPORT EXPORT TESTS PASSED 100% GREEN!');
  } finally {
    if (server) server.close();
    await disconnectDB();
  }
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
