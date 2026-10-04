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
  pinChat,
  renameChat,
  deleteChat,
  uploadChatAttachments,
} from '../controllers/chatController.js';

import { uploadReportAudios } from '../controllers/reportController.js';

import {
  chatIdValidation,
  sendChatMessageValidation,
  renameChatValidation,
  getChatsValidation,
} from '../validations/chatValidation.js';

import {
  uploadReportAudiosMiddleware,
  uploadChatAttachmentsMiddleware,
} from '../middleware/uploadMiddleware.js';

import { validate } from '../middleware/validate.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce authentication across all chat endpoints
router.use(verifyToken);

/**
 * @route POST /api/v1/chat/upload-audio
 * @desc Ingest 1 to 5 audio recordings for chat turn grounding
 * @access Protected (Area Supervisor)
 */
router.post('/upload-audio', uploadReportAudiosMiddleware, uploadReportAudios);

/**
 * @route POST /api/v1/chat/upload-attachments
 * @desc Ingest 1 to 5 document / image attachments for chat turn grounding
 * @access Protected (Area Supervisor)
 */
router.post('/upload-attachments', uploadChatAttachmentsMiddleware, uploadChatAttachments);

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
 * @route GET /api/v1/chat/:chatId
 * @desc Retrieve full chat session details and message history
 * @access Protected (Area Supervisor)
 */
router.get('/:chatId', chatIdValidation, validate, getChatById);

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
