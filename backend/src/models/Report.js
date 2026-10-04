/**
 * @module models/Report
 * @description Mongoose schema and model definition for Corporate Operational Reports.
 * Scoped strictly to the authenticated supervisor (user: req.user._id).
 * Enforces embedded subdocuments for visits, activities, issues, and comments,
 * standalone Audio document references, derived virtual getter for Ethiopian calendar
 * date, and partial indexes for active inspection queries.
 * Note: Author identity is grounded strictly via user reference (Single Source of Truth).
 * Note: Strictly zero status and zero templateType columns exist on the Report model.
 */

import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { BASE_SCHEMA_OPTIONS, SUBDOCUMENT_SCHEMA_OPTIONS } from '../config/schemaOptions.js';
import { REPORT_CONSTANTS } from '../utils/constants.js';
import { toEthiopianDateString } from '../utils/ethiopianCalendar.js';

/**
 * @typedef {Object} IVisit
 * @property {import('mongoose').Types.ObjectId} _id - Unique visit subdocument identifier.
 * @property {import('mongoose').Types.ObjectId} branch - Visited operational branch reference.
 * @property {string} clockIn - Arrival time at branch (HH:mm format).
 * @property {string} clockOut - Departure time from branch (HH:mm format).
 */

/**
 * @typedef {Object} IActivity
 * @property {import('mongoose').Types.ObjectId} _id - Unique activity subdocument identifier.
 * @property {string} text - Operational activity description.
 * @property {'in_progress'|'completed'} status - Activity completion status (defaults to 'completed').
 */

/**
 * @typedef {Object} IIssue
 * @property {import('mongoose').Types.ObjectId} _id - Unique issue subdocument identifier.
 * @property {string} text - Operational issue description.
 * @property {'reported'|'completed'|'in_progress'|'no_issue'} status - Issue status (defaults to 'reported').
 */

/**
 * @typedef {Object} IComment
 * @property {import('mongoose').Types.ObjectId} _id - Unique comment subdocument identifier.
 * @property {string} text - General supervisory comment text.
 * @property {null} status - Always null (comments require no status).
 */

/**
 * @typedef {Object} IReport
 * @property {import('mongoose').Types.ObjectId} _id - Unique report identifier.
 * @property {import('mongoose').Types.ObjectId} user - Owning supervisor user reference.
 * @property {Date} date - Inspection date.
 * @property {string} clockIn - Work clock-in time (HH:mm format).
 * @property {string} clockOut - Work clock-out time (HH:mm format).
 * @property {IVisit[]} visits - Branch inspection visit intervals.
 * @property {string} transcription - Authoritative corporate Amharic operational text.
 * @property {import('mongoose').Types.ObjectId[]} audios - Evidentiary standalone Audio document references.
 * @property {IActivity[]} activities - Embedded operational activities.
 * @property {IIssue[]} issues - Embedded operational issues.
 * @property {IComment[]} comments - Embedded supervisory comments.
 * @property {string} ethiopianDate - Derived virtual Ethiopian calendar date (DD-MM-YY).
 * @property {boolean} isArchived - Soft-deletion archival flag.
 * @property {Date|null} archivedAt - Timestamp when report was soft-archived.
 * @property {Date} createdAt - Document creation timestamp.
 * @property {Date} updatedAt - Document last modification timestamp.
 */

/**
 * Embedded subdocument schema representing a branch inspection visit interval.
 */
const visitSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch reference is required for each visit.'],
    },
    clockIn: {
      type: String,
      required: [true, 'Visit arrival time is required.'],
      trim: true,
      match: [REPORT_CONSTANTS.TIME_REGEX, 'Visit arrival time must be in HH:mm format.'],
    },
    clockOut: {
      type: String,
      required: [true, 'Visit departure time is required.'],
      trim: true,
      match: [REPORT_CONSTANTS.TIME_REGEX, 'Visit departure time must be in HH:mm format.'],
    },
  },
  SUBDOCUMENT_SCHEMA_OPTIONS
);

/**
 * Embedded subdocument schema representing an operational activity.
 * Default status is 'completed'.
 */
const activitySchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Activity description is required.'],
      trim: true,
      maxlength: [
        REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH,
        `Activity text cannot exceed ${REPORT_CONSTANTS.ACTIVITY_TEXT_MAX_LENGTH} characters.`,
      ],
    },
    status: {
      type: String,
      enum: REPORT_CONSTANTS.ACTIVITY_STATUSES,
      default: REPORT_CONSTANTS.DEFAULT_ACTIVITY_STATUS,
    },
  },
  SUBDOCUMENT_SCHEMA_OPTIONS
);

/**
 * Embedded subdocument schema representing an operational issue.
 * Default status is 'reported'. Strictly zero category and zero severity.
 */
const issueSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Issue description is required.'],
      trim: true,
      maxlength: [
        REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH,
        `Issue text cannot exceed ${REPORT_CONSTANTS.ISSUE_TEXT_MAX_LENGTH} characters.`,
      ],
    },
    status: {
      type: String,
      enum: REPORT_CONSTANTS.ISSUE_STATUSES,
      default: REPORT_CONSTANTS.DEFAULT_ISSUE_STATUS,
    },
  },
  SUBDOCUMENT_SCHEMA_OPTIONS
);

/**
 * Embedded subdocument schema representing general supervisory comments.
 * Comments have no status requirement.
 */
const commentSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Comment text is required.'],
      trim: true,
      maxlength: [
        REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH,
        `Comment text cannot exceed ${REPORT_CONSTANTS.COMMENT_TEXT_MAX_LENGTH} characters.`,
      ],
    },
    status: {
      type: String,
      default: null,
    },
  },
  SUBDOCUMENT_SCHEMA_OPTIONS
);

/**
 * Corporate Operational Report Schema.
 * Note: The Report itself has strictly NO status field and NO templateType field.
 */
const reportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Report must belong to a supervisor.'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Inspection date is required.'],
      index: true,
    },
    clockIn: {
      type: String,
      required: [true, 'Work clock-in time is required.'],
      trim: true,
      match: [REPORT_CONSTANTS.TIME_REGEX, 'Work clock-in time must be in HH:mm format.'],
    },
    clockOut: {
      type: String,
      required: [true, 'Work clock-out time is required.'],
      trim: true,
      match: [REPORT_CONSTANTS.TIME_REGEX, 'Work clock-out time must be in HH:mm format.'],
    },
    visits: {
      type: [visitSchema],
      default: [],
    },
    transcription: {
      type: String,
      required: [true, 'Report transcription is required.'],
      trim: true,
      maxlength: [
        REPORT_CONSTANTS.TRANSCRIPTION_MAX_LENGTH,
        `Transcription text cannot exceed ${REPORT_CONSTANTS.TRANSCRIPTION_MAX_LENGTH} characters.`,
      ],
    },
    audios: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Audio',
        },
      ],
      default: [],
      validate: [
        (val) => val.length <= REPORT_CONSTANTS.MAX_AUDIO_FILES,
        `Report audio recordings cannot exceed ${REPORT_CONSTANTS.MAX_AUDIO_FILES}.`,
      ],
    },
    activities: {
      type: [activitySchema],
      default: [],
    },
    issues: {
      type: [issueSchema],
      default: [],
    },
    comments: {
      type: [commentSchema],
      default: [],
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  BASE_SCHEMA_OPTIONS
);

/**
 * Derived virtual getter: ethiopianDate
 * Dynamically computes Ethiopian calendar date (DD-MM-YY) from Gregorian date.
 * @memberof reportSchema
 * @returns {string|null} Ethiopian date formatted as DD-MM-YY.
 */
reportSchema.virtual('ethiopianDate').get(function () {
  if (!this.date) return null;
  return toEthiopianDateString(this.date);
});

// Partial compound index for active reports ordered by date (primary query path)
reportSchema.index(
  { user: 1, date: -1 },
  { partialFilterExpression: { isArchived: false } }
);

// Partial compound index for active branch visit historical query
reportSchema.index(
  { user: 1, 'visits.branch': 1 },
  { partialFilterExpression: { isArchived: false } }
);

// Partial compound index for archived reports: sweeper auto-purge and archived list
reportSchema.index(
  { user: 1, archivedAt: -1 },
  { partialFilterExpression: { isArchived: true } }
);

// Attach pagination plugin
reportSchema.plugin(mongoosePaginate);

export const Report = mongoose.model('Report', reportSchema);

export default Report;
