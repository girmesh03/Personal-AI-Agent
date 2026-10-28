/**
 * @module controllers/authController
 * @description Authentication controller managing registration, login, token refresh, logout, and profile retrieval.
 * Enforces single-user operational security (strictly zero role-based logic).
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import { google } from 'googleapis';
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
} from '../services/googleDriveService.js';

/**
 * Intelligently derives human-readable first and last names from an email address
 * when not explicitly provided by the user or identity provider.
 *
 * @param {string} email - User email address
 * @returns {{ firstName: string, lastName: string }}
 */
export function deriveNamesFromEmail(email = '') {
  if (!email || typeof email !== 'string') {
    return { firstName: 'User', lastName: 'Member' };
  }

  const localPart = email.split('@')[0] || '';
  const rawParts = localPart.split(/[._\-+]+/).filter(Boolean);
  const alphaParts = rawParts.filter((p) => /[a-zA-Z]/.test(p));
  const candidateParts = alphaParts.length > 0 ? alphaParts : rawParts;

  const formatWord = (str) => {
    const clean = str.replace(/[^a-zA-Z]/g, '');
    const target = clean.length >= USER_NAME_LENGTH.MIN ? clean : str;
    const capped = target.charAt(0).toUpperCase() + target.slice(1).toLowerCase();
    return capped.slice(0, USER_NAME_LENGTH.MAX);
  };

  let first = 'User';
  let last = 'Member';

  if (candidateParts.length >= 2) {
    first = formatWord(candidateParts[0]);
    last = formatWord(candidateParts[1]);
  } else if (candidateParts.length === 1) {
    first = formatWord(candidateParts[0]);
    last = 'User';
  }

  if (first.length < USER_NAME_LENGTH.MIN) first = (first + '__').slice(0, USER_NAME_LENGTH.MAX);
  if (last.length < USER_NAME_LENGTH.MIN) last = (last + '__').slice(0, USER_NAME_LENGTH.MAX);

  return { firstName: first, lastName: last };
}

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
        if (existingUser.authProvider === 'google' && !existingUser.isPasswordSet) {
          throw new ConflictError('This email is already registered via Google Sign-In. Please sign in with Google or sign in to set a password in your Profile.');
        }
        throw new ConflictError('A user with this email address already exists. Please sign in instead.');
      }

      // Name Auto-Derivation Invariant (Invariant 6): Extract clean human names if omitted
      const derivedNames = deriveNamesFromEmail(email);
      const resolvedFirstName = (firstName && firstName.trim()) || derivedNames.firstName;
      const resolvedLastName = (lastName && lastName.trim()) || derivedNames.lastName;

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

  // If user was registered via Google SSO and has not yet set an email/password
  if (user.isPasswordSet === false && user.authProvider === 'google') {
    return res.status(HTTP_STATUS.UNAUTHENTICATED).json({
      success: false,
      errorCode: 'SSO_PASSWORD_NOT_SET',
      message: "This account was registered using Google Sign-In and does not have an email password yet. Please click 'Continue with Google' to sign in, or set a password in your Profile.",
      data: {
        authProvider: 'google',
      },
    });
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
 * Resolves the Google SSO OAuth redirect URI.
 * Favors specific SSO override, then matches incoming /sso/callback path,
 * falling back to OAUTH_GOOGLE_CALLBACK_URL or /api/v1/auth/google/callback.
 *
 * @param {import('express').Request} [req]
 * @returns {string}
 */
export const getGoogleSsoCallbackUrl = (req) => {
  if (env.OAUTH_GOOGLE_SSO_CALLBACK_URL) {
    return env.OAUTH_GOOGLE_SSO_CALLBACK_URL;
  }
  if (req?.originalUrl?.includes('/sso/callback') || req?.path?.includes('/sso/callback')) {
    return `${env.API_BASE_URL || `http://localhost:${env.PORT || 4000}`}/api/v1/auth/google/sso/callback`;
  }
  return (
    env.OAUTH_GOOGLE_CALLBACK_URL ||
    env.GOOGLE_CALLBACK_URL ||
    `${env.API_BASE_URL || `http://localhost:${env.PORT || 4000}`}/api/v1/auth/google/callback`
  );
};

/**
 * Initiates Google Single Sign-On (SSO) login/registration.
 *
 * @route GET /api/v1/auth/google/sso, GET /api/v1/auth/google
 */
export const initiateGoogleSso = asyncHandler(async (req, res) => {
  if (!env.OAUTH_GOOGLE_CLIENT_ID || !env.OAUTH_GOOGLE_CLIENT_SECRET) {
    if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
      return res.status(HTTP_STATUS.OK).json({
        success: false,
        message: 'Google OAuth is not configured on this server.',
        data: { provider: 'google', configured: false },
      });
    }
    const clientUrl = env.CLIENT_ORIGIN || 'http://localhost:3000';
    return res.redirect(`${clientUrl}/login?error=GOOGLE_SSO_NOT_CONFIGURED`);
  }

  const callbackUrl = getGoogleSsoCallbackUrl(req);
  const oauth2Client = new google.auth.OAuth2(
    env.OAUTH_GOOGLE_CLIENT_ID,
    env.OAUTH_GOOGLE_CLIENT_SECRET,
    callbackUrl
  );

  const stateToken = jwt.sign({ flow: 'sso' }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state: stateToken,
  });

  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    return res.status(HTTP_STATUS.OK).json({ success: true, url: authUrl });
  }

  res.redirect(authUrl);
});

/**
 * Handles Google SSO OAuth redirect callback, auto-provisioning new users or logging in existing ones.
 *
 * @route GET /api/v1/auth/google/sso/callback
 */
export const handleGoogleSsoCallback = asyncHandler(async (req, res) => {
  const { code, error } = req.query;
  const clientUrl = env.CLIENT_ORIGIN || 'http://localhost:3000';

  if (error || !code) {
    logger.warn(`[authController] Google SSO aborted or error: ${error}`);
    return res.redirect(`${clientUrl}/login?error=${encodeURIComponent(error || 'GOOGLE_AUTH_CANCELLED')}`);
  }

  try {
    const callbackUrl = getGoogleSsoCallbackUrl(req);
    const oauth2Client = new google.auth.OAuth2(
      env.OAUTH_GOOGLE_CLIENT_ID,
      env.OAUTH_GOOGLE_CLIENT_SECRET,
      callbackUrl
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      throw new BadRequestError('Could not retrieve email from Google profile.');
    }

    const email = profile.email.toLowerCase().trim();
    let user = await User.findOne({ email });

    if (!user) {
      // Auto-provision fresh user with Google credentials or smart derivation
      const fallbackNames = deriveNamesFromEmail(email);
      const givenName = profile.given_name || (profile.name ? profile.name.split(' ')[0] : fallbackNames.firstName);
      const familyName = profile.family_name || (profile.name && profile.name.split(' ').length > 1 ? profile.name.split(' ').slice(1).join(' ') : fallbackNames.lastName);
      const randomPassword = crypto.randomBytes(24).toString('hex') + 'A1!';

      user = await User.create({
        email,
        firstName: givenName,
        lastName: familyName || fallbackNames.lastName,
        avatar: profile.picture || null,
        password: randomPassword,
        position: DEFAULT_POSITION,
        authProvider: 'google',
        isPasswordSet: false,
      });

      logger.info(`[authController] New user auto-provisioned via Google SSO: ${email}`);
    } else {
      if (user.authProvider === 'local') {
        user.authProvider = 'both';
      }
      // Update avatar if not previously set
      if (!user.avatar && profile.picture) {
        user.avatar = profile.picture;
      }
      await user.save();
    }

    // Generate tokens and issue HttpOnly cookies
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    setAuthCookies(res, accessToken, refreshToken);

    logger.info(`[authController] User successfully authenticated via Google SSO: ${email}`);
    res.redirect(`${clientUrl}/dashboard?auth=sso`);
  } catch (err) {
    logger.error(`[authController] Google SSO callback error: ${err.message}`);
    res.redirect(`${clientUrl}/login?error=${encodeURIComponent(err.message || 'GOOGLE_SSO_FAILED')}`);
  }
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

  // Create signed state parameter with dynamic returnUrl
  const returnUrl = req.query.returnUrl || '/profile?tab=cloud-integrations';
  const state = jwt.sign({ userId: String(userId), returnUrl }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  const authUrl = getAuthorizationUrl(state);

  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        authUrl,
        url: authUrl,
      },
      authUrl,
    });
  }

  res.redirect(authUrl);
});

/**
 * Handles Google OAuth redirect callback.
 * Acts as an intelligent unified state dispatcher:
 * - If state payload represents Google SSO flow ({ flow: 'sso' }), delegates to handleGoogleSsoCallback.
 * - Otherwise processes Google Drive integration token exchange.
 *
 * @route GET /api/v1/auth/google/callback
 */
export const handleGoogleCallback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  let decoded;
  if (state) {
    try {
      decoded = jwt.verify(state, env.JWT_ACCESS_SECRET);
    } catch (_err) {
      try {
        decoded = JSON.parse(state);
      } catch {
        if (state === 'sso') decoded = { flow: 'sso' };
      }
    }
  }

  // Unified Dispatcher: If state marks SSO authentication, delegate to handleGoogleSsoCallback
  if (state === 'sso' || decoded?.flow === 'sso') {
    return handleGoogleSsoCallback(req, res);
  }

  const dest = decoded?.returnUrl || '/profile?tab=cloud-integrations';

  if (error) {
    logger.warn(`[authController] Google OAuth error returned: ${error}`);
    return res.redirect(
      `${env.CLIENT_ORIGIN}${dest}${dest.includes('?') ? '&' : '?'}google_auth=error&error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state || !decoded || !decoded.userId) {
    throw new BadRequestError('Invalid or expired OAuth authorization code or state token.');
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

  res.redirect(`${env.CLIENT_ORIGIN}${dest}${dest.includes('?') ? '&' : '?'}google_auth=success`);
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
      enabled: drive.enabled !== false,
      email: drive.email || null,
      rootFolderId: drive.rootFolderId || null,
      connectedAt: drive.connectedAt || null,
    },
  });
});

/**
 * Toggles Google Drive integration enabled state for authenticated user.
 *
 * @route POST /api/v1/auth/google/toggle
 */
export const toggleGoogleDriveRoute = asyncHandler(async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    throw new BadRequestError('Field "enabled" must be a boolean.');
  }

  const user = await User.findById(req.user._id);
  if (!user) throw new NotFoundError('User not found.');

  if (!user.integrations?.googleDrive?.connected) {
    throw new BadRequestError('Google Drive is not connected. Please connect your Google account first.');
  }

  user.integrations.googleDrive.enabled = enabled;
  await user.save();

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: `Google Drive integration ${enabled ? 'enabled' : 'disabled'} successfully.`,
    data: {
      connected: user.integrations.googleDrive.connected,
      enabled: user.integrations.googleDrive.enabled,
    },
  });
});

export default {
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
};
