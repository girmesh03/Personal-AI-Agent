/**
 * @module validations/authValidation
 * @description express-validator rule chains for authentication endpoints (register, login).
 * Enforces single-user constraints (strictly zero role, zero remember-me).
 */

import { body } from 'express-validator';
import {
  USER_NAME_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REGEX,
} from '../utils/constants.js';

/**
 * Validation rules for user registration.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const registerValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: USER_NAME_LENGTH.MIN, max: USER_NAME_LENGTH.MAX })
    .withMessage(`First name must be between ${USER_NAME_LENGTH.MIN} and ${USER_NAME_LENGTH.MAX} characters.`),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: USER_NAME_LENGTH.MIN, max: USER_NAME_LENGTH.MAX })
    .withMessage(`Last name must be between ${USER_NAME_LENGTH.MIN} and ${USER_NAME_LENGTH.MAX} characters.`),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false }),

  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .isLength({ min: PASSWORD_MIN_LENGTH })
    .withMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`)
    .matches(PASSWORD_REGEX)
    .withMessage('Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.'),

  body('confirmPassword')
    .optional()
    .custom((value, { req }) => {
      if (req.body.password && value !== req.body.password) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),

  body('position')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Position cannot be blank if provided.'),

  body('avatar')
    .optional({ nullable: true })
    .isString()
    .withMessage('Avatar must be a valid string URL or path.'),

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
 * Validation rules for user authentication / login.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false }),

  body('password')
    .notEmpty()
    .withMessage('Password is required.'),

  // Invariant: strictly zero remember-me logic or flags
  body('rememberMe')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Remember me option is unsupported.');
      }
      return true;
    }),

  body('remember')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Remember option is unsupported.');
      }
      return true;
    }),
];
