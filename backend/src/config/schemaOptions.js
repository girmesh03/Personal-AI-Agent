/**
 * @module config/schemaOptions
 * @description Centralized Mongoose base schema configuration.
 */

/**
 * Standard Mongoose schema options applied across all domain models.
 * Enforces Invariant 32 line-by-line configuration and sanitizing transforms.
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

export default BASE_SCHEMA_OPTIONS;
