/**
 * @module routes/authRoutes
 * @description Express routing definitions for authentication endpoints (register, login, refresh, logout).
 */

import express from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  initiateGoogleSso,
  handleGoogleSsoCallback,
  connectGoogleDrive,
  handleGoogleCallback,
  disconnectGoogleDriveRoute,
  getGoogleDriveStatus,
  toggleGoogleDriveRoute,
} from '../controllers/authController.js';
import {
  registerValidation,
  loginValidation,
} from '../validations/authValidation.js';
import { validate } from '../middleware/validate.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new Area Supervisor user account.
 * @access Public
 */
router.post('/register', registerValidation, validate, register);

/**
 * @route POST /api/v1/auth/login
 * @desc Authenticate user credentials and issue session tokens.
 * @access Public
 */
router.post('/login', loginValidation, validate, login);

/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh short-lived access token using long-lived refresh token.
 * @access Public (Requires valid refresh token cookie)
 */
router.post('/refresh', refreshToken);

/**
 * @route POST /api/v1/auth/logout
 * @desc Invalidate session and clear authentication cookies.
 * @access Public
 */
router.post('/logout', logout);

/**
 * @route GET /api/v1/auth/google/connect
 * @desc Initiate Google OAuth connection
 * @access Protected
 */
router.get('/google/connect', verifyToken, connectGoogleDrive);

/**
 * @route GET /api/v1/auth/google/callback
 * @desc OAuth redirect callback
 * @access Public
 */
router.get('/google/callback', handleGoogleCallback);

/**
 * @route POST /api/v1/auth/google/disconnect
 * @desc Disconnect Google Drive integration
 * @access Protected
 */
router.post('/google/disconnect', verifyToken, disconnectGoogleDriveRoute);

/**
 * @route GET /api/v1/auth/google/status
 * @desc Check Google Drive integration connection status
 * @access Protected
 */
router.get('/google/status', verifyToken, getGoogleDriveStatus);

/**
 * @route POST /api/v1/auth/google/toggle
 * @desc Enable or disable Google Drive integration without disconnecting
 * @access Protected
 */
router.post('/google/toggle', verifyToken, toggleGoogleDriveRoute);

/**
 * @route GET /api/v1/auth/google/sso
 * @desc Initiate Google Single Sign-On (SSO) login/register flow.
 * @access Public
 */
router.get('/google/sso', initiateGoogleSso);

/**
 * @route GET /api/v1/auth/google/sso/callback
 * @desc Google Single Sign-On (SSO) OAuth callback.
 * @access Public
 */
router.get('/google/sso/callback', handleGoogleSsoCallback);

export default router;
