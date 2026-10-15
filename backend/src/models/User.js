/**
 * @module models/User
 * @description Mongoose schema and model definition for the application User (Area Supervisor).
 * Enforces single-user operational constraints (strictly zero role, zero isArchived).
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { BASE_SCHEMA_OPTIONS } from '../config/schemaOptions.js';
import {
  DEFAULT_POSITION,
  USER_NAME_LENGTH,
  PASSWORD_MIN_LENGTH,
  EMAIL_REGEX,
  BCRYPT_SALT_ROUNDS,
  CHAT_CONSTANTS,
  REPORT_CONSTANTS,
} from '../utils/constants.js';

/**
 * @typedef {Object} IUserSettingsDirectives
 * @property {string[]} negativeVocabulary - Forbidden words strictly excluded from all outputs.
 * @property {Map<string, string>} phraseMappings - Shorthand-to-corporate wording and jargon mappings.
 * @property {string[]} customInstructions - Discrete persistent rules and preferences created on the fly.
 */

/**
 * @typedef {Object} IUserSettingsAgentConfig
 * @property {string} persona - Configurable operational persona description.
 * @property {string} defaultModel - Default Gemini model identifier.
 * @property {number} defaultThinkingBudget - Default reasoning token budget.
 * @property {string} defaultLanguage - Default interaction language ('am' | 'en' | 'auto').
 */

/**
 * @typedef {Object} IUserSettings
 * @property {string} sttEngine - Default Speech-to-Text engine ('addis_ai' | 'gemini-2.5-flash').
 * @property {IUserSettingsAgentConfig} agentConfig - Agent persona and default reasoning configuration.
 * @property {IUserSettingsDirectives} directives - Supervisor vocabulary rules, constraints, and instructions.
 */

/**
 * @typedef {Object} IUser
 * @property {import('mongoose').Types.ObjectId} _id - Unique user ID.
 * @property {string} firstName - User first name (2-50 chars).
 * @property {string} lastName - User last name (2-50 chars).
 * @property {string} email - Unique lowercase email address.
 * @property {string} password - Bcrypt hashed password (hidden by default).
 * @property {string} position - Job position (defaults to 'Area Supervisor').
 * @property {string|null} avatar - Profile avatar image URL or path.
 * @property {IUserSettings} settings - User operational settings, STT engine, and directives.
 * @property {string} fullName - Virtual property combining first and last name.
 * @property {Date} createdAt - Timestamp of user creation.
 * @property {Date} updatedAt - Timestamp of last user update.
 */

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required.'],
      trim: true,
      minlength: [USER_NAME_LENGTH.MIN, `First name must be at least ${USER_NAME_LENGTH.MIN} characters.`],
      maxlength: [USER_NAME_LENGTH.MAX, `First name cannot exceed ${USER_NAME_LENGTH.MAX} characters.`],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required.'],
      trim: true,
      minlength: [USER_NAME_LENGTH.MIN, `Last name must be at least ${USER_NAME_LENGTH.MIN} characters.`],
      maxlength: [USER_NAME_LENGTH.MAX, `Last name cannot exceed ${USER_NAME_LENGTH.MAX} characters.`],
    },
    email: {
      type: String,
      required: [true, 'Email address is required.'],
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, 'Please provide a valid email address.'],
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`],
      select: false,
    },
    position: {
      type: String,
      required: [true, 'Position is required.'],
      trim: true,
      default: DEFAULT_POSITION,
    },
    avatar: {
      type: String,
      default: null,
    },
    settings: {
      sttEngine: {
        type: String,
        enum: CHAT_CONSTANTS.STT_ENGINES,
        default: CHAT_CONSTANTS.DEFAULT_STT_ENGINE,
      },
      agentConfig: {
        persona: {
          type: String,
          default: CHAT_CONSTANTS.DEFAULT_PERSONA,
        },
        defaultModel: {
          type: String,
          enum: CHAT_CONSTANTS.SUPPORTED_MODELS,
          default: CHAT_CONSTANTS.DEFAULT_MODEL,
        },
        defaultThinkingBudget: {
          type: Number,
          default: CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET,
          min: CHAT_CONSTANTS.MIN_THINKING_BUDGET,
          max: CHAT_CONSTANTS.MAX_THINKING_BUDGET,
        },
        defaultLanguage: {
          type: String,
          enum: CHAT_CONSTANTS.SUPPORTED_LANGUAGES,
          default: CHAT_CONSTANTS.DEFAULT_LANGUAGE,
        },
      },
      reportTemplates: {
        singleBranch: {
          type: String,
          default: null,
          trim: true,
          maxlength: [
            REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH,
            `Single branch template cannot exceed ${REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH} characters.`,
          ],
        },
        multiBranch: {
          type: String,
          default: null,
          trim: true,
          maxlength: [
            REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH,
            `Multi branch template cannot exceed ${REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH} characters.`,
          ],
        },
      },
      directives: {
        negativeVocabulary: [{ type: String, trim: true }],
        phraseMappings: { type: Map, of: String, default: () => new Map() },
        customInstructions: [{ type: String, trim: true }],
      },
      telegram: {
        botToken: { type: String, default: null, trim: true },
        managementChatId: { type: String, default: null, trim: true },
        maintenanceChatId: { type: String, default: null, trim: true },
        generalChatId: { type: String, default: null, trim: true },
        defaultFormat: {
          type: String,
          enum: ['text', 'image'],
          default: 'text',
        },
        imageCardOptions: {
          type: Object,
          default: {},
        },
      },
    },
  },
  {
    ...BASE_SCHEMA_OPTIONS,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        delete ret.id;
        delete ret.password;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        delete ret.id;
        delete ret.password;
        return ret;
      },
    },
  }
);

// Explicit schema-level unique index on email
userSchema.index({ email: 1 }, { unique: true });

/**
 * Virtual getter for the user's computed full name.
 * @memberof userSchema
 * @returns {string} Combined first and last name.
 */
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

/**
 * Mongoose pre-save hook to hash user password using bcrypt with salt factor 12.
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Compares an incoming plain-text password with the stored bcrypt hash.
 * @function matchPassword
 * @memberof userSchema.methods
 * @param {string} enteredPassword - Candidate plain-text password.
 * @returns {Promise<boolean>} True if password matches hash, false otherwise.
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

/**
 * Compares an incoming plain-text password with the stored bcrypt hash (alias for matchPassword).
 * @function comparePassword
 * @memberof userSchema.methods
 * @param {string} enteredPassword - Candidate plain-text password.
 * @returns {Promise<boolean>} True if password matches hash, false otherwise.
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model('User', userSchema);
export default User;
