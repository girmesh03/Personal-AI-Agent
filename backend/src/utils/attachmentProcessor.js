/**
 * @module utils/attachmentProcessor
 * @description Multi-modal attachment ingestion and grounding service.
 * Ingests documents, text files, and images across the 3 foundational user input pillars.
 * Text and markdown attachments are injected as structured semantic prompt blocks.
 * Images and PDFs are encoded as base64 inline multimodal parts for Gemini.
 */

import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as xlsxModule from 'xlsx';
import logger from '../config/logger.js';

const XLSX = xlsxModule.default || xlsxModule;

/**
 * Resolves absolute filesystem storage path for an attachment.
 *
 * @param {string} rawPath - Relative or absolute file path.
 * @returns {string} Absolute normalized file path.
 */
export function resolveFilePath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return '';
  if (rawPath.startsWith('blob:') || rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
    return '';
  }
  if (path.isAbsolute(rawPath)) return rawPath;
  const direct = path.resolve(process.cwd(), rawPath);
  if (fs.existsSync(direct)) return direct;
  if (rawPath.startsWith('backend/') || rawPath.startsWith('backend\\')) {
    const stripped = rawPath.replace(/^backend[\\/]/, '');
    const strippedPath = path.resolve(process.cwd(), stripped);
    if (fs.existsSync(strippedPath)) return strippedPath;
  }
  const withBackend = path.resolve(process.cwd(), 'backend', rawPath);
  if (fs.existsSync(withBackend)) return withBackend;
  return direct;
}

/**
 * Ingests a single attachment item and converts it into either a prompt text context
 * or a Gemini multimodal inlineData part.
 *
 * @param {object} attachment - Attachment record { path, originalName, mimeType, size }.
 * @returns {Promise<{ type: 'text'|'inline', content?: string, inlinePart?: object }>}
 */
export async function processAttachment(attachment) {
  const rawPath = attachment.path || attachment.fileName;
  if (
    !rawPath ||
    typeof rawPath !== 'string' ||
    rawPath.startsWith('blob:') ||
    rawPath.startsWith('http://') ||
    rawPath.startsWith('https://')
  ) {
    logger.warn(`[attachmentProcessor] Skipping invalid or non-disk attachment path: ${rawPath}`);
    return { type: 'text', content: '' };
  }

  const filePath = resolveFilePath(rawPath);
  if (!filePath || !fs.existsSync(filePath)) {
    logger.warn(`[attachmentProcessor] Attachment file not found on disk: ${filePath}`);
    return { type: 'text', content: '' };
  }

  const mimeType = (attachment.mimeType || '').toLowerCase();
  const originalName = attachment.originalName || path.basename(filePath);

  // 1. Text & Markdown Files (.txt, .md, text/plain, text/markdown, text/csv)
  if (
    mimeType.startsWith('text/') ||
    filePath.endsWith('.txt') ||
    filePath.endsWith('.md') ||
    filePath.endsWith('.csv')
  ) {
    try {
      const textContent = await fs.promises.readFile(filePath, 'utf8');
      return {
        type: 'text',
        content: `<attachment name="${originalName}" type="${mimeType || 'text/plain'}">\n${textContent}\n</attachment>`,
      };
    } catch (err) {
      logger.error(`[attachmentProcessor] Failed to read text attachment ${filePath}: ${err.message}`);
      return { type: 'text', content: '' };
    }
  }

  // 2. Microsoft Word Documents (.docx, .doc)
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    filePath.endsWith('.docx') ||
    filePath.endsWith('.doc')
  ) {
    try {
      const docResult = await mammoth.extractRawText({ path: filePath });
      const textContent = (docResult.value || '').trim();
      return {
        type: 'text',
        content: `<attachment name="${originalName}" type="docx">\n${textContent}\n</attachment>`,
      };
    } catch (err) {
      logger.error(`[attachmentProcessor] Failed to extract docx attachment ${filePath}: ${err.message}`);
      return { type: 'text', content: '' };
    }
  }

  // 3. Microsoft Excel & Spreadsheets (.xlsx, .xls)
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    filePath.endsWith('.xlsx') ||
    filePath.endsWith('.xls')
  ) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetsText = [];
      for (const sheetName of workbook.SheetNames || []) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv && csv.trim()) {
            sheetsText.push(`--- Sheet: ${sheetName} ---\n${csv.trim()}`);
          }
        }
      }
      const textContent = sheetsText.join('\n\n');
      return {
        type: 'text',
        content: `<attachment name="${originalName}" type="spreadsheet">\n${textContent}\n</attachment>`,
      };
    } catch (err) {
      logger.error(`[attachmentProcessor] Failed to extract spreadsheet attachment ${filePath}: ${err.message}`);
      return { type: 'text', content: '' };
    }
  }

  // 2. Images (JPEG, PNG, WebP) and PDF documents -> Base64 inline multimodal part
  if (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    filePath.endsWith('.png') ||
    filePath.endsWith('.jpg') ||
    filePath.endsWith('.jpeg') ||
    filePath.endsWith('.webp') ||
    filePath.endsWith('.pdf')
  ) {
    try {
      const fileBuffer = await fs.promises.readFile(filePath);
      const base64Data = fileBuffer.toString('base64');
      const resolvedMime = mimeType || (filePath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      return {
        type: 'inline',
        inlinePart: {
          inlineData: {
            mimeType: resolvedMime,
            data: base64Data,
          },
        },
      };
    } catch (err) {
      logger.error(`[attachmentProcessor] Failed to read binary attachment ${filePath}: ${err.message}`);
      return { type: 'text', content: '' };
    }
  }

  return { type: 'text', content: '' };
}

/**
 * Ingests an array of attachment objects and extracts text contexts and multimodal parts.
 *
 * @param {Array<object>} attachments - Array of attachment subdocuments or objects.
 * @returns {Promise<{ textContext: string, inlineParts: Array<object> }>}
 */
export async function processAttachments(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return { textContext: '', inlineParts: [] };
  }

  const textBlocks = [];
  const inlineParts = [];

  for (const att of attachments) {
    const result = await processAttachment(att);
    if (result.type === 'text' && result.content) {
      textBlocks.push(result.content);
    } else if (result.type === 'inline' && result.inlinePart) {
      inlineParts.push(result.inlinePart);
    }
  }

  return {
    textContext: textBlocks.join('\n\n'),
    inlineParts,
  };
}

export default {
  processAttachment,
  processAttachments,
};
