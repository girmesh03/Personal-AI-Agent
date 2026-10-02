/**
 * @module utils/constants
 * @description Centralized application constants and configuration thresholds for backend operations.
 */

import { env, parseDurationToMs } from '../config/env.js';

/**
 * Standard HTTP Status Codes.
 * Strict naming invariant: 401 is UNAUTHENTICATED (never UNAUTHORIZED).
 * @constant
 * @type {Readonly<Record<string, number>>}
 */
export const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
});

/**
 * Password validation regex enforcing at least 8 characters,
 * 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.
 * @constant
 * @type {RegExp}
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Standard email validation regex format.
 * @constant
 * @type {RegExp}
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Name length boundaries for user profiles.
 * @constant
 * @type {Readonly<{ MIN: number, MAX: number }>}
 */
export const USER_NAME_LENGTH = Object.freeze({
  MIN: 2,
  MAX: 50,
});

/**
 * Minimum password length requirement.
 * @constant
 * @type {number}
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Bcrypt salt rounds factor for password hashing.
 * @constant
 * @type {number}
 */
export const BCRYPT_SALT_ROUNDS = 12;

/**
 * JWT token lifespan configuration referencing validated environment variables.
 * @constant
 * @type {Readonly<{ ACCESS: string, REFRESH: string }>}
 */
export const JWT_EXPIRY = Object.freeze({
  ACCESS: env.JWT_ACCESS_EXPIRES_IN,
  REFRESH: env.JWT_REFRESH_EXPIRES_IN,
});

/**
 * HTTP cookie maximum age in milliseconds derived directly from JWT expiration settings.
 * Fixed refresh token lifespan (strictly zero remember-me branching).
 * @constant
 * @type {Readonly<{ ACCESS: number, REFRESH: number }>}
 */
export const COOKIE_MAX_AGE = Object.freeze({
  ACCESS: parseDurationToMs(env.JWT_ACCESS_EXPIRES_IN, 15 * 60 * 1000),
  REFRESH: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000),
});

/**
 * Default supervisor corporate position title.
 * @constant
 * @type {string}
 */
export const DEFAULT_POSITION = 'Area Supervisor';

/**
 * Sweeper retention threshold for soft-deleted documents (days).
 * @constant
 * @type {number}
 */
export const SWEEPER_RETENTION_DAYS = 30;

/**
 * Sweeper archive TTL in seconds (equivalent to 30 days).
 * @constant
 * @type {number}
 */
export const ARCHIVED_TTL_SECONDS = SWEEPER_RETENTION_DAYS * 24 * 60 * 60;

/**
 * Sweeper background interval in milliseconds (default: 24 hours).
 * @constant
 * @type {number}
 */
export const SWEEPER_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Default pagination limit per page.
 * @constant
 * @type {number}
 */
export const DEFAULT_PAGE_LIMIT = 10;

/**
 * Branch validation and operational boundaries.
 * @constant
 * @type {Readonly<{
 *   NAME_MIN_LENGTH: number,
 *   NAME_MAX_LENGTH: number,
 *   CODE_MIN_LENGTH: number,
 *   CODE_MAX_LENGTH: number,
 *   CITY_MAX_LENGTH: number,
 *   SUBCITY_MAX_LENGTH: number,
 *   ADDRESS_MAX_LENGTH: number,
 *   MANAGER_NAME_MAX_LENGTH: number,
 *   CONTACT_PHONE_MAX_LENGTH: number,
 *   DEFAULT_CITY: string,
 *   SEARCH_MAX_LENGTH: number,
 *   PAGE_LIMIT_MIN: number,
 *   PAGE_LIMIT_MAX: number,
 *   ARCHIVE_RETENTION_DAYS: number,
 * }>}
 */
export const BRANCH_CONSTANTS = Object.freeze({
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  CODE_MIN_LENGTH: 2,
  CODE_MAX_LENGTH: 20,
  CITY_MAX_LENGTH: 100,
  SUBCITY_MAX_LENGTH: 100,
  ADDRESS_MAX_LENGTH: 255,
  MANAGER_NAME_MAX_LENGTH: 100,
  CONTACT_PHONE_MAX_LENGTH: 30,
  DEFAULT_CITY: 'Addis Ababa',
  SEARCH_MAX_LENGTH: 100,
  PAGE_LIMIT_MIN: 1,
  PAGE_LIMIT_MAX: 100,
  ARCHIVE_RETENTION_DAYS: 30,
});

export default {
  HTTP_STATUS,
  PASSWORD_REGEX,
  EMAIL_REGEX,
  USER_NAME_LENGTH,
  PASSWORD_MIN_LENGTH,
  BCRYPT_SALT_ROUNDS,
  JWT_EXPIRY,
  COOKIE_MAX_AGE,
  DEFAULT_POSITION,
  SWEEPER_RETENTION_DAYS,
  ARCHIVED_TTL_SECONDS,
  SWEEPER_INTERVAL_MS,
  DEFAULT_PAGE_LIMIT,
  BRANCH_CONSTANTS,
};

