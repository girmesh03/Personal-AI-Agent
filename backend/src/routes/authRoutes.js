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
  googleAuthStub,
  connectGoogleDrive,
  handleGoogleCallback,
  disconnectGoogleDriveRoute,
  getGoogleDriveStatus,
  mockConnectGoogleDriveRoute,
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
 * @access Protected or via ?userId query param
 */
router.get('/google/connect', connectGoogleDrive);

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
 * @route POST /api/v1/auth/google/mock-connect
 * @desc Mock connect Google Drive for integration testing
 * @access Protected
 */
router.post('/google/mock-connect', verifyToken, mockConnectGoogleDriveRoute);

/**
 * @route GET /api/v1/auth/google
 * @route POST /api/v1/auth/google
 * @desc Legacy Google authentication placeholder stub.
 * @access Public
 */
router.get('/google', googleAuthStub);
router.post('/google', googleAuthStub);

export default router;
