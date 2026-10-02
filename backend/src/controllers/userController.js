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

export default {
  getProfile,
  updateProfile,
  updateAvatar,
  removeAvatar,
  updatePassword,
};
