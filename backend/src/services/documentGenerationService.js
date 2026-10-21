/**
 * @module services/documentGenerationService
 * @description Enterprise Multi-Format Document Generation Engine.
 * Generates vector PDF, Microsoft Word (.docx), Microsoft Excel (.xlsx),
 * RFC 4180 CSV, Markdown, and JSON files from open-ended agent content and structured data.
 * Supports direct Google Drive dispatch and secure local temporary storage for browser download.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import * as docx from 'docx';
import * as xlsxModule from 'xlsx';
const XLSX = xlsxModule.default || xlsxModule;
import { uploadFileToDrive, normalizeSpreadsheetData } from './googleDriveService.js';
import { BadRequestError } from '../errors/CustomError.js';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage directory for generated documents ready for client download
const GENERATED_DOCS_DIR = path.resolve(__dirname, '../../uploads/generated_documents');

/**
 * Ensures storage directory exists.
 */
function ensureStorageDirectory() {
  if (!fs.existsSync(GENERATED_DOCS_DIR)) {
    fs.mkdirSync(GENERATED_DOCS_DIR, { recursive: true });
  }
}

/**
 * Sanitizes title to be safe for filenames across OSes.
 *
 * @param {string} title
 * @returns {string}
 */
function sanitizeFileName(title) {
  return (title || 'document')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

/**
 * Registry of generated document metadata in memory for quick validation during download.
 * Maps fileId -> { fileId, fileName, filePath, mimeType, size, createdAt, userId }
 */
export const generatedDocumentRegistry = new Map();

/**
 * Generates an unconstrained multi-format document file.
 *
 * @param {string} userId - Authenticated supervisor ObjectId.
 * @param {object} args - Tool arguments { format, title, destination, folderId, content, data }.
 * @returns {Promise<object>} Tool execution result.
 */
export async function generateDocumentFile(userId, args = {}) {
  const {
    format = 'pdf',
    title = 'Document',
    destination = 'download',
    folderId,
    content = '',
    data = null,
  } = args;

  ensureStorageDirectory();

  const cleanFormat = (format || 'pdf').toLowerCase().trim();
  const validFormats = ['pdf', 'docx', 'xlsx', 'csv', 'markdown', 'md', 'json'];
  if (!validFormats.includes(cleanFormat)) {
    throw new BadRequestError(
      `Unsupported document format "${format}". Supported formats: pdf, docx, xlsx, csv, markdown, json.`
    );
  }

  const fileId = crypto.randomBytes(16).toString('hex');
  const safeBaseName = sanitizeFileName(title);
  let ext = cleanFormat === 'markdown' ? 'md' : cleanFormat;
  const fileName = `${safeBaseName}_${Date.now()}.${ext}`;
  const filePath = path.join(GENERATED_DOCS_DIR, `${fileId}_${fileName}`);

  let mimeType = 'application/octet-stream';

  switch (cleanFormat) {
    case 'pdf': {
      mimeType = 'application/pdf';
      await generatePdfDocument(filePath, { title, content, data });
      break;
    }

    case 'docx': {
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      await generateWordDocument(filePath, { title, content, data });
      break;
    }

    case 'xlsx': {
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      await generateExcelDocument(filePath, { title, content, data });
      break;
    }

    case 'csv': {
      mimeType = 'text/csv';
      await generateCsvDocument(filePath, { title, content, data });
      break;
    }

    case 'markdown':
    case 'md': {
      mimeType = 'text/markdown';
      await generateMarkdownDocument(filePath, { title, content, data });
      break;
    }

    case 'json': {
      mimeType = 'application/json';
      await generateJsonDocument(filePath, { title, content, data });
      break;
    }
  }

  const fileStats = fs.statSync(filePath);
  const size = fileStats.size;

  // Store metadata in registry
  const meta = {
    fileId,
    fileName,
    filePath,
    mimeType,
    size,
    createdAt: new Date(),
    userId: String(userId),
    title,
    format: cleanFormat,
  };
  generatedDocumentRegistry.set(fileId, meta);

  // If destination is Google Drive, dispatch upload to drive
  if (destination === 'google_drive') {
    try {
      const driveUpload = await uploadFileToDrive(userId, {
        filePath,
        fileName,
        mimeType,
        folderId,
      });

      return {
        success: true,
        format: cleanFormat,
        destination: 'google_drive',
        title,
        fileName,
        size,
        fileId: driveUpload.fileId,
        webViewLink: driveUpload.webViewLink,
        downloadUrl: `/api/v1/chat/downloads/${fileId}`,
        message: `Document "${title}" (${cleanFormat.toUpperCase()}) created and uploaded directly to Google Drive.`,
      };
    } catch (driveErr) {
      logger.warn(
        `[documentGenerationService] Drive upload failed: ${driveErr.message}. Falling back to direct browser download.`
      );
      return {
        success: true,
        format: cleanFormat,
        destination: 'download',
        title,
        fileName,
        fileId,
        downloadUrl: `/api/v1/chat/downloads/${fileId}`,
        size,
        googleDriveError: driveErr.message,
        message: `Document "${title}" (${cleanFormat.toUpperCase()}) was generated successfully and is ready for direct download. (Note: Google Drive upload failed: ${driveErr.message})`,
      };
    }
  }

  // Default: browser download delivery
  const downloadUrl = `/api/v1/chat/downloads/${fileId}`;
  return {
    success: true,
    format: cleanFormat,
    destination: 'download',
    title,
    fileId,
    fileName,
    mimeType,
    size,
    downloadUrl,
    message: `Document "${title}" (${cleanFormat.toUpperCase()}) successfully generated and ready for download.`,
  };
}

/**
 * Generates a vector PDF using PDFKit.
 */
function generatePdfDocument(filePath, { title, content, data }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Title & Header
      doc.fontSize(22).font('Helvetica-Bold').text(title, { align: 'left' });
      doc.fontSize(10).font('Helvetica').fillColor('#666666').text(
        `Generated on: ${new Date().toLocaleString()}`,
        { align: 'left' }
      );
      doc.moveDown(1.5);
      doc.fillColor('#000000');

      // Open-ended Content Parsing (Markdown-aware paragraphs and headers)
      if (content && typeof content === 'string') {
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('# ')) {
            doc.moveDown(0.8);
            doc.fontSize(18).font('Helvetica-Bold').text(trimmed.slice(2));
            doc.moveDown(0.3);
          } else if (trimmed.startsWith('## ')) {
            doc.moveDown(0.6);
            doc.fontSize(14).font('Helvetica-Bold').text(trimmed.slice(3));
            doc.moveDown(0.2);
          } else if (trimmed.startsWith('### ')) {
            doc.moveDown(0.4);
            doc.fontSize(12).font('Helvetica-Bold').text(trimmed.slice(4));
            doc.moveDown(0.2);
          } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            doc.fontSize(10).font('Helvetica').text(`  •  ${trimmed.slice(2)}`);
          } else if (trimmed.length > 0) {
            doc.fontSize(10).font('Helvetica').text(trimmed, { align: 'justify' });
            doc.moveDown(0.3);
          } else {
            doc.moveDown(0.4);
          }
        }
      }

      // Open-ended Data Table Rendering
      if (data) {
        const tableRows = normalizeSpreadsheetData(data);
        if (tableRows.length > 0) {
          doc.moveDown(1.0);
          const colCount = Math.max(...tableRows.map((r) => r.length));
          const availableWidth = doc.page.width - 100;
          const colWidth = Math.max(availableWidth / colCount, 60);

          tableRows.forEach((row, rowIndex) => {
            const isHeader = rowIndex === 0;
            const fontName = isHeader ? 'Helvetica-Bold' : 'Helvetica';
            doc.fontSize(9).font(fontName);

            // Draw simple row text
            const rowText = row.map((cell) => String(cell ?? '')).join('   |   ');
            if (isHeader) {
              doc.fillColor('#1976d2').text(rowText);
              doc.fillColor('#000000');
              doc.moveDown(0.2);
            } else {
              doc.text(rowText);
            }
          });
        }
      }

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates a Word (.docx) document using docx.
 */
async function generateWordDocument(filePath, { title, content, data }) {
  const { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, Packer, AlignmentType } = docx;

  const children = [];

  // Title
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated on: ${new Date().toLocaleString()}`,
          italics: true,
          color: '666666',
          size: 20,
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Content Paragraphs
  if (content && typeof content === 'string') {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        children.push(
          new Paragraph({
            text: trimmed.slice(2),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (trimmed.startsWith('## ')) {
        children.push(
          new Paragraph({
            text: trimmed.slice(3),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 160, after: 80 },
          })
        );
      } else if (trimmed.startsWith('### ')) {
        children.push(
          new Paragraph({
            text: trimmed.slice(4),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 120, after: 60 },
          })
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        children.push(
          new Paragraph({
            text: trimmed.slice(2),
            bullet: { level: 0 },
            spacing: { after: 60 },
          })
        );
      } else if (trimmed.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun(trimmed)],
            spacing: { after: 120 },
          })
        );
      }
    }
  }

  // Data Table
  if (data) {
    const tableRows = normalizeSpreadsheetData(data);
    if (tableRows.length > 0) {
      const docxRows = tableRows.map((row, rowIndex) => {
        const isHeader = rowIndex === 0;
        return new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(cell ?? ''),
                        bold: isHeader,
                      }),
                    ],
                  }),
                ],
                width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
              })
          ),
        });
      });

      children.push(
        new Paragraph({ text: '', spacing: { before: 200 } }),
        new Table({
          rows: docxRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
}

/**
 * Generates an Excel (.xlsx) workbook using XLSX.
 */
async function generateExcelDocument(filePath, { title, content, data }) {
  let rows = [];
  if (data) {
    rows = normalizeSpreadsheetData(data);
  } else if (content) {
    // If only content is provided, check if it contains a markdown table or text lines
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    const tableLines = lines.filter((l) => l.startsWith('|') && l.endsWith('|'));
    if (tableLines.length >= 2) {
      rows = tableLines
        .filter((l) => !/^\|[\s\-:|]+\|$/.test(l))
        .map((l) =>
          l
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        );
    } else {
      rows = [['Title', title], ['Content', content], ['Generated At', new Date().toISOString()]];
    }
  } else {
    rows = [['Title', title], ['Generated At', new Date().toISOString()]];
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const sheetName = sanitizeFileName(title).slice(0, 31) || 'Sheet1';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filePath);
}

/**
 * Generates an RFC 4180 CSV file.
 */
async function generateCsvDocument(filePath, { title, content, data }) {
  let rows = [];
  if (data) {
    rows = normalizeSpreadsheetData(data);
  } else if (content) {
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    const tableLines = lines.filter((l) => l.startsWith('|') && l.endsWith('|'));
    if (tableLines.length >= 2) {
      rows = tableLines
        .filter((l) => !/^\|[\s\-:|]+\|$/.test(l))
        .map((l) =>
          l
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        );
    } else {
      rows = [['Title', title], ['Content', content]];
    }
  } else {
    rows = [['Title', title]];
  }

  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '');
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(',')
    )
    .join('\n');

  fs.writeFileSync(filePath, csvContent, 'utf8');
}

/**
 * Generates a clean Markdown file.
 */
async function generateMarkdownDocument(filePath, { title, content, data }) {
  let md = `# ${title}\n\n_Generated on: ${new Date().toLocaleString()}_\n\n`;
  if (content) {
    md += `${content.trim()}\n\n`;
  }
  if (data) {
    const rows = normalizeSpreadsheetData(data);
    if (rows.length > 0) {
      const headers = rows[0];
      md += `| ${headers.map((h) => String(h)).join(' | ')} |\n`;
      md += `| ${headers.map(() => '---').join(' | ')} |\n`;
      for (let i = 1; i < rows.length; i++) {
        md += `| ${rows[i].map((c) => String(c ?? '')).join(' | ')} |\n`;
      }
      md += '\n';
    }
  }
  fs.writeFileSync(filePath, md, 'utf8');
}

/**
 * Generates a clean JSON file.
 */
async function generateJsonDocument(filePath, { title, content, data }) {
  const jsonPayload = {
    title,
    generatedAt: new Date().toISOString(),
    content: content || null,
    data: data || null,
  };
  fs.writeFileSync(filePath, JSON.stringify(jsonPayload, null, 2), 'utf8');
}

export default {
  generateDocumentFile,
  generatedDocumentRegistry,
};
