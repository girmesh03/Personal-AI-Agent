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
  CHAT_CONSTANTS,
  REPORT_CONSTANTS,
  TELEGRAM_CONSTANTS,
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

  // Invariant: strictly zero archivedAt field allowed on User
  body('archivedAt')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('archivedAt field is prohibited on User.');
      }
      return true;
    }),

  // Invariant: strictly zero _id modification allowed on User
  body('_id')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('User identifier cannot be changed.');
      }
      return true;
    }),

  // Invariant: password modification must use dedicated /password endpoint
  body('password')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Password must be updated via the dedicated password endpoint.');
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
    .custom((value, { req }) => {
      if (req.user?.isPasswordSet === false) {
        return true;
      }
      if (!value || typeof value !== 'string' || !value.trim()) {
        throw new Error('Current password is required.');
      }
      return true;
    }),

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

/**
 * Validation rules for user agent configuration updates.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const updateAgentConfigValidation = [
  body('persona')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Persona cannot exceed 2000 characters.'),

  body('defaultModel')
    .optional()
    .isIn(CHAT_CONSTANTS.SUPPORTED_MODELS)
    .withMessage(`Model must be one of: ${CHAT_CONSTANTS.SUPPORTED_MODELS.join(', ')}`),

  body('defaultThinkingBudget')
    .optional()
    .isInt({ min: CHAT_CONSTANTS.MIN_THINKING_BUDGET, max: CHAT_CONSTANTS.MAX_THINKING_BUDGET })
    .withMessage(`Thinking budget must be between ${CHAT_CONSTANTS.MIN_THINKING_BUDGET} and ${CHAT_CONSTANTS.MAX_THINKING_BUDGET}.`),

  body('defaultLanguage')
    .optional()
    .isIn(CHAT_CONSTANTS.SUPPORTED_LANGUAGES)
    .withMessage(`Language must be one of: ${CHAT_CONSTANTS.SUPPORTED_LANGUAGES.join(', ')}`),

  body('sttEngine')
    .optional()
    .isIn(CHAT_CONSTANTS.STT_ENGINES)
    .withMessage(`STT engine must be one of: ${CHAT_CONSTANTS.STT_ENGINES.join(', ')}`),

  body('reportTemplates')
    .optional()
    .isObject()
    .withMessage('Report templates must be an object.'),

  body('reportTemplates.singleBranch')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH })
    .withMessage(`Single branch template cannot exceed ${REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH} characters.`),

  body('reportTemplates.multiBranch')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH })
    .withMessage(`Multi branch template cannot exceed ${REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH} characters.`),

  body('telegram')
    .optional()
    .isObject()
    .withMessage('Telegram settings must be an object.'),

  body('telegram.botToken')
    .optional({ nullable: true })
    .trim()
    .isString()
    .withMessage('Telegram bot token must be a string.'),

  body('telegram.managementChatId')
    .optional({ nullable: true })
    .trim()
    .isString()
    .withMessage('Telegram management chat ID must be a string.'),

  body('telegram.maintenanceChatId')
    .optional({ nullable: true })
    .trim()
    .isString()
    .withMessage('Telegram maintenance chat ID must be a string.'),

  body('telegram.generalChatId')
    .optional({ nullable: true })
    .trim()
    .isString()
    .withMessage('Telegram general chat ID must be a string.'),

  body('telegram.defaultFormat')
    .optional()
    .isIn(TELEGRAM_CONSTANTS.FORMATS)
    .withMessage(`Telegram default format must be one of: ${TELEGRAM_CONSTANTS.FORMATS.join(', ')}.`),
];

/**
 * Validation rules for supervisor directives updates.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const updateDirectivesValidation = [
  body('negativeVocabulary')
    .optional()
    .isArray()
    .withMessage('negativeVocabulary must be an array of strings.'),

  body('negativeVocabulary.*')
    .optional()
    .trim()
    .isString()
    .withMessage('Each negative vocabulary entry must be a string.'),

  body('phraseMappings')
    .optional()
    .isObject()
    .withMessage('phraseMappings must be an object of key-value pairs.'),

  body('customInstructions')
    .optional()
    .custom((val) => {
      if (Array.isArray(val) || typeof val === 'string') return true;
      throw new Error('customInstructions must be an array of strings or a string.');
    }),
];

export default {
  updateProfileValidation,
  updateAvatarValidation,
  updatePasswordValidation,
  updateAgentConfigValidation,
  updateDirectivesValidation,
};

