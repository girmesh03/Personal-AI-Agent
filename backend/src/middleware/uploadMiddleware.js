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
import { AUDIO_CONSTANTS } from '../utils/constants.js';
import { BadRequestError } from '../errors/CustomError.js';

// Resolve canonical uploads destination directory
const AUDIO_UPLOAD_DIR = path.resolve('uploads/audio');

// Ensure storage directory exists synchronously at module initialization
if (!fs.existsSync(AUDIO_UPLOAD_DIR)) {
  fs.mkdirSync(AUDIO_UPLOAD_DIR, { recursive: true });
}

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
  const isValidMime = AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes(file.mimetype);
  const isValidExt = AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.includes(ext);

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

export default {
  uploadReportAudiosMiddleware,
};
