/**
 * @module routes/chatRoutes
 * @description Express routing definitions for multi-turn AI streaming chat sessions,
 * real-time SSE stream endpoints, turn submissions, session management (list, get, pin, rename, delete),
 * and audio/attachment uploads.
 * All routes are protected by verifyToken middleware and strictly scoped to req.user._id.
 */

import express from 'express';

import {
  streamChat,
  getChats,
  getChatById,
  updateChatConfig,
  pinChat,
  renameChat,
  deleteChat,
  uploadChatAttachments,
  uploadChatAudios,
  deleteComposerAttachment,
  transcribeAudio,
  shareToTelegramDirect,
  downloadGeneratedDocument,
} from '../controllers/chatController.js';

import {
  chatIdValidation,
  getChatByIdValidation,
  sendChatMessageValidation,
  renameChatValidation,
  getChatsValidation,
  updateChatConfigValidation,
} from '../validations/chatValidation.js';

import {
  uploadReportAudiosMiddleware,
  uploadSingleAudioMiddleware,
  uploadChatAttachmentsMiddleware,
} from '../middleware/uploadMiddleware.js';

import { validate } from '../middleware/validate.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce authentication across all chat endpoints
router.use(verifyToken);

/**
 * @route POST /api/v1/chat/transcribe-audio
 * @desc Transcribe single voice recording for in-composer live dictation
 * @access Protected (Area Supervisor)
 */
router.post('/transcribe-audio', uploadSingleAudioMiddleware, transcribeAudio);

/**
 * @route POST /api/v1/chat/upload-audio
 * @desc Ingest 1 to 5 audio recordings for chat turn grounding
 * @access Protected (Area Supervisor)
Personal-AI-Agent-V1Personal-AI-Agent-V1 */
router.post('/upload-audio', uploadReportAudiosMiddleware, uploadChatAudios);

/**
 * @route POST /api/v1/chat/upload-attachments
 * @desc Ingest 1 to 5 document / image attachments for chat turn grounding
 * @access Protected (Area Supervisor)
 */
router.post('/upload-attachments', uploadChatAttachmentsMiddleware, uploadChatAttachments);

/**
 * @route DELETE /api/v1/chat/attachment
 * @desc Dismiss staged attachment from composer shelf and purge from Cloudinary CDN
 * @access Protected (Personal AI Agent)
 */
router.delete('/attachment', deleteComposerAttachment);
router.delete('/attachment/:publicId', deleteComposerAttachment);

/**
 * @route POST /api/v1/chat/share-telegram
 * @desc Manually dispatch message text to Telegram channel/supergroup
 * @access Protected (Area Supervisor)
 */
router.post('/share-telegram', shareToTelegramDirect);

/**
 * @route POST /api/v1/chat/stream
 * @desc Initialize a new chat session or continue existing (chatId in body) via SSE streaming
 * @access Protected (Area Supervisor)
 */
router.post('/stream', sendChatMessageValidation, validate, streamChat);

/**
 * @route POST /api/v1/chat/:chatId/stream
 * @desc Continue an existing chat session via SSE streaming
 * @access Protected (Area Supervisor)
 */
router.post('/:chatId/stream', chatIdValidation, sendChatMessageValidation, validate, streamChat);

/**
 * @route GET /api/v1/chat
 * @desc Retrieve paginated chat sessions list
 * @access Protected (Area Supervisor)
 */
router.get('/', getChatsValidation, validate, getChats);

/**
 * @route GET /api/v1/chat/downloads/:fileId
 * @desc Securely download generated document asset
 * @access Protected (Area Supervisor)
 */
router.get('/downloads/:fileId', downloadGeneratedDocument);

/**
 * @route GET /api/v1/chat/:chatId
 * @desc Retrieve full chat session details and message history (optional ?limit=N slice)
 * @access Protected (Area Supervisor)
 */
router.get('/:chatId', getChatByIdValidation, validate, getChatById);

/**
 * @route PATCH /api/v1/chat/:chatId/config
 * @desc Update chat session configuration parameters (model, thinkingBudget, language, prompt)
 * @access Protected (Area Supervisor)
 */
router.patch('/:chatId/config', updateChatConfigValidation, validate, updateChatConfig);

/**
 * @route PATCH /api/v1/chat/:chatId/pin
 * @desc Toggle pinned state of a chat session
 * @access Protected (Area Supervisor)
 */
router.patch('/:chatId/pin', chatIdValidation, validate, pinChat);

/**
 * @route PATCH /api/v1/chat/:chatId/title
 * @desc Manually rename chat session title
 * @access Protected (Area Supervisor)
 */
router.patch('/:chatId/title', renameChatValidation, validate, renameChat);

/**
 * @route DELETE /api/v1/chat/:chatId
 * @desc Permanently delete chat session
 * @access Protected (Area Supervisor)
 */
router.delete('/:chatId', chatIdValidation, validate, deleteChat);

export default router;
