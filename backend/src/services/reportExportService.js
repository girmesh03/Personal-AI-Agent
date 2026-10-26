/**
 * @module services/reportExportService
 * @description Enterprise Domain Service for Operational Report Document Exports.
 * Decouples document synthesis, field schema extraction, and multi-format compilation
 * (PDF, Word DOCX, Excel XLSX, CSV, Plain Text with UTF-8 BOM) from HTTP controllers.
 * Leverages official packages (docx, pdfkit, xlsx) and seamlessly integrates with
 * local temporary storage for browser download and direct Google Drive cloud dispatch.
 */

import { generateDocumentFile } from './documentGenerationService.js';
import { toEthiopianDateString } from '../utils/ethiopianCalendar.js';
import { BadRequestError } from '../errors/CustomError.js';

/**
 * Builds the authoritative operational Markdown and narrative text dossier
 * encapsulating all 6 operational report sections.
 *
 * @function buildReportMarkdownDossier
 * @param {object} report - Populated report document.
 * @returns {string} Formatted Markdown dossier string.
 */
export function buildReportMarkdownDossier(report) {
  if (!report) return '';

  const dateStr = report.date ? new Date(report.date).toISOString().split('T')[0] : 'Report';
  const ethStr = report.ethiopianDate || toEthiopianDateString(report.date) || '';
  const authorName = report.user?.fullName || report.supervisor?.fullName || 'Area Supervisor';
  const shift = report.clockIn && report.clockOut ? `${report.clockIn} - ${report.clockOut}` : '—';

  let md = `# Corporate Field Inspection Dossier\n`;
  md += `**Date:** ${dateStr} ${ethStr ? `(${ethStr} ዓ.ም)` : ''}\n`;
  md += `**Supervisor:** ${authorName}\n`;
  md += `**Inspection Hours:** ${shift}\n\n`;

  // 1. Executive Narrative Dossier (Amharic Summary)
  if (report.content && typeof report.content === 'string' && report.content.trim()) {
    md += `## Executive Narrative Dossier\n${report.content.trim()}\n\n`;
  }

  // 2. Branch Visits Ledger
  md += `## Branch Visits Ledger\n`;
  if (Array.isArray(report.visits) && report.visits.length > 0) {
    report.visits.forEach((v) => {
      const b = v.branch || {};
      const managerInfo = b.managerName ? ` (Manager: ${b.managerName}${b.managerPhone ? ` - ${b.managerPhone}` : ''})` : '';
      md += `- **${b.name || 'Branch'} (${b.code || 'BR'})**: ${v.clockIn || '—'} to ${v.clockOut || '—'}${managerInfo}\n`;
    });
  } else {
    md += `*No branch visits recorded.*\n`;
  }

  // 3. Operational Activities Registry
  md += `\n## Operational Activities Registry\n`;
  if (Array.isArray(report.activities) && report.activities.length > 0) {
    report.activities.forEach((a) => {
      const mark = a.status === 'completed' ? 'x' : ' ';
      md += `- [${mark}] ${a.text} *[Status: ${a.status}]*\n`;
    });
  } else {
    md += `*No activities recorded.*\n`;
  }

  // 4. Issues & Corrective Actions Matrix
  md += `\n## Issues & Corrective Actions Matrix\n`;
  if (Array.isArray(report.issues) && report.issues.length > 0) {
    report.issues.forEach((i) => {
      const statusLabel = (i.status || 'REPORTED').toUpperCase();
      md += `- **[${statusLabel}]** ${i.text}\n`;
    });
  } else {
    md += `*No issues recorded.*\n`;
  }

  // 5. General Observations & Remarks
  md += `\n## General Observations & Advisory Remarks\n`;
  if (Array.isArray(report.comments) && report.comments.length > 0) {
    report.comments.forEach((c) => {
      md += `- ${c.text}\n`;
    });
  } else {
    md += `*No observations recorded.*\n`;
  }

  // 6. Audio STT Transcription
  if (report.transcription && report.transcription.trim()) {
    md += `\n## Audio Transcription Dossier\n${report.transcription.trim()}\n`;
  }

  return md;
}

/**
 * Builds normalized 2D table data for operational report spreadsheet export (CSV & XLSX).
 *
 * @function buildReportSpreadsheetData
 * @param {object} report - Populated report document.
 * @returns {Array<Array<string>>} 2D array of rows.
 */
export function buildReportSpreadsheetData(report) {
  const dateStr = report.date ? new Date(report.date).toISOString().split('T')[0] : '—';
  const ethStr = report.ethiopianDate || toEthiopianDateString(report.date) || '';
  const shift = report.clockIn && report.clockOut ? `${report.clockIn} - ${report.clockOut}` : '—';

  const rows = [
    ['Category', 'Item / Name', 'Timing / Status', 'Details / Manager'],
    ['Inspection Date', dateStr, shift, ethStr ? `${ethStr} ዓ.ም` : ''],
  ];

  if (Array.isArray(report.visits) && report.visits.length > 0) {
    rows.push(['Branch Visits', '', '', '']);
    report.visits.forEach((v) => {
      const b = v.branch || {};
      rows.push([
        'Visit',
        `${b.name || 'Branch'} (${b.code || 'BR'})`,
        `${v.clockIn || '—'} - ${v.clockOut || '—'}`,
        b.managerName ? `${b.managerName}${b.managerPhone ? ` (${b.managerPhone})` : ''}` : '—',
      ]);
    });
  }

  if (Array.isArray(report.activities) && report.activities.length > 0) {
    rows.push(['Activities Checklist', '', '', '']);
    report.activities.forEach((a) => {
      rows.push(['Activity', a.text, a.status, '']);
    });
  }

  if (Array.isArray(report.issues) && report.issues.length > 0) {
    rows.push(['Issues & Challenges', '', '', '']);
    report.issues.forEach((i) => {
      rows.push(['Issue', i.text, i.status, '']);
    });
  }

  if (Array.isArray(report.comments) && report.comments.length > 0) {
    rows.push(['General Observations', '', '', '']);
    report.comments.forEach((c) => {
      rows.push(['Observation', c.text, 'Noted', '']);
    });
  }

  return rows;
}

/**
 * Core export service function orchestrating report document compilation across
 * formats (text, csv, docx, pdf, xlsx) and delivery destinations (download, google_drive).
 *
 * @function exportReportDocument
 * @param {object} params
 * @param {object} params.report - Loaded and populated report document.
 * @param {object} params.user - Authenticated supervisor user object.
 * @param {string} [params.format='pdf'] - Export format ('text' | 'csv' | 'docx' | 'pdf' | 'spreadsheet' | 'xlsx').
 * @param {string} [params.destination='download'] - Delivery target ('download' | 'google_drive').
 * @returns {Promise<object>} Export metadata and delivery handles.
 */
export async function exportReportDocument({ report, user, format = 'pdf', destination = 'download' }) {
  if (!report) {
    throw new BadRequestError('Report document is required for export.');
  }

  const cleanFormat = (format || 'pdf').toLowerCase().trim();
  const normalizedFormat =
    cleanFormat === 'text' || cleanFormat === 'txt'
      ? 'markdown'
      : cleanFormat === 'spreadsheet'
      ? 'xlsx'
      : cleanFormat;

  const validFormats = ['markdown', 'csv', 'docx', 'pdf', 'xlsx'];
  if (!validFormats.includes(normalizedFormat)) {
    throw new BadRequestError(
      `Unsupported export format "${format}". Supported: text, csv, docx, pdf, spreadsheet.`
    );
  }

  const dateStr = report.date ? new Date(report.date).toISOString().split('T')[0] : 'Report';
  const title = `Operational_Report_${dateStr}`;
  const content = buildReportMarkdownDossier(report);
  const data = buildReportSpreadsheetData(report);

  return generateDocumentFile(user._id, {
    format: normalizedFormat,
    destination: destination === 'google_drive' ? 'google_drive' : 'download',
    title,
    content,
    data,
  });
}

export const reportExportService = {
  buildReportMarkdownDossier,
  buildReportSpreadsheetData,
  exportReportDocument,
};

export default reportExportService;
