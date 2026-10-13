/**
 * @module controllers/userController
 * @description User controller handling supervisor profile retrieval, profile updates (names, email, position),
 * dedicated avatar updates, and password management.
 */

import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { User } from '../models/User.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { ConflictError, UnauthenticatedError } from '../errors/CustomError.js';

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

      // Verify current password
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        throw new UnauthenticatedError('The current password you entered is incorrect. Please try again.', 'INVALID_CREDENTIALS');
      }

      // Assign new password (pre-save hook handles bcrypt hashing)
      user.password = newPassword;
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

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      sttEngine: user.settings?.sttEngine || 'addis_ai',
      agentConfig: user.settings?.agentConfig || {},
      reportTemplates: user.settings?.reportTemplates || {},
      telegram: user.settings?.telegram || {
        botToken: null,
        managementChatId: null,
        maintenanceChatId: null,
        generalChatId: null,
        defaultFormat: 'text',
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
        if (!user.settings.telegram) user.settings.telegram = {};
        if (b.telegram.botToken !== undefined) {
          user.settings.telegram.botToken = b.telegram.botToken;
        }
        if (b.telegram.managementChatId !== undefined) {
          user.settings.telegram.managementChatId = b.telegram.managementChatId;
        }
        if (b.telegram.maintenanceChatId !== undefined) {
          user.settings.telegram.maintenanceChatId = b.telegram.maintenanceChatId;
        }
        if (b.telegram.generalChatId !== undefined) {
          user.settings.telegram.generalChatId = b.telegram.generalChatId;
        }
        if (b.telegram.defaultFormat !== undefined) {
          user.settings.telegram.defaultFormat = b.telegram.defaultFormat;
        }
      }

      user.markModified('settings');
      await user.save({ session });
      updatedUser = user;
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Agent configuration updated successfully.',
      data: {
        sttEngine: updatedUser.settings.sttEngine,
        agentConfig: updatedUser.settings.agentConfig,
        reportTemplates: updatedUser.settings.reportTemplates,
        telegram: updatedUser.settings.telegram,
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

export default {
  getProfile,
  updateProfile,
  updateAvatar,
  removeAvatar,
  updatePassword,
  getUserAgentConfig,
  updateUserAgentConfig,
  updateSupervisorDirectives,
};
