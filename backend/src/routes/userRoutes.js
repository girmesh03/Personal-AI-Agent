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
} from '../controllers/userController.js';
import {
  updateProfileValidation,
  updateAvatarValidation,
  updatePasswordValidation,
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

export default router;
