/**
 * @module utils/validateChatAttachment
 * @description Client-side pre-send validation engine for chat attachments and audio notes.
 * Enforces 4 strict validation gates (MIME whitelist, single file size <= 25MB, count <= 5, batch size <= 50MB)
 * with immediate user toast feedback via react-toastify to conserve mobile bandwidth.
 */

import { toast } from 'react-toastify';
import { ATTACHMENT_CONSTANTS, AUDIO_CONSTANTS } from './constants.js';

/**
 * Combined allowed MIME types covering both documents/images and audio recordings.
 * @constant
 * @type {Set<string>}
 */
const ALLOWED_MIME_TYPES = new Set([
  ...ATTACHMENT_CONSTANTS.ALLOWED_MIME_TYPES,
  ...AUDIO_CONSTANTS.ALLOWED_MIME_TYPES,
]);

/**
 * Combined allowed file extensions covering both documents/images and audio recordings.
 * @constant
 * @type {string[]}
 */
const ALLOWED_EXTENSIONS = [
  ...ATTACHMENT_CONSTANTS.ALLOWED_EXTENSIONS,
  ...AUDIO_CONSTANTS.ALLOWED_EXTENSIONS,
];

/**
 * Formats bytes into a human-readable megabyte string.
 *
 * @function formatBytesToMb
 * @param {number} bytes - Size in bytes.
 * @returns {string} Formatted size (e.g., '12.4 MB').
 */
export const formatBytesToMb = (bytes) => {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

/**
 * Validates a single file against extension and MIME whitelist.
 *
 * @function isFileFormatAllowed
 * @param {File|Blob} file - File or Blob object to inspect.
 * @returns {boolean} True if MIME or extension is supported.
 */
export const isFileFormatAllowed = (file) => {
  if (!file) return false;

  // 1. Check MIME type if present
  if (file.type && ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    return true;
  }

  // 2. Check file extension fallback
  const fileName = file.name || '';
  const lowerName = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
};

/**
 * Validates a batch of files before attaching or uploading in chat.
 * Enforces the 4 strict pre-send validation gates:
 * 1. MIME and Extension Whitelist
 * 2. Single File Size Cap (<= 25MB)
 * 3. File Count Cap (<= 5 files per turn)
 * 4. Total Batch Size Cap (<= 50MB per turn)
 *
 * @function validateChatAttachments
 * @param {File[]|FileList} incoming - Incoming file or array of files to attach.
 * @param {File[]} [currentFiles=[]] - Files already selected in the active composer draft.
 * @param {object} [options={}] - Validation options.
 * @param {boolean} [options.showToast=true] - Whether to automatically emit a toast on error.
 * @returns {{
 *   isValid: boolean,
 *   validFiles: File[],
 *   error: string | null,
 *   totalSizeBytes: number,
 * }} Validation result payload.
 */
export const validateChatAttachments = (incoming, currentFiles = [], options = {}) => {
  const showToast = options.showToast !== false;
  const current = Array.isArray(currentFiles) ? currentFiles : [];
  const incomingList =
    typeof FileList !== 'undefined' && incoming instanceof FileList
      ? Array.from(incoming)
      : Array.isArray(incoming)
        ? incoming
        : [incoming].filter(Boolean);

  if (incomingList.length === 0) {
    return {
      isValid: true,
      validFiles: [],
      error: null,
      totalSizeBytes: current.reduce((sum, f) => sum + (f.size || 0), 0),
    };
  }

  // Gate 1: Check maximum file count (Max 5 files cumulative)
  const totalCount = current.length + incomingList.length;
  if (totalCount > ATTACHMENT_CONSTANTS.MAX_FILES_COUNT) {
    const error = `You can attach a maximum of ${ATTACHMENT_CONSTANTS.MAX_FILES_COUNT} files per message. (Attempted to attach ${totalCount}).`;
    if (showToast) toast.error(error);
    return {
      isValid: false,
      validFiles: [],
      error,
      totalSizeBytes: 0,
    };
  }

  // Gate 2: Format Whitelist & Single File Size Check (Max 25MB per file)
  const acceptedFiles = [];
  for (const file of incomingList) {
    if (!isFileFormatAllowed(file)) {
      const error = `"${file.name || 'File'}" is not a supported file format. Allowed types: PDF, DOCX, XLSX, CSV, TXT, images (JPEG, PNG, WEBP), and audio files.`;
      if (showToast) toast.error(error);
      return {
        isValid: false,
        validFiles: [],
        error,
        totalSizeBytes: 0,
      };
    }

    if (file.size > ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES) {
      const error = `"${file.name || 'File'}" (${formatBytesToMb(file.size)}) exceeds the ${formatBytesToMb(ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES)} single file limit.`;
      if (showToast) toast.error(error);
      return {
        isValid: false,
        validFiles: [],
        error,
        totalSizeBytes: 0,
      };
    }

    acceptedFiles.push(file);
  }

  // Gate 3: Batch Size Check (Cumulative <= 50MB)
  const currentTotal = current.reduce((sum, f) => sum + (f.size || 0), 0);
  const incomingTotal = acceptedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  const cumulativeTotal = currentTotal + incomingTotal;

  if (cumulativeTotal > ATTACHMENT_CONSTANTS.MAX_BATCH_SIZE_BYTES) {
    const error = `Total attachment size (${formatBytesToMb(cumulativeTotal)}) exceeds the ${formatBytesToMb(ATTACHMENT_CONSTANTS.MAX_BATCH_SIZE_BYTES)} batch limit.`;
    if (showToast) toast.error(error);
    return {
      isValid: false,
      validFiles: [],
      error,
      totalSizeBytes: cumulativeTotal,
    };
  }

  return {
    isValid: true,
    validFiles: acceptedFiles,
    error: null,
    totalSizeBytes: cumulativeTotal,
  };
};

export default validateChatAttachments;
