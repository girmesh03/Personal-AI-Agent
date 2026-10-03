/**
 * @module config/schemaOptions
 * @description Centralized Mongoose base schema configuration.
 */

/**
 * Standard Mongoose schema options applied across all root domain models.
 * Enforces line-by-line configuration, automatic timestamps, and sanitizing transforms.
 * @constant
 * @type {Readonly<Record<string, any>>}
 */
export const BASE_SCHEMA_OPTIONS = Object.freeze({
  // Automatically manage createdAt and updatedAt timestamps
  timestamps: true,
  // Configuration for JSON serialization
  toJSON: {
    // Include virtual accessors
    virtuals: true,
    // Custom transform function sanitizing internal state
    transform: (_doc, ret) => {
      // Strip Mongoose internal version key
      delete ret.__v;
      // Strip duplicate id alias to enforce standard _id conventions
      delete ret.id;
      // Return sanitized plain object
      return ret;
    },
  },
  // Configuration for programmatic object serialization
  toObject: {
    // Include virtual accessors
    virtuals: true,
    // Custom transform function sanitizing internal state
    transform: (_doc, ret) => {
      // Strip Mongoose internal version key
      delete ret.__v;
      // Strip duplicate id alias
      delete ret.id;
      // Return sanitized plain object
      return ret;
    },
  },
});

/**
 * Standard Mongoose schema options applied to identifiable subdocuments (_id: true).
 * Enforces:
 * 1. Mongoose duplicate `id` virtual getter is disabled (`id: false`), preventing collision
 *    with explicit schema fields (such as client message UUIDs) and preventing duplicate keys.
 * 2. Virtual getters (such as computed `url` on attachments) are serialized into JSON and plain objects.
 * 3. Mongoose internal version key `__v` is stripped.
 * 4. Automatic root-level timestamps (which are irrelevant for subdocuments) are excluded.
 * @constant
 * @type {Readonly<Record<string, any>>}
 */
export const SUBDOCUMENT_SCHEMA_OPTIONS = Object.freeze({
  _id: true,
  id: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => {
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
    transform: (_doc, ret) => {
      delete ret.__v;
      return ret;
    },
  },
});

/**
 * Standard Mongoose schema options applied to embedded configuration and value objects (_id: false).
 * Omits independent MongoDB ObjectIds and internal Mongoose duplicate id aliases.
 * @constant
 * @type {Readonly<Record<string, any>>}
 */
export const EMBEDDED_SCHEMA_OPTIONS = Object.freeze({
  _id: false,
  id: false,
});

export default {
  BASE_SCHEMA_OPTIONS,
  SUBDOCUMENT_SCHEMA_OPTIONS,
  EMBEDDED_SCHEMA_OPTIONS,
};

