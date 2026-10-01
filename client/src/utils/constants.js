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
 * Application brand title loaded dynamically from client environment configuration.
 * @constant
 * @type {string}
 */
export const APP_NAME =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_TITLE) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_NAME) ||
  'Operon';

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
 * Application client route paths.
 * Centralized route registry managing all navigation destinations from one single place.
 * @constant
 * @type {Readonly<{
 *   LANDING: string,
 *   LOGIN: string,
 *   REGISTER: string,
 *   DASHBOARD: string,
 *   PROFILE: string,
 *   LOGIN_REDIRECT: string,
 *   CHAT: string,
 *   REPORTS: string,
 *   REPORT_DETAIL: string,
 *   REPORT_EDIT: string,
 *   BRANCHES: string,
 *   BRANCH_DETAIL: string,
 * }>}
 */
export const ROUTES = Object.freeze({
  LANDING: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  LOGIN_REDIRECT: '/dashboard',
  CHAT: '/chat',
  REPORTS: '/reports',
  REPORT_DETAIL: '/reports/:reportId/details',
  REPORT_EDIT: '/reports/:reportId/edit',
  BRANCHES: '/branches',
  BRANCH_DETAIL: '/branches/:branchId/details',
});

/** Backward-compatible route aliases referencing the canonical ROUTES registry */
export const LANDING_ROUTE = ROUTES.LANDING;
export const LOGIN_ROUTE = ROUTES.LOGIN;
export const REGISTER_ROUTE = ROUTES.REGISTER;
export const DASHBOARD_ROUTE = ROUTES.DASHBOARD;
export const PROFILE_ROUTE = ROUTES.PROFILE;
export const LOGIN_REDIRECT_ROUTE = ROUTES.LOGIN_REDIRECT;
export const CHAT_ROUTE = ROUTES.CHAT;
export const REPORTS_ROUTE = ROUTES.REPORTS;
export const REPORT_DETAIL_ROUTE = ROUTES.REPORT_DETAIL;
export const REPORT_EDIT_ROUTE = ROUTES.REPORT_EDIT;
export const BRANCHES_ROUTE = ROUTES.BRANCHES;
export const BRANCH_DETAIL_ROUTE = ROUTES.BRANCH_DETAIL;

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

/**
 * User feedback message displayed when attempting report creation before Milestone 7.
 * @constant
 * @type {string}
 */
export const REPORT_CREATION_TBD_MESSAGE =
  'Report creation workflow is TBD (scheduled for Milestone 7).';

/**
 * Tentative operational feature highlights presented on the public landing page.
 * High-level supervisor capabilities subject to subsequent milestone refinements.
 * @constant
 * @type {ReadonlyArray<{ id: string, title: string, description: string }>}
 */
export const LANDING_FEATURES = Object.freeze([
  {
    id: 'inspections',
    title: 'Branch Inspections',
    description:
      'Coordinate routine site visits, monitor operational standards, and log real-time branch findings.',
  },
  {
    id: 'reporting',
    title: 'Operational Reporting',
    description:
      'Synthesize daily operational updates and structured summaries for area management review.',
  },
  {
    id: 'oversight',
    title: 'Field Oversight',
    description:
      'Centralize supervisor workflow, track branch performance trends, and manage operational communications.',
  },
]);



