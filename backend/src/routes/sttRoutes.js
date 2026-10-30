/**
 * @module routes/sttRoutes
 * @description Decoupled router for Speech-to-Text (STT) services.
 * Mounted at /api/v1/stt.
 */

import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createScribeSession } from '../controllers/sttController.js';

const router = express.Router();

/**
 * @route POST /api/v1/stt/scribe-session
 * @desc Generate single-use connection ticket for Addis AI Live Scribe WebSocket
 * @access Private
 */
router.post('/scribe-session', protect, createScribeSession);

export default router;
