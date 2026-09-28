/**
 * @module utils/constants
 * @description Centralized client-side constants and HTTP status definitions.
 */

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
 * Default supervisor corporate position title.
 * @constant
 * @type {string}
 */
export const DEFAULT_POSITION = 'Area Supervisor';

/**
 * Default pagination limit per page.
 * @constant
 * @type {number}
 */
export const DEFAULT_PAGE_LIMIT = 10;

/**
 * Application brand title.
 * @constant
 * @type {string}
 */
export const APP_NAME = 'Report Builder';

/**
 * Minimum height for application top bars in pixels.
 * @constant
 * @type {number}
 */
export const APPBAR_MIN_HEIGHT = 64;

/**
 * Spacing multiplier for appbar height calculations.
 * @constant
 * @type {number}
 */
export const APPBAR_MIN_HEIGHT_SPACING = 8;

/**
 * Expanded sidebar drawer width in pixels.
 * @constant
 * @type {number}
 */
export const SIDEBAR_FULL_WIDTH = 260;

/**
 * Collapsed mini-sidebar drawer width in pixels.
 * @constant
 * @type {number}
 */
export const SIDEBAR_MINI_WIDTH = 72;

/**
 * Public landing route path.
 * @constant
 * @type {string}
 */
export const LANDING_ROUTE = '/';

/**
 * User login route path.
 * @constant
 * @type {string}
 */
export const LOGIN_ROUTE = '/login';

/**
 * User registration route path.
 * @constant
 * @type {string}
 */
export const REGISTER_ROUTE = '/register';

/**
 * Supervisor dashboard route path.
 * @constant
 * @type {string}
 */
export const DASHBOARD_ROUTE = '/dashboard';

/**
 * Supervisor profile settings route path.
 * @constant
 * @type {string}
 */
export const PROFILE_ROUTE = '/profile';

/**
 * Default redirect destination route following successful authentication.
 * @constant
 * @type {string}
 */
export const LOGIN_REDIRECT_ROUTE = '/dashboard';

/**
 * Client authentication state machine statuses.
 * @constant
 * @type {Readonly<Record<string, string>>}
 */
export const AUTH_STATUSES = Object.freeze({
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  AUTHENTICATED: 'AUTHENTICATED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
});

