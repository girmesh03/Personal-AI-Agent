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
} from '../controllers/authController.js';
import {
  registerValidation,
  loginValidation,
} from '../validations/authValidation.js';
import { validate } from '../middleware/validate.js';

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

export default router;
