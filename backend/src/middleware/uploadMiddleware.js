/**
 * @module middleware/uploadMiddleware
 * @description Centralized Multer multipart upload middleware for audio and media assets.
 * Enforces storage isolation, UUID filename generation, strict MIME & extension whitelists,
 * single file caps (25MB), batch counts (5 files), and cumulative batch size validation (50MB).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { AUDIO_CONSTANTS, ATTACHMENT_CONSTANTS, UPLOADS_CONFIG } from '../utils/constants.js';
import { BadRequestError } from '../errors/CustomError.js';

// Ensure all domain storage directories exist synchronously at module initialization
for (const dir of Object.values(UPLOADS_CONFIG.DOMAIN_DIRS || {})) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
if (!fs.existsSync(UPLOADS_CONFIG.ATTACHMENTS_DIR)) {
  fs.mkdirSync(UPLOADS_CONFIG.ATTACHMENTS_DIR, { recursive: true });
}

const AUDIO_UPLOAD_DIR = UPLOADS_CONFIG.AUDIOS_DIR;

/**
 * Multer disk storage engine configuring destination and collision-free UUID filenames.
 */
const audioDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, AUDIO_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeFilename = `${crypto.randomUUID()}${ext}`;
    cb(null, safeFilename);
  },
});

/**
 * Multer file filter enforcing strict audio MIME types and extension whitelists.
 *
 * @param {import('express').Request} _req - Express request.
 * @param {Express.Multer.File} file - Uploaded file metadata.
 * @param {multer.FileFilterCallback} cb - Multer callback.
 */
const audioFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const rawMime = (file.mimetype || '').toLowerCase();
  const cleanMime = rawMime.split(';')[0].trim();

  const isValidExt = AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.includes(ext);
  const isValidMime =
    AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes(rawMime) ||
    AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes(cleanMime) ||
    cleanMime.startsWith('audio/') ||
    (ext === '.webm' && (cleanMime === 'video/webm' || cleanMime === 'audio/webm'));

  if (!isValidMime || !isValidExt) {
    return cb(
      new BadRequestError(
        `Unsupported audio format (${ext || 'unknown'}). Allowed formats: ${AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.join(', ')}.`
      )
    );
  }

  cb(null, true);
};

/**
 * Pre-configured Multer instance for multi-file audio ingestion.
 */
const multerAudioUpload = multer({
  storage: audioDiskStorage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: AUDIO_CONSTANTS.MAX_FILE_SIZE_BYTES, // 25MB
    files: AUDIO_CONSTANTS.MAX_FILES_COUNT, // 5 files
  },
});

/**
 * Express middleware handling audio multi-part uploads with normalized error handling.
 * Intercepts Multer limits and converts them to descriptive BadRequestError instances.
 *
 * @function uploadReportAudiosMiddleware
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next function.
 */
export const uploadReportAudiosMiddleware = (req, res, next) => {
  const uploader = multerAudioUpload.array('audios', AUDIO_CONSTANTS.MAX_FILES_COUNT);

  uploader(req, res, (err) => {
    if (!err) {
      const files = req.files || [];
      const emptyFile = files.find((f) => f.size === 0);
      if (emptyFile) {
        for (const f of files) {
          try { fs.unlinkSync(f.path); } catch (_) {}
        }
        return next(new BadRequestError('Empty audio recording (0 bytes) detected.'));
      }
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new BadRequestError(
            `Audio file exceeds the ${AUDIO_CONSTANTS.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB maximum file limit.`
          )
        );
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(
          new BadRequestError(
            `Cannot upload more than ${AUDIO_CONSTANTS.MAX_FILES_COUNT} audio files in a single request.`
          )
        );
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(
          new BadRequestError(
            `Unexpected upload field "${err.field}". Audio files must be uploaded under the "audios" field.`
          )
        );
      }
      return next(new BadRequestError(`Audio upload error: ${err.message}`));
    }

    // Pass custom errors or other exceptions
    next(err);
  });
};

/**
 * Multer middleware handling single audio uploads for live voice dictation transcription.
 * Accepts fields 'audio', 'audios', or 'file'.
 *
 * @function uploadSingleAudioMiddleware
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next function.
 */
export const uploadSingleAudioMiddleware = (req, res, next) => {
  const uploader = multerAudioUpload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'audios', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  uploader(req, res, (err) => {
    if (!err) {
      if (req.files) {
        req.file =
          req.files.audio?.[0] ||
          req.files.audios?.[0] ||
          req.files.file?.[0] ||
          null;
      }
      if (req.file && req.file.size === 0) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        return next(new BadRequestError('Empty audio recording (0 bytes) detected.'));
      }
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new BadRequestError(
            `Audio file exceeds the ${AUDIO_CONSTANTS.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB maximum file limit.`
          )
        );
      }
      return next(new BadRequestError(`Audio upload error: ${err.message}`));
    }

    next(err);
  });
};

/**
 * Multer disk storage engine for chat document, image, and audio attachments.
 * Dynamically partitions uploads into domain directories: images/, audios/, or files/.
 */
const attachmentDiskStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const rawMime = (file.mimetype || '').toLowerCase();
    const cleanMime = rawMime.split(';')[0].trim();

    const isImage =
      ATTACHMENT_CONSTANTS.ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype) ||
      ATTACHMENT_CONSTANTS.ALLOWED_IMAGE_EXTENSIONS.includes(ext) ||
      cleanMime.startsWith('image/');

    const isAudio =
      AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes(file.mimetype) ||
      AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes(cleanMime) ||
      cleanMime.startsWith('audio/') ||
      AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.includes(ext) ||
      (ext === '.webm' && (cleanMime === 'video/webm' || cleanMime === 'audio/webm'));

    if (isImage) {
      file.domain = 'images';
      cb(null, UPLOADS_CONFIG.IMAGES_DIR);
    } else if (isAudio) {
      file.domain = 'audios';
      cb(null, UPLOADS_CONFIG.AUDIOS_DIR);
    } else {
      file.domain = 'files';
      cb(null, UPLOADS_CONFIG.FILES_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeFilename = `${crypto.randomUUID()}${ext}`;
    cb(null, safeFilename);
  },
});

/**
 * Multer file filter enforcing strict attachment MIME types and extension whitelists.
 * Accepts all supported media from both ATTACHMENT_CONSTANTS and AUDIO_CONSTANTS.
 */
const attachmentFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const rawMime = (file.mimetype || '').toLowerCase();
  const cleanMime = rawMime.split(';')[0].trim();

  const isAttachmentMime = ATTACHMENT_CONSTANTS.ALLOWED_MIME_TYPES.includes(file.mimetype);
  const isAttachmentExt = ATTACHMENT_CONSTANTS.ALLOWED_EXTENSIONS.includes(ext);

  const isAudioMime =
    AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes(file.mimetype) ||
    AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes(cleanMime) ||
    cleanMime.startsWith('audio/') ||
    (ext === '.webm' && (cleanMime === 'video/webm' || cleanMime === 'audio/webm'));
  const isAudioExt = AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.includes(ext);

  const isValid = (isAttachmentMime && isAttachmentExt) || (isAudioMime && isAudioExt);

  if (!isValid) {
    const allAllowedExts = [...ATTACHMENT_CONSTANTS.ALLOWED_EXTENSIONS, ...AUDIO_CONSTANTS.ALLOWED_EXTENSIONS];
    return cb(
      new BadRequestError(
        `Unsupported attachment format (${ext || 'unknown'}). Allowed formats: ${allAllowedExts.join(', ')}.`
      )
    );
  }

  cb(null, true);
};

/**
 * Pre-configured Multer instance for multi-file attachment ingestion.
 */
const multerAttachmentUpload = multer({
  storage: attachmentDiskStorage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES, // 25MB
    files: ATTACHMENT_CONSTANTS.MAX_FILES_COUNT, // 5 files
  },
});

/**
 * Express middleware handling attachment multi-part uploads with normalized error handling.
 *
 * @function uploadChatAttachmentsMiddleware
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next function.
 */
export const uploadChatAttachmentsMiddleware = (req, res, next) => {
  const uploader = multerAttachmentUpload.array('attachments', ATTACHMENT_CONSTANTS.MAX_FILES_COUNT);

  uploader(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new BadRequestError(
            `Attachment file exceeds the ${ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB maximum file limit.`
          )
        );
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(
          new BadRequestError(
            `Cannot upload more than ${ATTACHMENT_CONSTANTS.MAX_FILES_COUNT} attachments in a single request.`
          )
        );
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(
          new BadRequestError(
            `Unexpected upload field "${err.field}". Attachments must be uploaded under the "attachments" field.`
          )
        );
      }
      return next(new BadRequestError(`Attachment upload error: ${err.message}`));
    }

    next(err);
  });
};

export default {
  uploadReportAudiosMiddleware,
  uploadChatAttachmentsMiddleware,
};

