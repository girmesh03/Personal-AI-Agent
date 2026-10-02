/**
 * @module models/Branch
 * @description Mongoose schema and model definition for physical operational branches.
 * Scoped strictly to the authenticated supervisor (user: req.user._id).
 * Enforces compound partial unique indexes on (user, name) with case-insensitive collation,
 * operational code uniqueness, bilingual aliases for Amharic/English discovery,
 * soft-archival lifecycle tracking, and standard pagination.
 */

import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { BASE_SCHEMA_OPTIONS } from '../config/schemaOptions.js';
import { BRANCH_CONSTANTS } from '../utils/constants.js';

/**
 * @typedef {Object} IBranchLocation
 * @property {string} city - Municipality / city of the branch (defaults to Addis Ababa).
 * @property {string} subcity - Subcity or district administrative division.
 * @property {string} address - Street or landmark location address.
 */

/**
 * @typedef {Object} IBranch
 * @property {import('mongoose').Types.ObjectId} _id - Unique branch identifier.
 * @property {import('mongoose').Types.ObjectId} user - Owning supervisor identifier.
 * @property {string} name - Branch name (English or Amharic).
 * @property {string} code - Operational branch code (e.g., 'BOLE-01').
 * @property {string[]} aliases - Bilingual transliterated search aliases (English & Amharic equivalents).
 * @property {IBranchLocation} location - Physical branch location details.
 * @property {string} managerName - Branch store manager full name.
 * @property {string} contactPhone - Store manager contact telephone number.
 * @property {boolean} isArchived - Soft-deletion archival flag.
 * @property {Date|null} archivedAt - Timestamp when branch was soft-archived.
 * @property {Date} createdAt - Document creation timestamp.
 * @property {Date} updatedAt - Document last modification timestamp.
 */

const branchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owning supervisor user reference is required.'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Branch name is required.'],
      trim: true,
      minlength: [BRANCH_CONSTANTS.NAME_MIN_LENGTH, `Branch name must be at least ${BRANCH_CONSTANTS.NAME_MIN_LENGTH} character.`],
      maxlength: [BRANCH_CONSTANTS.NAME_MAX_LENGTH, `Branch name cannot exceed ${BRANCH_CONSTANTS.NAME_MAX_LENGTH} characters.`],
    },
    code: {
      type: String,
      required: [true, 'Operational branch code is required.'],
      trim: true,
      uppercase: true,
      minlength: [BRANCH_CONSTANTS.CODE_MIN_LENGTH, `Branch code must be at least ${BRANCH_CONSTANTS.CODE_MIN_LENGTH} characters.`],
      maxlength: [BRANCH_CONSTANTS.CODE_MAX_LENGTH, `Branch code cannot exceed ${BRANCH_CONSTANTS.CODE_MAX_LENGTH} characters.`],
    },
    aliases: {
      type: [String],
      default: [],
      index: true,
    },
    location: {
      city: {
        type: String,
        default: BRANCH_CONSTANTS.DEFAULT_CITY,
        trim: true,
        maxlength: [BRANCH_CONSTANTS.CITY_MAX_LENGTH, `City cannot exceed ${BRANCH_CONSTANTS.CITY_MAX_LENGTH} characters.`],
      },
      subcity: {
        type: String,
        default: '',
        trim: true,
        maxlength: [BRANCH_CONSTANTS.SUBCITY_MAX_LENGTH, `Subcity cannot exceed ${BRANCH_CONSTANTS.SUBCITY_MAX_LENGTH} characters.`],
      },
      address: {
        type: String,
        default: '',
        trim: true,
        maxlength: [BRANCH_CONSTANTS.ADDRESS_MAX_LENGTH, `Address cannot exceed ${BRANCH_CONSTANTS.ADDRESS_MAX_LENGTH} characters.`],
      },
    },
    managerName: {
      type: String,
      default: '',
      trim: true,
      maxlength: [BRANCH_CONSTANTS.MANAGER_NAME_MAX_LENGTH, `Manager name cannot exceed ${BRANCH_CONSTANTS.MANAGER_NAME_MAX_LENGTH} characters.`],
    },
    contactPhone: {
      type: String,
      default: '',
      trim: true,
      maxlength: [BRANCH_CONSTANTS.CONTACT_PHONE_MAX_LENGTH, `Contact phone cannot exceed ${BRANCH_CONSTANTS.CONTACT_PHONE_MAX_LENGTH} characters.`],
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

// Compound partial unique index with case-insensitive collation:
// Guarantees active branch names are unique per supervisor without requiring a redundant normalizedName field.
branchSchema.index(
  { user: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { isArchived: false },
    collation: { locale: 'en', strength: 2 },
  }
);

// Compound partial unique index: ensures active branch codes are unique per supervisor
branchSchema.index(
  { user: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: { isArchived: false },
  }
);

// Compound index for paginated active/archived branch directory queries
branchSchema.index({ user: 1, isArchived: 1, createdAt: -1 });

// Attach pagination plugin for uniform API list envelopes
branchSchema.plugin(mongoosePaginate);

export const Branch = mongoose.model('Branch', branchSchema);

export default Branch;
