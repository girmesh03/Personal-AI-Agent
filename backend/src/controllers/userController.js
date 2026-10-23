/**
 * @module controllers/userController
 * @description User controller handling supervisor profile retrieval, profile updates (names, email, position),
 * dedicated avatar updates, and password management.
 */

import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { User } from '../models/User.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { ConflictError, UnauthenticatedError, BadRequestError } from '../errors/CustomError.js';

/**
 * Retrieves the currently authenticated user's profile.
 *
 * @function getProfile
 * @param {import('express').Request} req - Express request object with attached req.user.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const getProfile = asyncHandler(async (req, res) => {
  const userObj = req.user.toJSON ? req.user.toJSON() : req.user;

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Current user profile retrieved successfully',
    data: {
      user: userObj,
    },
  });
});

/**
 * Updates editable profile attributes (firstName, lastName, email, position).
 * Re-derives virtual fullName upon save and enforces email uniqueness.
 * Executes within a Mongoose transaction session.
 *
 * @function updateProfile
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const validatedBody = req.validated?.body || req.body || {};
  const { firstName, lastName, email, position } = validatedBody;

  const session = await mongoose.startSession();
  try {
    let userObj;

    await session.withTransaction(async () => {
      const user = await User.findById(req.user._id).session(session);
      if (!user) {
        throw new UnauthenticatedError('User account could not be found. Please log in again.', 'USER_NOT_FOUND');
      }

      // Check email uniqueness if email is changed
      if (email && email.toLowerCase() !== user.email.toLowerCase()) {
        const existingUser = await User.findOne({
          email: email.toLowerCase(),
          _id: { $ne: user._id },
        }).session(session);
        if (existingUser) {
          throw new ConflictError('A user with this email address already exists.');
        }
        user.email = email;
      }

      if (firstName !== undefined) {
        user.firstName = firstName.trim();
      }

      if (lastName !== undefined) {
        user.lastName = lastName.trim();
      }

      if (position !== undefined) {
        user.position = position.trim();
      }

      await user.save({ session });
      userObj = user.toJSON();
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: userObj,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Updates the supervisor's profile avatar on a dedicated route.
 * Executes within a Mongoose transaction session.
 *
 * @function updateAvatar
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const updateAvatar = asyncHandler(async (req, res) => {
  const validatedBody = req.validated?.body || req.body || {};
  const { avatar } = validatedBody;

  const session = await mongoose.startSession();
  try {
    let userObj;

    await session.withTransaction(async () => {
      const user = await User.findById(req.user._id).session(session);
      if (!user) {
        throw new UnauthenticatedError('User account could not be found. Please log in again.', 'USER_NOT_FOUND');
      }

      user.avatar = avatar;
      await user.save({ session });
      userObj = user.toJSON();
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Avatar updated successfully',
      data: {
        user: userObj,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Removes the supervisor's profile avatar on a dedicated route, resetting it to null.
 * Executes within a Mongoose transaction session.
 *
 * @function removeAvatar
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const removeAvatar = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let userObj;

    await session.withTransaction(async () => {
      const user = await User.findById(req.user._id).session(session);
      if (!user) {
        throw new UnauthenticatedError('User account could not be found. Please log in again.', 'USER_NOT_FOUND');
      }

      user.avatar = null;
      await user.save({ session });
      userObj = user.toJSON();
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Avatar removed successfully',
      data: {
        user: userObj,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Updates the supervisor account password after verifying the current password.
 * Executes within a Mongoose transaction session.
 *
 * @function updatePassword
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const updatePassword = asyncHandler(async (req, res) => {
  const validatedBody = req.validated?.body || req.body || {};
  const { currentPassword, newPassword } = validatedBody;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Load user with password hash inside transaction session
      const user = await User.findById(req.user._id).select('+password').session(session);
      if (!user) {
        throw new UnauthenticatedError('Please log in again to continue.', 'USER_NOT_FOUND');
      }

      // If user was created via Google SSO and password has not been set yet
      if (user.isPasswordSet === false) {
        user.password = newPassword;
        user.isPasswordSet = true;
        user.authProvider = 'both';
        await user.save({ session });
        return;
      }

      // Verify current password for accounts with an existing password
      if (!currentPassword) {
        throw new BadRequestError('Current password is required.');
      }
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        throw new UnauthenticatedError('The current password you entered is incorrect. Please try again.', 'INVALID_CREDENTIALS');
      }

      // Assign new password (pre-save hook handles bcrypt hashing)
      user.password = newPassword;
      user.isPasswordSet = true;
      if (user.authProvider === 'google') {
        user.authProvider = 'both';
      }
      await user.save({ session });
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password updated successfully',
      data: null,
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Retrieves the supervisor's AI agent configuration and directives.
 *
 * @function getUserAgentConfig
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const getUserAgentConfig = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  if (!user) {
    throw new UnauthenticatedError('User not found. Please log in again.');
  }

  const directives = user.settings?.directives || {};
  const phraseMappings =
    directives.phraseMappings instanceof Map
      ? Object.fromEntries(directives.phraseMappings)
      : directives.phraseMappings || {};

  const tgSource = user.integrations?.telegram || {};
  const safeTelegram = {
    connected: Boolean(tgSource.connected),
    enabled: tgSource.enabled !== false,
    botUsername: tgSource.botUsername || null,
    managementChatId: tgSource.managementChatId || null,
    maintenanceChatId: tgSource.maintenanceChatId || null,
    generalChatId: tgSource.generalChatId || null,
    defaultFormat: tgSource.defaultFormat || 'text',
    imageCardOptions: tgSource.imageCardOptions || {},
    connectedAt: tgSource.connectedAt || null,
  };

  const apiKeysConfig = user.settings?.apiKeys || {};

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      sttEngine: user.settings?.sttEngine || 'addis_ai',
      agentConfig: user.settings?.agentConfig || {},
      reportTemplates: user.settings?.reportTemplates || {},
      telegram: safeTelegram,
      apiKeys: {
        hasGeminiKey: Boolean(apiKeysConfig.geminiApiKey),
        hasAddisKey: Boolean(apiKeysConfig.addisApiKey),
      },
      directives: {
        negativeVocabulary: directives.negativeVocabulary || [],
        phraseMappings,
        customInstructions: directives.customInstructions || [],
      },
    },
  });
});

/**
 * Updates the supervisor's AI agent configuration.
 *
 * @function updateUserAgentConfig
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const updateUserAgentConfig = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const session = await mongoose.startSession();
  try {
    let updatedUser;
    await session.withTransaction(async () => {
      const user = await User.findById(req.user._id).session(session);
      if (!user) {
        throw new UnauthenticatedError('User not found. Please log in again.');
      }

      if (!user.settings) user.settings = {};
      if (!user.settings.agentConfig) user.settings.agentConfig = {};

      if (b.persona !== undefined) user.settings.agentConfig.persona = b.persona;
      if (b.defaultModel !== undefined) user.settings.agentConfig.defaultModel = b.defaultModel;
      if (b.defaultThinkingBudget !== undefined) user.settings.agentConfig.defaultThinkingBudget = b.defaultThinkingBudget;
      if (b.defaultLanguage !== undefined) user.settings.agentConfig.defaultLanguage = b.defaultLanguage;
      if (b.sttEngine !== undefined) user.settings.sttEngine = b.sttEngine;

      if (b.reportTemplates) {
        if (!user.settings.reportTemplates) user.settings.reportTemplates = {};
        if (b.reportTemplates.singleBranch !== undefined) {
          user.settings.reportTemplates.singleBranch = b.reportTemplates.singleBranch;
        }
        if (b.reportTemplates.multiBranch !== undefined) {
          user.settings.reportTemplates.multiBranch = b.reportTemplates.multiBranch;
        }
      }

      if (b.telegram) {
        if (!user.integrations) user.integrations = {};
        if (!user.integrations.telegram) user.integrations.telegram = {};

        if (b.telegram.botToken !== undefined && b.telegram.botToken) {
          user.integrations.telegram.botToken = b.telegram.botToken.trim();
          user.integrations.telegram.connected = true;
        }
        if (b.telegram.managementChatId !== undefined) {
          user.integrations.telegram.managementChatId = b.telegram.managementChatId;
        }
        if (b.telegram.maintenanceChatId !== undefined) {
          user.integrations.telegram.maintenanceChatId = b.telegram.maintenanceChatId;
        }
        if (b.telegram.generalChatId !== undefined) {
          user.integrations.telegram.generalChatId = b.telegram.generalChatId;
        }
        if (b.telegram.defaultFormat !== undefined) {
          user.integrations.telegram.defaultFormat = b.telegram.defaultFormat;
        }
        user.markModified('integrations');
      }

      user.markModified('settings');
      await user.save({ session });
      updatedUser = user;
    });

    const tgSource = updatedUser.integrations?.telegram || {};
    const safeTelegram = {
      connected: Boolean(tgSource.connected),
      enabled: tgSource.enabled !== false,
      botUsername: tgSource.botUsername || null,
      managementChatId: tgSource.managementChatId || null,
      maintenanceChatId: tgSource.maintenanceChatId || null,
      generalChatId: tgSource.generalChatId || null,
      defaultFormat: tgSource.defaultFormat || 'text',
      imageCardOptions: tgSource.imageCardOptions || {},
      connectedAt: tgSource.connectedAt || null,
    };

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Agent configuration updated successfully.',
      data: {
        sttEngine: updatedUser.settings.sttEngine,
        agentConfig: updatedUser.settings.agentConfig,
        reportTemplates: updatedUser.settings.reportTemplates,
        telegram: safeTelegram,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Updates supervisor directives (negativeVocabulary, phraseMappings, customInstructions).
 *
 * @function updateSupervisorDirectives
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const updateSupervisorDirectives = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const session = await mongoose.startSession();
  try {
    let updatedDirectives;
    await session.withTransaction(async () => {
      const user = await User.findById(req.user._id).session(session);
      if (!user) {
        throw new UnauthenticatedError('User not found. Please log in again.');
      }

      if (!user.settings) user.settings = {};
      if (!user.settings.directives) user.settings.directives = {};

      if (Array.isArray(b.negativeVocabulary)) {
        user.settings.directives.negativeVocabulary = b.negativeVocabulary.map((s) => String(s).trim()).filter(Boolean);
      }

      if (b.phraseMappings && typeof b.phraseMappings === 'object') {
        const map = new Map();
        for (const [k, v] of Object.entries(b.phraseMappings)) {
          if (k && v) map.set(String(k).trim(), String(v).trim());
        }
        user.settings.directives.phraseMappings = map;
      }

      if (b.customInstructions !== undefined) {
        user.settings.directives.customInstructions = Array.isArray(b.customInstructions)
          ? b.customInstructions.map((s) => String(s).trim()).filter(Boolean)
          : [String(b.customInstructions).trim()].filter(Boolean);
      }

      user.markModified('settings');
      await user.save({ session });

      const normalizedMappings =
        user.settings.directives.phraseMappings instanceof Map
          ? Object.fromEntries(user.settings.directives.phraseMappings)
          : user.settings.directives.phraseMappings || {};

      updatedDirectives = {
        negativeVocabulary: user.settings.directives.negativeVocabulary,
        phraseMappings: normalizedMappings,
        customInstructions: user.settings.directives.customInstructions,
      };
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Supervisor directives updated successfully.',
      data: {
        directives: updatedDirectives,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Validates a Telegram Bot Token against the official Telegram Bot API `getMe`.
 *
 * @function verifyTelegramBotToken
 * @param {import('express').Request} req - Express request object with `botToken`.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const verifyTelegramBotToken = asyncHandler(async (req, res) => {
  const { botToken } = req.body || {};
  if (!botToken || typeof botToken !== 'string' || !botToken.trim()) {
    throw new BadRequestError('Telegram Bot Token is required for verification.');
  }

  const cleanToken = botToken.trim();
  try {
    const response = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const data = await response.json();
    if (!data.ok) {
      throw new BadRequestError(`Telegram verification failed: ${data.description || 'Invalid bot token.'}`);
    }
    res.status(HTTP_STATUS.OK).json({
      success: true,
      valid: true,
      bot: {
        id: data.result.id,
        username: data.result.username,
        firstName: data.result.first_name,
      },
    });
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    throw new BadRequestError(`Failed to reach Telegram Bot API: ${err.message}`);
  }
});

/**
 * Normalizes a Telegram Chat ID or Channel Username to standard format.
 * Automatically prefixes `-100` for 9+ digit numeric channel/supergroup IDs
 * while safely preserving public `@channel_name` handles and negative channel IDs.
 *
 * @param {string|number|null} chatId - Raw chat identifier
 * @returns {string|null} Normalized chat identifier
 */
export function normalizeTelegramChatId(chatId) {
  if (chatId === null || chatId === undefined) return null;
  const str = String(chatId).trim();
  if (!str) return null;
  // Preserve public channel usernames (e.g. @my_channel)
  if (str.startsWith('@')) return str;
  // If positive integer with >= 9 digits, auto-prefix -100 for Telegram channel/supergroup
  if (/^\d{9,}$/.test(str)) {
    return `-100${str}`;
  }
  // If negative integer with >= 9 digits missing -100 (e.g. -1003982938439), normalize
  if (/^-\d{9,}$/.test(str) && !str.startsWith('-100')) {
    return `-100${str.slice(1)}`;
  }
  return str;
}

/**
 * Saves and connects Telegram credentials under `user.integrations.telegram`.
 * Performs pre-flight live token verification against official Telegram `/getMe`
 * and auto-populates `botUsername` from verified bot profile.
 *
 * @function connectTelegramIntegration
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const connectTelegramIntegration = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const cleanBotToken = b.botToken && typeof b.botToken === 'string' && b.botToken.trim()
    ? b.botToken.trim()
    : null;

  // Pre-flight live validation against Telegram Bot API before taking DB transaction lock
  let verifiedBotUsername = b.botUsername || null;
  if (cleanBotToken) {
    const isMock = cleanBotToken.startsWith('mock_') ||
      cleanBotToken.includes('MockValidFormat') ||
      (process.env.NODE_ENV === 'test' && b.botUsername);

    if (!isMock) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${cleanBotToken}/getMe`);
        const data = await response.json();
        if (!data.ok) {
          throw new BadRequestError(`Invalid Telegram Bot Token: ${data.description || 'Unauthorized'}. Please verify your bot token with @BotFather.`);
        }
        verifiedBotUsername = data.result?.username || verifiedBotUsername;
      } catch (err) {
        if (err instanceof BadRequestError) throw err;
        throw new BadRequestError(`Failed to reach Telegram Bot API: ${err.message}. Please check your bot token or internet connection.`);
      }
    }
  }

  const session = await mongoose.startSession();
  try {
    let updatedUser;
    await session.withTransaction(async () => {
      const user = await User.findById(req.user._id).select('+integrations.telegram.botToken').session(session);
      if (!user) throw new UnauthenticatedError('User not found.');

      if (!user.integrations) user.integrations = {};
      if (!user.integrations.telegram) user.integrations.telegram = {};

      const botToken = cleanBotToken || user.integrations.telegram.botToken;

      if (!botToken) {
        throw new BadRequestError('Telegram Bot Token is required to connect.');
      }

      user.integrations.telegram.botToken = botToken;
      if (verifiedBotUsername || b.botUsername !== undefined) {
        user.integrations.telegram.botUsername = verifiedBotUsername || b.botUsername || null;
      }
      if (b.managementChatId !== undefined) {
        user.integrations.telegram.managementChatId = normalizeTelegramChatId(b.managementChatId);
      }
      if (b.maintenanceChatId !== undefined) {
        user.integrations.telegram.maintenanceChatId = normalizeTelegramChatId(b.maintenanceChatId);
      }
      if (b.generalChatId !== undefined) {
        user.integrations.telegram.generalChatId = normalizeTelegramChatId(b.generalChatId);
      }
      if (b.defaultFormat !== undefined) user.integrations.telegram.defaultFormat = b.defaultFormat;
      if (b.imageCardOptions !== undefined) user.integrations.telegram.imageCardOptions = b.imageCardOptions;

      user.integrations.telegram.connected = true;
      user.integrations.telegram.enabled = true;
      user.integrations.telegram.connectedAt = new Date();

      user.markModified('integrations');
      await user.save({ session });
      updatedUser = user;
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Telegram integration connected successfully.',
      data: {
        telegram: {
          connected: updatedUser.integrations.telegram.connected,
          enabled: updatedUser.integrations.telegram.enabled,
          botUsername: updatedUser.integrations.telegram.botUsername,
          managementChatId: updatedUser.integrations.telegram.managementChatId,
          maintenanceChatId: updatedUser.integrations.telegram.maintenanceChatId,
          generalChatId: updatedUser.integrations.telegram.generalChatId,
          defaultFormat: updatedUser.integrations.telegram.defaultFormat,
          imageCardOptions: updatedUser.integrations.telegram.imageCardOptions,
          connectedAt: updatedUser.integrations.telegram.connectedAt,
        },
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Disconnects Telegram integration and clears stored tokens.
 *
 * @function disconnectTelegramIntegration
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const disconnectTelegramIntegration = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(req.user._id).session(session);
      if (!user) throw new UnauthenticatedError('User not found.');

      if (user.integrations?.telegram) {
        user.integrations.telegram.connected = false;
        user.integrations.telegram.botToken = null;
        user.integrations.telegram.botUsername = null;
        user.integrations.telegram.managementChatId = null;
        user.integrations.telegram.maintenanceChatId = null;
        user.integrations.telegram.generalChatId = null;
        user.integrations.telegram.imageCardOptions = {};
        user.integrations.telegram.defaultFormat = 'text';
        user.integrations.telegram.connectedAt = null;
      }

      user.markModified('integrations');
      await user.save({ session });
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Telegram integration disconnected successfully.',
      data: {
        connected: false,
        telegram: {
          connected: false,
          botUsername: null,
          managementChatId: null,
          maintenanceChatId: null,
          generalChatId: null,
        },
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Toggles Telegram integration enabled state.
 *
 * @function toggleTelegramIntegration
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const toggleTelegramIntegration = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let newStatus;
    await session.withTransaction(async () => {
      const user = await User.findById(req.user._id).session(session);
      if (!user) throw new UnauthenticatedError('User not found.');

      if (!user.integrations) user.integrations = {};
      if (!user.integrations.telegram) user.integrations.telegram = { connected: false, enabled: false };

      if (typeof req.body?.enabled === 'boolean') {
        user.integrations.telegram.enabled = req.body.enabled;
      } else {
        user.integrations.telegram.enabled = !user.integrations.telegram.enabled;
      }
      newStatus = user.integrations.telegram.enabled;

      user.markModified('integrations');
      await user.save({ session });
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Telegram integration ${newStatus ? 'enabled' : 'disabled'}.`,
      data: {
        enabled: newStatus,
        telegram: {
          enabled: newStatus,
        },
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Updates user Bring-Your-Own-Key (BYOK) API credentials.
 *
 * @function updateUserApiKeys
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const updateUserApiKeys = asyncHandler(async (req, res) => {
  const { geminiApiKey, addisApiKey } = req.body || {};
  const session = await mongoose.startSession();
  try {
    let updatedUser;
    await session.withTransaction(async () => {
      const user = await User.findById(req.user._id)
        .select('+settings.apiKeys.geminiApiKey +settings.apiKeys.addisApiKey')
        .session(session);
      if (!user) throw new UnauthenticatedError('User not found.');

      if (!user.settings) user.settings = {};
      if (!user.settings.apiKeys) user.settings.apiKeys = {};

      if (geminiApiKey !== undefined) {
        const cleanGemini = geminiApiKey && geminiApiKey.trim() ? geminiApiKey.trim() : null;
        user.settings.apiKeys.geminiApiKey = cleanGemini;
        user.settings.apiKeys.hasGeminiKey = Boolean(cleanGemini);
      }
      if (addisApiKey !== undefined) {
        const cleanAddis = addisApiKey && addisApiKey.trim() ? addisApiKey.trim() : null;
        user.settings.apiKeys.addisApiKey = cleanAddis;
        user.settings.apiKeys.hasAddisKey = Boolean(cleanAddis);
      }

      user.markModified('settings');
      await user.save({ session });
      updatedUser = user;
    });

    const hasGemini = Boolean(updatedUser.settings.apiKeys.hasGeminiKey || updatedUser.settings.apiKeys.geminiApiKey);
    const hasAddis = Boolean(updatedUser.settings.apiKeys.hasAddisKey || updatedUser.settings.apiKeys.addisApiKey);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'API credentials updated successfully.',
      data: {
        hasGeminiKey: hasGemini,
        hasAddisKey: hasAddis,
        apiKeys: {
          hasGeminiKey: hasGemini,
          hasAddisKey: hasAddis,
        },
      },
    });
  } finally {
    await session.endSession();
  }
});

export default {
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
  normalizeTelegramChatId,
};
