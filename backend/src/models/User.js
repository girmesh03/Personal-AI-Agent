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
} from '../utils/constants.js';

/**
 * @typedef {Object} IUser
 * @property {import('mongoose').Types.ObjectId} _id - Unique user ID.
 * @property {string} firstName - User first name (2-50 chars).
 * @property {string} lastName - User last name (2-50 chars).
 * @property {string} email - Unique lowercase email address.
 * @property {string} password - Bcrypt hashed password (hidden by default).
 * @property {string} position - Job position (defaults to 'Area Supervisor').
 * @property {string|null} avatar - Profile avatar image URL or path.
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
      unique: true,
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

export const User = mongoose.model('User', userSchema);
export default User;
