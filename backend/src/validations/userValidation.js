/**
 * @module validations/userValidation
 * @description express-validator rule chains for user profile, avatar, and password management endpoints.
 * Enforces single-user invariants (strictly zero role, zero isArchived).
 */

import { body } from 'express-validator';
import {
  USER_NAME_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REGEX,
} from '../utils/constants.js';

/**
 * Validation rules for updating user profile information.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('First name cannot be empty if provided.')
    .isLength({ min: USER_NAME_LENGTH.MIN, max: USER_NAME_LENGTH.MAX })
    .withMessage(`First name must be between ${USER_NAME_LENGTH.MIN} and ${USER_NAME_LENGTH.MAX} characters.`),

  body('lastName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Last name cannot be empty if provided.')
    .isLength({ min: USER_NAME_LENGTH.MIN, max: USER_NAME_LENGTH.MAX })
    .withMessage(`Last name must be between ${USER_NAME_LENGTH.MIN} and ${USER_NAME_LENGTH.MAX} characters.`),

  body('email')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Email address cannot be empty if provided.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false }),

  body('position')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Position cannot be blank if provided.'),

  // Invariant: strictly zero role field allowed on User
  body('role')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Role assignment is strictly prohibited in single-user architecture.');
      }
      return true;
    }),

  // Invariant: strictly zero isArchived field allowed on User
  body('isArchived')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('isArchived field is prohibited on User.');
      }
      return true;
    }),
];

/**
 * Validation rules for updating user avatar.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const updateAvatarValidation = [
  body('avatar')
    .notEmpty()
    .withMessage('Avatar URL or image path is required.')
    .isString()
    .withMessage('Avatar must be a valid string URL or image path.'),
];

/**
 * Validation rules for user password change.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const updatePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required.'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required.')
    .isLength({ min: PASSWORD_MIN_LENGTH })
    .withMessage(`New password must be at least ${PASSWORD_MIN_LENGTH} characters long.`)
    .matches(PASSWORD_REGEX)
    .withMessage('New password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.'),

  body('confirmNewPassword')
    .notEmpty()
    .withMessage('Please confirm your new password.')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('New passwords do not match.');
      }
      return true;
    }),
];

export default {
  updateProfileValidation,
  updateAvatarValidation,
  updatePasswordValidation,
};
