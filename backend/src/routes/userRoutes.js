/**
 * @module routes/userRoutes
 * @description Express routing definitions for user profile management, avatar updates, and account security.
 */

import express from 'express';
import {
  getProfile,
  updateProfile,
  updateAvatar,
  removeAvatar,
  updatePassword,
  getUserAgentConfig,
  updateUserAgentConfig,
  updateSupervisorDirectives,
  verifyTelegramBotToken,
  connectTelegramIntegration,
  disconnectTelegramIntegration,
  toggleTelegramIntegration,
  updateUserApiKeys,
} from '../controllers/userController.js';
import {
  updateProfileValidation,
  updateAvatarValidation,
  updatePasswordValidation,
  updateAgentConfigValidation,
  updateDirectivesValidation,
} from '../validations/userValidation.js';
import { validate } from '../middleware/validate.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce authentication across all user domain endpoints
router.use(verifyToken);

/**
 * @route GET /api/v1/users/profile, GET /api/v1/users/me
 * @desc Retrieve current authenticated supervisor profile.
 * @access Private
 */
router.get(['/profile', '/me'], getProfile);

/**
 * @route PATCH /api/v1/users/profile
 * @desc Update supervisor profile attributes (names, email, position).
 * @access Private
 */
router.patch('/profile', updateProfileValidation, validate, updateProfile);

/**
 * @route PATCH /api/v1/users/avatar
 * @desc Update supervisor profile avatar image URL or path.
 * @access Private
 */
router.patch('/avatar', updateAvatarValidation, validate, updateAvatar);

/**
 * @route DELETE /api/v1/users/avatar
 * @desc Remove supervisor profile avatar (resets to null).
 * @access Private
 */
router.delete('/avatar', removeAvatar);

/**
 * @route PATCH /api/v1/users/password
 * @desc Change supervisor password after validating current password.
 * @access Private
 */
router.patch('/password', updatePasswordValidation, validate, updatePassword);

/**
 * @route GET /api/v1/users/agent-config
 * @desc Retrieve current supervisor agent settings & directives.
 * @access Private
 */
router.get('/agent-config', getUserAgentConfig);

/**
 * @route PATCH /api/v1/users/agent-config
 * @desc Update supervisor agent settings (persona, model, thinkingBudget, etc.).
 * @access Private
 */
router.patch('/agent-config', updateAgentConfigValidation, validate, updateUserAgentConfig);

/**
 * @route PATCH /api/v1/users/directives
 * @desc Update supervisor directives (negativeVocabulary, phraseMappings, customInstructions).
 * @access Private
 */
router.patch('/directives', updateDirectivesValidation, validate, updateSupervisorDirectives);

/**
 * @route POST /api/v1/users/telegram/verify
 * @desc Verify Telegram Bot Token against Telegram getMe API.
 * @access Private
 */
router.post('/telegram/verify', verifyTelegramBotToken);

/**
 * @route PATCH /api/v1/users/telegram/connect
 * @desc Connect and save Telegram integration credentials.
 * @access Private
 */
router.patch('/telegram/connect', connectTelegramIntegration);

/**
 * @route POST /api/v1/users/telegram/disconnect
 * @desc Disconnect Telegram integration and clear bot token.
 * @access Private
 */
router.post('/telegram/disconnect', disconnectTelegramIntegration);

/**
 * @route PATCH /api/v1/users/telegram/toggle
 * @desc Toggle Telegram integration enabled/disabled state.
 * @access Private
 */
router.patch('/telegram/toggle', toggleTelegramIntegration);

/**
 * @route PATCH /api/v1/users/api-keys
 * @desc Update user custom Bring-Your-Own-Key (BYOK) API credentials.
 * @access Private
 */
router.patch('/api-keys', updateUserApiKeys);

export default router;
