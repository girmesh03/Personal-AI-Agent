/**
 * @module validations/reportValidation
 * @description express-validator rule chains for operational report queries, manual edits, and structured report creation payloads.
 * Enforces corporate schema boundaries, single-user tenancy, JDN calendar date limits, time formats, and strict rejection of forbidden fields.
 */

import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';
import { REPORT_CONSTANTS } from '../utils/constants.js';
import { ValidationError } from '../errors/CustomError.js';

/**
 * Validates whether an incoming value is a valid 24-character hexadecimal MongoDB ObjectId.
 * Enforces canonical Mongoose ObjectId instantiation and string round-trip equivalence.
 * @function isValidObjectId
 * @param {string} value - Candidate identifier string.
 * @returns {boolean} True if strictly valid MongoDB ObjectId.
 */
export const isValidObjectId = (value) =>
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

  body('transcription')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Transcription cannot be empty if provided.')
    .isLength({ max: REPORT_CONSTANTS.TRANSCRIPTION_MAX_LENGTH })
    .withMessage(
      `Transcription text cannot exceed ${REPORT_CONSTANTS.TRANSCRIPTION_MAX_LENGTH} characters.`
    ),

  body('audios')
    .optional()
    .isArray()
    .withMessage('Audios must be an array of audio IDs.')
    .custom((val) => {
      if (val.length > REPORT_CONSTANTS.MAX_AUDIO_FILES) {
        throw new Error(
          `Report audio recordings cannot exceed ${REPORT_CONSTANTS.MAX_AUDIO_FILES}.`
        );
      }
      return true;
    }),

  body('audios.*')
    .optional()
    .custom((val) => {
      if (!isValidObjectId(val)) {
        throw new Error('Valid audio ID is required.');
      }
      return true;
    }),

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
 * Pure domain validator validating a structured operational report payload.
 * Completely independent of Express req/res; directly validates in-memory JavaScript objects.
 * Used by the in-process AI Agent Tool execution pipeline (Task 7.5) and programmatic creators.
 *
 * @function validateReportPayload
 * @param {Object} payload - Raw operational report payload.
 * @returns {Object} Sanitized, validated operational report payload.
 * @throws {ValidationError} If semantic domain rules, schema boundaries, or security invariants are violated.
 */
export const validateReportPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('Report payload must be an object.', [
      { field: 'body', message: 'Payload must be a non-null object.' },
    ]);
  }

  const errors = [];

  // Security Invariants: Prohibited / immutable field rejections
  const forbiddenFields = [
    'status',
    'templateType',
    'isArchived',
    'archivedAt',
    'user',
    '_id',
    'role',
  ];
  for (const field of forbiddenFields) {
    if (payload[field] !== undefined) {
      errors.push({ field, message: `Field '${field}' is strictly prohibited.` });
    }
  }

  // 1. Inspection Date
  if (!payload.date) {
    errors.push({ field: 'date', message: 'Inspection date is required.' });
  } else {
    const d = new Date(payload.date);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'date', message: 'Date must be a valid ISO 8601 date string.' });
    } else {
      const now = new Date();
      // Allow up to 24-hour buffer to accommodate global supervisor timezones (up to UTC+14)
      const maxAllowed = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (d > maxAllowed) {
        errors.push({ field: 'date', message: 'Inspection date cannot be in the future.' });
      }
    }
  }

  // 2. Work Clock-In
  if (!payload.clockIn || typeof payload.clockIn !== 'string' || !payload.clockIn.trim()) {
    errors.push({ field: 'clockIn', message: 'Clock-in time is required.' });
  } else if (!REPORT_CONSTANTS.TIME_REGEX.test(payload.clockIn.trim())) {
    errors.push({
      field: 'clockIn',
      message: 'Clock-in time must be in HH:mm format (00:00 to 23:59).',
    });
  }

  // 3. Work Clock-Out
  if (!payload.clockOut || typeof payload.clockOut !== 'string' || !payload.clockOut.trim()) {
    errors.push({ field: 'clockOut', message: 'Clock-out time is required.' });
  } else if (!REPORT_CONSTANTS.TIME_REGEX.test(payload.clockOut.trim())) {
    errors.push({
      field: 'clockOut',
      message: 'Clock-out time must be in HH:mm format (00:00 to 23:59).',
    });
  }

  // 4. Branch Visits
  if (!Array.isArray(payload.visits) || payload.visits.length === 0) {
    errors.push({ field: 'visits', message: 'Report must contain at least one branch visit.' });
  } else {
    payload.visits.forEach((v, idx) => {
      if (!v || typeof v !== 'object') {
        errors.push({ field: `visits[${idx}]`, message: 'Visit must be an object.' });
        return;
      }
      if (!v.branch || !isValidObjectId(String(v.branch))) {
        errors.push({
          field: `visits[${idx}].branch`,
          message: 'Each visit branch must be a valid branch ID.',
        });
      }
      if (
        !v.clockIn ||
        typeof v.clockIn !== 'string' ||
        !REPORT_CONSTANTS.TIME_REGEX.test(v.clockIn.trim())
      ) {
        errors.push({
          field: `visits[${idx}].clockIn`,
          message: 'Visit clock-in must be in HH:mm format.',
        });
      }
      if (
        !v.clockOut ||
        typeof v.clockOut !== 'string' ||
        !REPORT_CONSTANTS.TIME_REGEX.test(v.clockOut.trim())
      ) {
        errors.push({
          field: `visits[${idx}].clockOut`,
          message: 'Visit clock-out must be in HH:mm format.',
        });
      }
    });
  }

  // 5. Activities (Optional if customSections are provided)
  const hasCustomSections =
    Array.isArray(payload.customSections) && payload.customSections.length > 0;

  if (!hasCustomSections && (!Array.isArray(payload.activities) || payload.activities.length === 0)) {
    errors.push({
      field: 'activities',
      message: 'Report must contain at least one operational activity or custom template section.',
    });
  } else if (Array.isArray(payload.activities) && payload.activities.length > 0) {
    payload.activities.forEach((a, idx) => {
      if (!a || typeof a !== 'object') {
        errors.push({ field: `activities[${idx}]`, message: 'Activity must be an object.' });
        return;
      }
      if (!a.text || typeof a.text !== 'string' || !a.text.trim()) {
        errors.push({
          field: `activities[${idx}].text`,
          message: 'Activity description text is required.',
        });
      } else if (a.text.trim().length > REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH) {
        errors.push({
          field: `activities[${idx}].text`,
          message: `Activity text cannot exceed ${REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH} characters.`,
        });
      }
      if (a.status !== undefined && !REPORT_CONSTANTS.ACTIVITY_STATUSES.includes(a.status)) {
        errors.push({
          field: `activities[${idx}].status`,
          message: `Activity status must be one of: ${REPORT_CONSTANTS.ACTIVITY_STATUSES.join(', ')}.`,
        });
      }
    });
  }

  // 5b. Custom Template Sections (Optional)
  if (payload.customSections !== undefined) {
    if (!Array.isArray(payload.customSections)) {
      errors.push({ field: 'customSections', message: 'customSections must be an array.' });
    } else {
      payload.customSections.forEach((cs, idx) => {
        if (!cs || typeof cs !== 'object') {
          errors.push({ field: `customSections[${idx}]`, message: 'Custom section must be an object.' });
          return;
        }
        if (!cs.heading || typeof cs.heading !== 'string' || !cs.heading.trim()) {
          errors.push({
            field: `customSections[${idx}].heading`,
            message: 'Custom section heading is required.',
          });
        }
        if (cs.items !== undefined && !Array.isArray(cs.items)) {
          errors.push({
            field: `customSections[${idx}].items`,
            message: 'Custom section items must be an array.',
          });
        }
      });
    }
  }

  // 6. Issues (Optional)
  if (payload.issues !== undefined) {
    if (!Array.isArray(payload.issues)) {
      errors.push({ field: 'issues', message: 'Issues must be an array.' });
    } else {
      payload.issues.forEach((issue, idx) => {
        if (!issue || typeof issue !== 'object') {
          errors.push({ field: `issues[${idx}]`, message: 'Issue must be an object.' });
          return;
        }
        if (issue.category !== undefined) {
          errors.push({ field: `issues[${idx}].category`, message: 'Issue category is prohibited.' });
        }
        if (issue.severity !== undefined) {
          errors.push({ field: `issues[${idx}].severity`, message: 'Issue severity is prohibited.' });
        }
        if (!issue.text || typeof issue.text !== 'string' || !issue.text.trim()) {
          errors.push({
            field: `issues[${idx}].text`,
            message: 'Issue description text is required.',
          });
        } else if (issue.text.trim().length > REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH) {
          errors.push({
            field: `issues[${idx}].text`,
            message: `Issue text cannot exceed ${REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH} characters.`,
          });
        }
        if (
          issue.status !== undefined &&
          !REPORT_CONSTANTS.ISSUE_STATUSES.includes(issue.status)
        ) {
          errors.push({
            field: `issues[${idx}].status`,
            message: `Issue status must be one of: ${REPORT_CONSTANTS.ISSUE_STATUSES.join(', ')}.`,
          });
        }
      });
    }
  }

  // 7. Comments (Optional)
  if (payload.comments !== undefined) {
    if (!Array.isArray(payload.comments)) {
      errors.push({ field: 'comments', message: 'Comments must be an array.' });
    } else {
      payload.comments.forEach((c, idx) => {
        if (!c || typeof c !== 'object') {
          errors.push({ field: `comments[${idx}]`, message: 'Comment must be an object.' });
          return;
        }
        if (c.status !== undefined) {
          errors.push({
            field: `comments[${idx}].status`,
            message: 'Comments do not declare a status field.',
          });
        }
        if (!c.text || typeof c.text !== 'string' || !c.text.trim()) {
          errors.push({
            field: `comments[${idx}].text`,
            message: 'Comment text is required.',
          });
        } else if (c.text.trim().length > REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH) {
          errors.push({
            field: `comments[${idx}].text`,
            message: `Comment text cannot exceed ${REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH} characters.`,
          });
        }
      });
    }
  }

  // 8. Speech Transcription
  if (
    !payload.transcription ||
    typeof payload.transcription !== 'string' ||
    !payload.transcription.trim()
  ) {
    errors.push({
      field: 'transcription',
      message: 'Speech transcription or narrative text is required.',
    });
  } else if (payload.transcription.trim().length > REPORT_CONSTANTS.TRANSCRIPTION_MAX_LENGTH) {
    errors.push({
      field: 'transcription',
      message: `Transcription text cannot exceed ${REPORT_CONSTANTS.TRANSCRIPTION_MAX_LENGTH} characters.`,
    });
  }

  // 9. Audios (Optional)
  if (payload.audios !== undefined) {
    if (!Array.isArray(payload.audios)) {
      errors.push({ field: 'audios', message: 'Audios must be an array.' });
    } else if (payload.audios.length > REPORT_CONSTANTS.MAX_AUDIO_FILES) {
      errors.push({
        field: 'audios',
        message: `Report cannot exceed ${REPORT_CONSTANTS.MAX_AUDIO_FILES} audio files.`,
      });
    } else {
      payload.audios.forEach((audioId, idx) => {
        if (!isValidObjectId(String(audioId))) {
          errors.push({
            field: `audios[${idx}]`,
            message: 'Each audio reference must be a valid audio ID.',
          });
        }
      });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Report payload validation failed.', errors);
  }

  return {
    date: new Date(payload.date),
    clockIn: payload.clockIn.trim(),
    clockOut: payload.clockOut.trim(),
    visits: payload.visits.map((v) => ({
      branch: v.branch,
      clockIn: v.clockIn.trim(),
      clockOut: v.clockOut.trim(),
    })),
    activities: payload.activities.map((a) => ({
      text: a.text.trim(),
      status: a.status || REPORT_CONSTANTS.DEFAULT_ACTIVITY_STATUS,
    })),
    issues: (payload.issues || []).map((i) => ({
      text: i.text.trim(),
      status: i.status || REPORT_CONSTANTS.DEFAULT_ISSUE_STATUS,
    })),
    comments: (payload.comments || []).map((c) => ({
      text: c.text.trim(),
      status: null,
    })),
    transcription: payload.transcription.trim(),
    audios: payload.audios || [],
  };
};

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

/**
 * Validation rules for report document export and Google Drive dispatch.
 * @constant
 * @type {import('express-validator').ValidationChain[]}
 */
export default {
  isValidObjectId,
  validateReportPayload,
  reportIdValidation,
  getReportsValidation,
  updateReportValidation,
  createReportValidation,
};
