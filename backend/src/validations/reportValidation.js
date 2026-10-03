/**
 * @module validations/reportValidation
 * @description express-validator rule chains for operational report queries, manual edits, and structured report creation payloads.
 * Enforces corporate schema boundaries, single-user tenancy, JDN calendar date limits, time formats, and strict rejection of forbidden fields.
 */

import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';
import { REPORT_CONSTANTS } from '../utils/constants.js';

/**
 * Validates whether an incoming value is a valid 24-character hexadecimal MongoDB ObjectId.
 * Enforces canonical Mongoose ObjectId instantiation and string round-trip equivalence.
 * @function isValidObjectId
 * @param {string} value - Candidate identifier string.
 * @returns {boolean} True if strictly valid MongoDB ObjectId.
 */
const isValidObjectId = (value) =>
  typeof value === 'string' &&
  mongoose.Types.ObjectId.isValid(value) &&
  String(new mongoose.Types.ObjectId(value)) === value;

/**
 * Validation rules for single-report route parameter.
 * Verifies that :reportId is a valid 24-character hexadecimal MongoDB ObjectId.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const reportIdValidation = [
  param('reportId')
    .trim()
    .notEmpty()
    .withMessage('Report ID parameter is required.')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Valid report ID is required.');
      }
      return true;
    }),
];

/**
 * Validation rules for listing/querying operational reports.
 * Supports pagination, date range filtering, branch filtering, archived toggle, and search.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const getReportsValidation = [
  query('page')
    .optional()
    .isInt({ min: REPORT_CONSTANTS.PAGE_LIMIT_MIN })
    .withMessage('Page number must be a positive integer.')
    .toInt(),

  query('limit')
    .optional()
    .isInt({
      min: REPORT_CONSTANTS.PAGE_LIMIT_MIN,
      max: REPORT_CONSTANTS.PAGE_LIMIT_MAX,
    })
    .withMessage(
      `Page limit must be between ${REPORT_CONSTANTS.PAGE_LIMIT_MIN} and ${REPORT_CONSTANTS.PAGE_LIMIT_MAX}.`
    )
    .toInt(),

  query('archived')
    .optional()
    .customSanitizer((val) => {
      if (val === '' || val === 'true' || val === true || val === '1') return true;
      if (val === 'false' || val === false || val === '0') return false;
      return val;
    })
    .isBoolean()
    .withMessage('archived filter must be a valid boolean flag.'),

  query('isArchived')
    .optional()
    .customSanitizer((val) => {
      if (val === '' || val === 'true' || val === true || val === '1') return true;
      if (val === 'false' || val === false || val === '0') return false;
      return val;
    })
    .isBoolean()
    .withMessage('isArchived filter must be a valid boolean.'),

  query('date')
    .optional()
    .isISO8601()
    .withMessage('Date filter must be a valid ISO 8601 date string.'),

  query('branch')
    .optional()
    .trim()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Branch filter must be a valid branch ID.');
      }
      return true;
    }),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query cannot exceed 100 characters.'),
];

/**
 * Validation rules for manual updates to an existing operational report (e.g. via /reports/:reportId/edit).
 * Enforces partial update validation and strictly rejects immutable or prohibited field modifications.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const updateReportValidation = [
  param('reportId')
    .trim()
    .notEmpty()
    .withMessage('Report ID parameter is required.')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Valid report ID is required.');
      }
      return true;
    }),

  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date string.')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      // Allow up to 24-hour buffer to accommodate global supervisor timezones (up to UTC+14)
      const maxAllowed = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (date > maxAllowed) {
        throw new Error('Inspection date cannot be in the future.');
      }
      return true;
    }),

  body('clockIn')
    .optional()
    .trim()
    .matches(REPORT_CONSTANTS.TIME_REGEX)
    .withMessage('Clock-in time must be in HH:mm format (00:00 to 23:59).'),

  body('clockOut')
    .optional()
    .trim()
    .matches(REPORT_CONSTANTS.TIME_REGEX)
    .withMessage('Clock-out time must be in HH:mm format (00:00 to 23:59).'),

  body('visits')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Visits must be an array containing at least one visit.'),

  body('visits.*.branch')
    .if(body('visits').isArray({ min: 1 }))
    .trim()
    .notEmpty()
    .withMessage('Each visit must specify a valid branch ID.')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Each visit must specify a valid branch ID.');
      }
      return true;
    }),

  body('visits.*.clockIn')
    .if(body('visits').isArray({ min: 1 }))
    .trim()
    .notEmpty()
    .withMessage('Visit clock-in time is required.')
    .matches(REPORT_CONSTANTS.TIME_REGEX)
    .withMessage('Visit clock-in time must be in HH:mm format (00:00 to 23:59).'),

  body('visits.*.clockOut')
    .if(body('visits').isArray({ min: 1 }))
    .trim()
    .notEmpty()
    .withMessage('Visit clock-out time is required.')
    .matches(REPORT_CONSTANTS.TIME_REGEX)
    .withMessage('Visit clock-out time must be in HH:mm format (00:00 to 23:59).'),

  body('activities')
    .optional()
    .isArray()
    .withMessage('Activities must be an array.'),

  body('activities.*.text')
    .if(body('activities').isArray({ min: 1 }))
    .trim()
    .notEmpty()
    .withMessage('Activity description text is required.')
    .isLength({ max: REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH })
    .withMessage(
      `Activity text cannot exceed ${REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH} characters.`
    ),

  body('activities.*.status')
    .if(body('activities').isArray({ min: 1 }))
    .optional()
    .isIn(REPORT_CONSTANTS.ACTIVITY_STATUSES)
    .withMessage(
      `Activity status must be one of: ${REPORT_CONSTANTS.ACTIVITY_STATUSES.join(', ')}.`
    ),

  body('issues')
    .optional()
    .isArray()
    .withMessage('Issues must be an array.'),

  body('issues.*.text')
    .if(body('issues').isArray({ min: 1 }))
    .trim()
    .notEmpty()
    .withMessage('Issue description text is required.')
    .isLength({ max: REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH })
    .withMessage(
      `Issue text cannot exceed ${REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH} characters.`
    ),

  body('issues.*.status')
    .if(body('issues').isArray({ min: 1 }))
    .optional()
    .isIn(REPORT_CONSTANTS.ISSUE_STATUSES)
    .withMessage(
      `Issue status must be one of: ${REPORT_CONSTANTS.ISSUE_STATUSES.join(', ')}.`
    ),

  body('comments')
    .optional()
    .isArray()
    .withMessage('Comments must be an array.'),

  body('comments.*.text')
    .if(body('comments').isArray({ min: 1 }))
    .trim()
    .notEmpty()
    .withMessage('Comment text is required.')
    .isLength({ max: REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH })
    .withMessage(
      `Comment text cannot exceed ${REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH} characters.`
    ),

  // Security Invariants: strictly reject immutable and prohibited field modifications
  body('user').custom((value) => {
    if (value !== undefined) {
      throw new Error('Report ownership cannot be altered.');
    }
    return true;
  }),

  body('_id').custom((value) => {
    if (value !== undefined) {
      throw new Error('Report identifier cannot be specified.');
    }
    return true;
  }),

  body('transcription').custom((value) => {
    if (value !== undefined) {
      throw new Error('Original speech transcription is immutable.');
    }
    return true;
  }),

  body('audios').custom((value) => {
    if (value !== undefined) {
      throw new Error('Report audio recordings cannot be modified via update.');
    }
    return true;
  }),

  body('isArchived').custom((value) => {
    if (value !== undefined) {
      throw new Error('isArchived cannot be assigned directly. Use dedicated archive/restore endpoints.');
    }
    return true;
  }),

  body('archivedAt').custom((value) => {
    if (value !== undefined) {
      throw new Error('archivedAt cannot be modified directly.');
    }
    return true;
  }),

  body('status').custom((value) => {
    if (value !== undefined) {
      throw new Error('Report does not declare a status field.');
    }
    return true;
  }),

  body('templateType').custom((value) => {
    if (value !== undefined) {
      throw new Error('Report templateType is derived dynamically and cannot be manually set.');
    }
    return true;
  }),

  body('issues.*.category').custom((value) => {
    if (value !== undefined) {
      throw new Error('Issue category is prohibited.');
    }
    return true;
  }),

  body('issues.*.severity').custom((value) => {
    if (value !== undefined) {
      throw new Error('Issue severity is prohibited.');
    }
    return true;
  }),

  body('comments.*.status').custom((value) => {
    if (value !== undefined) {
      throw new Error('Comments do not declare a status field.');
    }
    return true;
  }),
];

/**
 * Validation rules for structured operational report creation payloads.
 * Used by backend creation tools and automated domain test suites.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export const createReportValidation = [
  body('date')
    .notEmpty()
    .withMessage('Inspection date is required.')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date string.')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      // Allow up to 24-hour buffer to accommodate global supervisor timezones (up to UTC+14)
      const maxAllowed = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (date > maxAllowed) {
        throw new Error('Inspection date cannot be in the future.');
      }
      return true;
    }),

  body('clockIn')
    .trim()
    .notEmpty()
    .withMessage('Clock-in time is required.')
    .matches(REPORT_CONSTANTS.TIME_REGEX)
    .withMessage('Clock-in time must be in HH:mm format (00:00 to 23:59).'),

  body('clockOut')
    .trim()
    .notEmpty()
    .withMessage('Clock-out time is required.')
    .matches(REPORT_CONSTANTS.TIME_REGEX)
    .withMessage('Clock-out time must be in HH:mm format (00:00 to 23:59).'),

  body('visits')
    .isArray({ min: 1 })
    .withMessage('Report must contain at least one branch visit.'),

  body('visits.*.branch')
    .trim()
    .notEmpty()
    .withMessage('Each visit must specify a branch reference.')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Each visit branch must be a valid branch ID.');
      }
      return true;
    }),

  body('visits.*.clockIn')
    .trim()
    .notEmpty()
    .withMessage('Visit arrival time is required.')
    .matches(REPORT_CONSTANTS.TIME_REGEX)
    .withMessage('Visit clock-in must be in HH:mm format.'),

  body('visits.*.clockOut')
    .trim()
    .notEmpty()
    .withMessage('Visit departure time is required.')
    .matches(REPORT_CONSTANTS.TIME_REGEX)
    .withMessage('Visit clock-out must be in HH:mm format.'),

  body('activities')
    .isArray({ min: 1 })
    .withMessage('Report must contain at least one operational activity.'),

  body('activities.*.text')
    .trim()
    .notEmpty()
    .withMessage('Activity description text is required.')
    .isLength({ max: REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH })
    .withMessage(
      `Activity text cannot exceed ${REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH} characters.`
    ),

  body('activities.*.status')
    .optional()
    .isIn(REPORT_CONSTANTS.ACTIVITY_STATUSES)
    .withMessage(
      `Activity status must be one of: ${REPORT_CONSTANTS.ACTIVITY_STATUSES.join(', ')}.`
    ),

  body('issues')
    .optional()
    .isArray()
    .withMessage('Issues must be an array.'),

  body('issues.*.text')
    .if(body('issues').isArray({ min: 1 }))
    .trim()
    .notEmpty()
    .withMessage('Issue description text is required.')
    .isLength({ max: REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH })
    .withMessage(
      `Issue text cannot exceed ${REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH} characters.`
    ),

  body('issues.*.status')
    .if(body('issues').isArray({ min: 1 }))
    .optional()
    .isIn(REPORT_CONSTANTS.ISSUE_STATUSES)
    .withMessage(
      `Issue status must be one of: ${REPORT_CONSTANTS.ISSUE_STATUSES.join(', ')}.`
    ),

  body('comments')
    .optional()
    .isArray()
    .withMessage('Comments must be an array.'),

  body('comments.*.text')
    .if(body('comments').isArray({ min: 1 }))
    .trim()
    .notEmpty()
    .withMessage('Comment text is required.')
    .isLength({ max: REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH })
    .withMessage(
      `Comment text cannot exceed ${REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH} characters.`
    ),

  body('transcription')
    .trim()
    .notEmpty()
    .withMessage('Speech transcription or narrative text is required.')
    .isLength({ max: REPORT_CONSTANTS.TRANSCRIPTION_MAX_LENGTH })
    .withMessage(
      `Transcription text cannot exceed ${REPORT_CONSTANTS.TRANSCRIPTION_MAX_LENGTH} characters.`
    ),

  body('audios')
    .optional()
    .isArray({ max: REPORT_CONSTANTS.MAX_AUDIO_FILES })
    .withMessage(
      `Report cannot exceed ${REPORT_CONSTANTS.MAX_AUDIO_FILES} audio files.`
    ),

  body('audios.*')
    .optional()
    .trim()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Each audio reference must be a valid audio ID.');
      }
      return true;
    }),

  // Security Invariants: strictly reject administrative and prohibited field injections
  body('status').custom((value) => {
    if (value !== undefined) {
      throw new Error('Report does not declare a status field.');
    }
    return true;
  }),

  body('templateType').custom((value) => {
    if (value !== undefined) {
      throw new Error('Report templateType is derived dynamically and cannot be manually set.');
    }
    return true;
  }),

  body('isArchived').custom((value) => {
    if (value !== undefined) {
      throw new Error('isArchived cannot be assigned directly during creation.');
    }
    return true;
  }),

  body('archivedAt').custom((value) => {
    if (value !== undefined) {
      throw new Error('archivedAt cannot be assigned directly.');
    }
    return true;
  }),

  body('user').custom((value) => {
    if (value !== undefined) {
      throw new Error('User ownership cannot be overridden in request body.');
    }
    return true;
  }),

  body('_id').custom((value) => {
    if (value !== undefined) {
      throw new Error('Report identifier cannot be manually specified.');
    }
    return true;
  }),

  body('role').custom((value) => {
    if (value !== undefined) {
      throw new Error('Role assignment is strictly prohibited.');
    }
    return true;
  }),

  body('issues.*.category').custom((value) => {
    if (value !== undefined) {
      throw new Error('Issue category is prohibited.');
    }
    return true;
  }),

  body('issues.*.severity').custom((value) => {
    if (value !== undefined) {
      throw new Error('Issue severity is prohibited.');
    }
    return true;
  }),

  body('comments.*.status').custom((value) => {
    if (value !== undefined) {
      throw new Error('Comments do not declare a status field.');
    }
    return true;
  }),
];

export default {
  reportIdValidation,
  getReportsValidation,
  updateReportValidation,
  createReportValidation,
};
