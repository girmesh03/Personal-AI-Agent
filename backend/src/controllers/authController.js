/**
 * @module controllers/authController
 * @description Authentication controller managing registration, login, token refresh, logout, and profile retrieval.
 * Enforces single-user operational security (strictly zero role-based logic).
 */

import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { User } from '../models/User.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from '../utils/token.js';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import logger from '../config/logger.js';
import {
  HTTP_STATUS,
  DEFAULT_POSITION,
  USER_NAME_LENGTH,
} from '../utils/constants.js';
import {
  ConflictError,
  UnauthenticatedError,
  BadRequestError,
  NotFoundError,
} from '../errors/CustomError.js';
import {
  getAuthorizationUrl,
  exchangeCodeAndSaveTokens,
  disconnectGoogleDrive,
  connectMockGoogleDrive,
} from '../services/googleDriveService.js';

/**
 * Registers a new user account (Area Supervisor).
 * Auto-derives firstName and lastName from email if not provided (Invariant 6).
 * Executes within a Mongoose transaction session.
 *
 * @function register
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const register = asyncHandler(async (req, res) => {
  const validatedBody = req.validated?.body || req.body || {};
  const { email, password, firstName, lastName, position, avatar } = validatedBody;

  const session = await mongoose.startSession();
  try {
    let userObj;

    await session.withTransaction(async () => {
      // Check if a user with this email already exists
      const existingUser = await User.findOne({ email }).session(session);
      if (existingUser) {
        throw new ConflictError('A user with this email address already exists.');
      }

      // Name Auto-Derivation Invariant (Invariant 6)
      const localPart = email.split('@')[0];
      const derivedName = localPart.length >= USER_NAME_LENGTH.MIN ? localPart : `${localPart}__`;
      const resolvedFirstName = (firstName && firstName.trim()) || derivedName;
      const resolvedLastName = (lastName && lastName.trim()) || derivedName;

      // Create new User document inside the active transaction
      const [user] = await User.create(
        [
          {
            firstName: resolvedFirstName,
            lastName: resolvedLastName,
            email,
            password,
            position: position || DEFAULT_POSITION,
            avatar: avatar || null,
          },
        ],
        { session }
      );

      userObj = user.toJSON();
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'User registered successfully. Please log in.',
      data: {
        user: userObj,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Authenticates user credentials and issues new access/refresh tokens.
 *
 * @function login
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const login = asyncHandler(async (req, res) => {
  const validatedBody = req.validated?.body || req.body || {};
  const { email, password } = validatedBody;

  // Query user with password hash explicitly selected
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new UnauthenticatedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Verify password hash
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    throw new UnauthenticatedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Generate new JWT authentication tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Set secure HttpOnly cookies
  setAuthCookies(res, accessToken, refreshToken);

  const userObj = user.toJSON();

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Login successful',
    data: {
      user: userObj,
    },
  });
});

/**
 * Refreshes the short-lived access token using a valid HttpOnly refresh token.
 * Rotates the refresh token for enhanced session security.
 *
 * @function refreshToken
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const refreshToken = asyncHandler(async (req, res) => {
  let token = req.cookies?.refreshToken;
  if (!token && req.body?.refreshToken) {
    token = req.body.refreshToken;
  }

  if (!token) {
    throw new UnauthenticatedError('Please log in again to continue.', 'NO_REFRESH_TOKEN');
  }

  // verifyRefreshToken throws UnauthenticatedError on invalid or expired token
  const decoded = verifyRefreshToken(token);

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new UnauthenticatedError('User account could not be found. Please log in again.', 'USER_NOT_FOUND');
  }

  // Rotate tokens: issue new access token and fresh refresh token
  const newAccessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  // Set rotated secure cookies
  setAuthCookies(res, newAccessToken, newRefreshToken);

  const userObj = user.toJSON();

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      user: userObj,
    },
  });
});

/**
 * Logs out the authenticated user by invalidating and clearing auth cookies.
 *
 * @function logout
 * @param {import('express').Request} _req - Express request object (unused).
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const logout = asyncHandler(async (_req, res) => {
  clearAuthCookies(res);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Logged out successfully',
    data: null,
  });
});

/**
 * Google OAuth authentication placeholder stub.
 *
 * @function googleAuthStub
 * @param {import('express').Request} _req - Express request object (unused).
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const googleAuthStub = asyncHandler(async (_req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Google authentication service is currently in development. Please use your corporate email credentials.',
    data: {
      provider: 'google',
      status: 'stub',
      available: false,
    },
  });
});

/**
 * Initiates Google OAuth connection flow for Google Drive & Workspace.
 *
 * @route GET /api/v1/auth/google/connect
 */
export const connectGoogleDrive = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.query.userId;
  if (!userId) {
    throw new UnauthenticatedError('User authentication is required to connect Google Drive.');
  }

  // Create signed state parameter
  const state = jwt.sign({ userId: String(userId) }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  const authUrl = getAuthorizationUrl(state);

  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      authUrl,
    });
  }

  res.redirect(authUrl);
});

/**
 * Handles Google OAuth redirect callback.
 *
 * @route GET /api/v1/auth/google/callback
 */
export const handleGoogleCallback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.warn(`[authController] Google OAuth error returned: ${error}`);
    return res.redirect(`${env.CLIENT_ORIGIN}/chat?google_auth=error&error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    throw new BadRequestError('Authorization code and state token are required.');
  }

  let decoded;
  try {
    decoded = jwt.verify(state, env.JWT_ACCESS_SECRET);
  } catch (err) {
    throw new BadRequestError('Invalid or expired OAuth state parameter.');
  }

  const userId = decoded.userId;
  const integrationProfile = await exchangeCodeAndSaveTokens(userId, code);

  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Google Drive connected successfully.',
      data: integrationProfile,
    });
  }

  res.redirect(`${env.CLIENT_ORIGIN}/chat?google_auth=success`);
});

/**
 * Disconnects Google Drive integration for authenticated user.
 *
 * @route POST /api/v1/auth/google/disconnect
 */
export const disconnectGoogleDriveRoute = asyncHandler(async (req, res) => {
  await disconnectGoogleDrive(req.user._id);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Google Drive disconnected successfully.',
  });
});

/**
 * Retrieves Google Drive connection status for authenticated user.
 *
 * @route GET /api/v1/auth/google/status
 */
export const getGoogleDriveStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new NotFoundError('User not found.');

  const drive = user.integrations?.googleDrive || {};
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      connected: Boolean(drive.connected),
      email: drive.email || null,
      rootFolderId: drive.rootFolderId || null,
      connectedAt: drive.connectedAt || null,
    },
  });
});

/**
 * Mock Connect Google Drive for automated integration tests and isolated environments.
 *
 * @route POST /api/v1/auth/google/mock-connect
 */
export const mockConnectGoogleDriveRoute = asyncHandler(async (req, res) => {
  const email = req.body?.email || req.user.email || 'mock-user@gmail.com';
  const profile = await connectMockGoogleDrive(req.user._id, email);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Mock Google Drive connected successfully.',
    data: profile,
  });
});

export default {
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
};
