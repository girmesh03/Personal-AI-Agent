/**
 * @module validations/chatValidation
 * @description express-validator rule chains for conversational chat sessions, multi-modal turn submissions, and chat management.
 * Enforces multi-modal turn input boundaries, file caps, MIME whitelists, and security field rejection.
 */

import path from 'node:path';
import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';
import {
  CHAT_CONSTANTS,
  AUDIO_CONSTANTS,
  ATTACHMENT_CONSTANTS,
  AI_MODELS,
} from '../utils/constants.js';

/**
 * Validates whether an incoming value is a valid 24-character hexadecimal MongoDB ObjectId.
 * Enforces canonical Mongoose ObjectId instantiation and string round-trip equivalence.
 * @function isValidObjectId
 * @param {string} value - Candidate identifier string.
 * @returns {boolean} True if strictly valid MongoDB ObjectId.
 */
const isValidObjectId = (value) =>
  typeof value === 'string' &&
  mongoose.Types.ObjectId.isValid(value) &&
  String(new mongoose.Types.ObjectId(value)) === value;

/**
 * Validation rules for chat session route parameter.
 * Verifies that :chatId is a valid 24-character hexadecimal MongoDB ObjectId.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const chatIdValidation = [
  param('chatId')
    .trim()
    .notEmpty()
    .withMessage('Chat ID parameter is required.')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Valid chat ID is required.');
      }
      return true;
    }),
];

/**
 * Validation rules for retrieving chat session by ID with optional message slice pagination.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const getChatByIdValidation = [
  param('chatId')
    .trim()
    .notEmpty()
    .withMessage('Chat ID parameter is required.')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Valid chat ID is required.');
      }
      return true;
    }),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Message history limit must be an integer between 1 and 200.')
    .toInt(),
];

/**
 * Validation rules for submitting a multi-modal conversational turn.
 * Enforces the core invariant: at least one input modality (text, audios, attachments, or retryTurnIndex) must be provided.
 * Enforces single-file and batch upload limits, MIME whitelists, and rejects administrative field injections.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const sendChatMessageValidation = [
  // Multi-modal turn invariant: at least one of text, audios, attachments, or retryTurnIndex/isRetry must be provided
  body().custom((_, { req }) => {
    const b = req?.body || {};
    const hasText =
      b.text &&
      typeof b.text === 'string' &&
      b.text.trim().length > 0;
    const hasAudios = Array.isArray(b.audios) && b.audios.length > 0;
    const hasAttachments =
      Array.isArray(b.attachments) && b.attachments.length > 0;
    const hasRetry =
      (b.retryTurnIndex !== undefined && b.retryTurnIndex !== null) ||
      b.isRetry === true ||
      b.isRetry === 'true';
    const hasContinue =
      b.continueTurn === true ||
      b.continueTurn === 'true';

    if (!hasText && !hasAudios && !hasAttachments && !hasRetry && !hasContinue) {
      throw new Error(
        'Message turn must include at least one input modality: text, audio, or attachment.'
      );
    }
    return true;
  }),

  body('chatId')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error('Valid chat ID is required.');
      }
      return true;
    }),

  body('model')
    .optional()
    .trim()
    .isString()
    .withMessage('Model identifier must be a string.')
    .custom((value) => {
      if (value && !AI_MODELS.SUPPORTED.includes(value)) {
        throw new Error(`Model '${value}' is not supported.`);
      }
      return true;
    }),

  body('thinkingBudget')
    .optional()
    .isInt({ min: 0, max: 24576 })
    .withMessage('thinkingBudget must be an integer between 0 and 24576.')
    .toInt(),

  body('language')
    .optional()
    .trim()
    .isString()
    .isLength({ min: 2, max: 10 })
    .withMessage('Language code must be a valid language string (e.g. "am", "en").'),

  body('editTurnIndex')
    .optional()
    .isInt({ min: 0 })
    .withMessage('editTurnIndex must be a non-negative integer.')
    .toInt(),

  body('retryTurnIndex')
    .optional()
    .isInt({ min: 0 })
    .withMessage('retryTurnIndex must be a non-negative integer.')
    .toInt(),

  body('isRetry')
    .optional()
    .isBoolean()
    .toBoolean(),

  body('continueTurn')
    .optional()
    .isBoolean()
    .toBoolean(),

  body('anchorUserMessageId')
    .optional()
    .trim()
    .isString(),

  body('targetAssistantMessageId')
    .optional()
    .trim()
    .isString(),

  body('text')
    .optional({ nullable: true })
    .isString()
    .withMessage('Message text must be a string.')
    .trim()
    .isLength({ max: CHAT_CONSTANTS.MAX_MESSAGE_LENGTH })
    .withMessage(
      `Message text cannot exceed ${CHAT_CONSTANTS.MAX_MESSAGE_LENGTH} characters.`
    ),

  body('audios')
    .optional()
    .isArray({ max: AUDIO_CONSTANTS.MAX_FILES_COUNT })
    .withMessage(
      `A message turn cannot exceed ${AUDIO_CONSTANTS.MAX_FILES_COUNT} audio files.`
    ),

  body('audios.*')
    .optional()
    .trim()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Each audio reference must be a valid audio ID.');
      }
      return true;
    }),

  body('attachments')
    .optional()
    .isArray({ max: ATTACHMENT_CONSTANTS.MAX_FILES_COUNT })
    .withMessage(
      `A message turn cannot exceed ${ATTACHMENT_CONSTANTS.MAX_FILES_COUNT} attachments.`
    )
    .custom((attachments) => {
      if (!Array.isArray(attachments)) return true;
      const totalSize = attachments.reduce(
        (sum, item) => sum + (Number(item?.size) || 0),
        0
      );
      if (totalSize > ATTACHMENT_CONSTANTS.MAX_BATCH_SIZE_BYTES) {
        throw new Error(
          `Total attachment batch size cannot exceed ${ATTACHMENT_CONSTANTS.MAX_BATCH_SIZE_BYTES} bytes (50MB).`
        );
      }
      return true;
    }),

  body('attachments.*.fileName')
    .if(body('attachments').isArray({ min: 1 }))
    .trim()
    .notEmpty()
    .withMessage('Attachment fileName is required.')
    .isLength({ max: 255 })
    .withMessage('Attachment fileName cannot exceed 255 characters.')
    .custom((fileName) => {
      const ext = path.extname(fileName).toLowerCase();
      if (!ATTACHMENT_CONSTANTS.ALLOWED_EXTENSIONS.includes(ext)) {
        throw new Error(`File extension '${ext}' is not permitted.`);
      }
      return true;
    }),

  body('attachments.*.path')
    .if(body('attachments').isArray({ min: 1 }))
    .trim()
    .notEmpty()
    .withMessage('Attachment path is required.')
    .customSanitizer((filePath) => (typeof filePath === 'string' ? filePath.replace(/^\/+/, '') : filePath))
    .custom((filePath) => {
      if (typeof filePath === 'string' && (filePath.includes('..') || path.isAbsolute(filePath))) {
        throw new Error('Attachment path must be a safe relative storage path.');
      }
      return true;
    }),

  body('attachments.*.mimeType')
    .if(body('attachments').isArray({ min: 1 }))
    .trim()
    .notEmpty()
    .withMessage('Attachment mimeType is required.')
    .isIn(ATTACHMENT_CONSTANTS.ALLOWED_MIME_TYPES)
    .withMessage('Unsupported attachment MIME format.'),

  body('attachments.*.size')
    .if(body('attachments').isArray({ min: 1 }))
    .notEmpty()
    .withMessage('Attachment size is required.')
    .isInt({ min: 1, max: ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES })
    .withMessage(
      `Attachment file size must be between 1 byte and ${ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES} bytes (25MB).`
    ),

  // Security Invariants: reject forbidden field injections on chat turns
  body('role').custom((value) => {
    if (value !== undefined) {
      throw new Error('Message role cannot be overridden by client.');
    }
    return true;
  }),

  body('user').custom((value) => {
    if (value !== undefined) {
      throw new Error('User ownership cannot be overridden in request body.');
    }
    return true;
  }),

  body('_id').custom((value) => {
    if (value !== undefined) {
      throw new Error('Turn identifier cannot be manually specified.');
    }
    return true;
  }),

  body('status').custom((value) => {
    if (value !== undefined) {
      throw new Error('Turn status cannot be assigned directly.');
    }
    return true;
  }),

  body('templateType').custom((value) => {
    if (value !== undefined) {
      throw new Error('templateType is prohibited on conversational turns.');
    }
    return true;
  }),

  body('isArchived').custom((value) => {
    if (value !== undefined) {
      throw new Error('isArchived cannot be assigned directly.');
    }
    return true;
  }),

  body('archivedAt').custom((value) => {
    if (value !== undefined) {
      throw new Error('archivedAt cannot be assigned directly.');
    }
    return true;
  }),
];

/**
 * Validation rules for renaming a chat session.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const renameChatValidation = [
  param('chatId')
    .trim()
    .notEmpty()
    .withMessage('Chat ID parameter is required.')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Valid chat ID is required.');
      }
      return true;
    }),

  body('title')
    .trim()
    .notEmpty()
    .withMessage('Chat title is required.')
    .isLength({ min: 1, max: CHAT_CONSTANTS.TITLE_MAX_LENGTH })
    .withMessage(
      `Chat title cannot exceed ${CHAT_CONSTANTS.TITLE_MAX_LENGTH} characters.`
    ),

  // Security Invariants
  body('user').custom((value) => {
    if (value !== undefined) {
      throw new Error('User ownership cannot be overridden.');
    }
    return true;
  }),

  body('_id').custom((value) => {
    if (value !== undefined) {
      throw new Error('Chat identifier cannot be modified.');
    }
    return true;
  }),
];

/**
 * Validation rules for listing/querying chat sessions.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const getChatsValidation = [
  query('page')
    .optional()
    .isInt({ min: CHAT_CONSTANTS.PAGE_LIMIT_MIN })
    .withMessage('Page number must be a positive integer.')
    .toInt(),

  query('limit')
    .optional()
    .isInt({
      min: CHAT_CONSTANTS.PAGE_LIMIT_MIN,
      max: CHAT_CONSTANTS.PAGE_LIMIT_MAX,
    })
    .withMessage(
      `Page limit must be between ${CHAT_CONSTANTS.PAGE_LIMIT_MIN} and ${CHAT_CONSTANTS.PAGE_LIMIT_MAX}.`
    )
    .toInt(),

  query('archived')
    .optional()
    .customSanitizer((val) => {
      if (val === '' || val === 'true' || val === true || val === '1') return true;
      if (val === 'false' || val === false || val === '0') return false;
      return val;
    })
    .isBoolean()
    .withMessage('archived filter must be a valid boolean flag.'),

  query('pinned')
    .optional()
    .customSanitizer((val) => {
      if (val === '' || val === 'true' || val === true || val === '1') return true;
      if (val === 'false' || val === false || val === '0') return false;
      return val;
    })
    .isBoolean()
    .withMessage('pinned filter must be a valid boolean flag.'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query cannot exceed 100 characters.'),
];

/**
 * Validation rules for updating chat session configuration (model, thinkingBudget, language, prompt).
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const updateChatConfigValidation = [
  param('chatId')
    .trim()
    .notEmpty()
    .withMessage('Chat ID parameter is required.')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Valid chat ID is required.');
      }
      return true;
    }),

  body().custom((_, { req }) => {
    const b = req?.body || {};
    const hasModel = b.model !== undefined;
    const hasThinkingBudget = b.thinkingBudget !== undefined;
    const hasLanguage = b.language !== undefined;
    const hasPrompt = b.prompt !== undefined;

    if (!hasModel && !hasThinkingBudget && !hasLanguage && !hasPrompt) {
      throw new Error(
        'At least one configuration property (model, thinkingBudget, language, prompt) must be provided.'
      );
    }
    return true;
  }),

  body('model')
    .optional()
    .trim()
    .isString()
    .withMessage('Model identifier must be a string.')
    .custom((value) => {
      if (value && !AI_MODELS.SUPPORTED.includes(value)) {
        throw new Error(`Model '${value}' is not supported.`);
      }
      return true;
    }),

  body('thinkingBudget')
    .optional()
    .isInt({ min: 0, max: 24576 })
    .withMessage('thinkingBudget must be an integer between 0 and 24576.')
    .toInt(),

  body('language')
    .optional()
    .trim()
    .isString()
    .isLength({ min: 2, max: 10 })
    .withMessage('Language code must be a valid language string (e.g. "am", "en").'),

  body('prompt')
    .optional()
    .trim()
    .isString()
    .isLength({ max: 2000 })
    .withMessage('Prompt cannot exceed 2000 characters.'),

  // Security Invariants
  body('user').custom((value) => {
    if (value !== undefined) {
      throw new Error('User ownership cannot be overridden.');
    }
    return true;
  }),

  body('_id').custom((value) => {
    if (value !== undefined) {
      throw new Error('Chat identifier cannot be modified.');
    }
    return true;
  }),
];

export default {
  chatIdValidation,
  getChatByIdValidation,
  sendChatMessageValidation,
  renameChatValidation,
  getChatsValidation,
  updateChatConfigValidation,
};
