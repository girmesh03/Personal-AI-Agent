/**
 * @module controllers/authController
 * @description Authentication controller managing registration, login, token refresh, logout, and profile retrieval.
 * Enforces single-user operational security (strictly zero role-based logic).
 */

import asyncHandler from 'express-async-handler';
import { User } from '../models/User.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from '../utils/token.js';
import {
  HTTP_STATUS,
  DEFAULT_POSITION,
  USER_NAME_LENGTH,
} from '../utils/constants.js';
import {
  ConflictError,
  UnauthenticatedError,
} from '../errors/CustomError.js';

/**
 * Registers a new user account (Area Supervisor).
 * Auto-derives firstName and lastName from email if not provided (Invariant 6).
 *
 * @function register
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const register = asyncHandler(async (req, res) => {
  const validatedBody = req.validated?.body || req.body || {};
  const { email, password, firstName, lastName, position, avatar } = validatedBody;

  // Check if a user with this email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ConflictError('A user with this email address already exists.');
  }

  // Name Auto-Derivation Invariant (Invariant 6)
  const localPart = email.split('@')[0];
  const derivedName = localPart.length >= USER_NAME_LENGTH.MIN ? localPart : `${localPart}__`;
  const resolvedFirstName = (firstName && firstName.trim()) || derivedName;
  const resolvedLastName = (lastName && lastName.trim()) || derivedName;

  // Create new User document
  const user = await User.create({
    firstName: resolvedFirstName,
    lastName: resolvedLastName,
    email,
    password,
    position: position || DEFAULT_POSITION,
    avatar: avatar || null,
  });

  const userObj = user.toJSON();

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: 'User registered successfully. Please log in.',
    data: {
      user: userObj,
    },
  });
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
    throw new UnauthenticatedError('Refresh token required', 'NO_REFRESH_TOKEN');
  }

  // verifyRefreshToken throws UnauthenticatedError on invalid or expired token
  const decoded = verifyRefreshToken(token);

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new UnauthenticatedError('User account not found', 'USER_NOT_FOUND');
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

export default {
  register,
  login,
  refreshToken,
  logout,
};
