/**
 * @module controllers/sttController
 * @description Controller for decoupled, reusable Speech-to-Text (STT) services.
 * Integrates Addis AI Scribe Live Streaming WebSocket session provisioning.
 * Agnostic of chat, reports, or domain models - usable across the entire enterprise application.
 */

import { randomUUID } from 'node:crypto';
import asyncHandler from 'express-async-handler';
import logger from '../config/logger.js';
import env from '../config/env.js';
import { User } from '../models/User.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { BadRequestError } from '../errors/CustomError.js';

/**
 * Creates a single-use session ticket and retrieves WebSocket URL for Addis AI Scribe Live STT.
 *
 * @function createScribeSession
 * @route POST /api/v1/stt/scribe-session
 * @access Private (Authenticated User)
 */
export const createScribeSession = asyncHandler(async (req, res) => {
  let userAddisKey = req.user?.settings?.apiKeys?.addisApiKey;
  if (!userAddisKey && req.user?._id) {
    const userWithKeys = await User.findById(req.user._id)
      .select('+settings.apiKeys.addisApiKey')
      .lean();
    if (userWithKeys?.settings?.apiKeys?.addisApiKey) {
      userAddisKey = userWithKeys.settings.apiKeys.addisApiKey;
    }
  }

  if (userAddisKey === 'missing' || userAddisKey === 'none') {
    throw new BadRequestError(
      'Addis AI API key is not configured. Please add your key under Profile > AI Agent Settings.'
    );
  }

  const effectiveKey = userAddisKey || env.ADDIS_API_KEY || process.env.ADDIS_API_KEY;
  if (!effectiveKey) {
    throw new BadRequestError(
      'Addis AI API key is not configured. Please add your key under Profile > AI Agent Settings.'
    );
  }

  // Testing & mock fallback support for CI/CD environments
  if (effectiveKey === 'mock_addis_key_for_testing' || effectiveKey.startsWith('mock_')) {
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        ticket: `mock_ticket_${Date.now()}`,
        token: `mock_ticket_${Date.now()}`,
        websocketUrl: 'wss://api.addisassistant.com/api/v1/scribe/stream',
        sessionId: `mock_sess_${Date.now()}`,
        expiresIn: 60,
      },
    });
  }

  try {
    const endpoint = 'https://api.addisassistant.com/api/v1/scribe/sessions';
    const requestId = randomUUID();

    const upstreamRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': effectiveKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        backend: req.body?.backend || 'turbo',
        chunk: req.body?.chunk || '320ms',
        request_id: requestId,
        language: req.body?.language || 'am',
      }),
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => '');
      logger.warn(`[sttController] Addis AI Scribe session rejected (${upstreamRes.status}): ${errText}`);
      throw new BadRequestError(`Addis AI Scribe session rejected (${upstreamRes.status}): ${errText || 'Invalid request'}`);
    }

    const json = await upstreamRes.json();
    const data = json?.data || json;

    const token = data.token || data.ticket;
    if (!token) {
      throw new BadRequestError('Addis AI Scribe session response did not include a valid connection token.');
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        ticket: token,
        token: token,
        websocketUrl:
          data.websocket_url ||
          data.websocketUrl ||
          'wss://api.addisassistant.com/api/v1/scribe/stream',
        sessionId: data.session_id || data.sessionId || requestId,
        expiresIn: data.expires_in || 60,
      },
    });
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    logger.error(`[sttController] Addis AI Scribe connection error: ${err.message}`);
    throw new BadRequestError(`Addis AI Scribe connection error: ${err.message}`);
  }
});

export default {
  createScribeSession,
};
