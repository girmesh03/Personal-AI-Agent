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
 * Canonical client API base URL derived from Vite environment variables.
 * @constant
 * @type {string}
 */
export const API_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  'http://localhost:4000/api/v1';

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

/**
 * Report domain constants and template length limits.
 * @constant
 * @type {Readonly<{
 *   TEMPLATE_MAX_LENGTH: number,
 *   PAGE_LIMIT_DEFAULT: number,
 *   PAGE_LIMIT_MIN: number,
 *   PAGE_LIMIT_MAX: number,
 * }>}
 */
export const REPORT_CONSTANTS = Object.freeze({
  TEMPLATE_MAX_LENGTH: 4000,
  PAGE_LIMIT_DEFAULT: 10,
  PAGE_LIMIT_MIN: 1,
  PAGE_LIMIT_MAX: 100,
});

/**
 * Audio domain constants, MIME whitelist, and file bounds.
 * @constant
 * @type {Readonly<{
 *   PURPOSES: string[],
 *   DEFAULT_PURPOSE: string,
 *   STATUSES: string[],
 *   DEFAULT_STATUS: string,
 *   MAX_FILE_SIZE_BYTES: number,
 *   MAX_BATCH_SIZE_BYTES: number,
 *   MAX_FILES_COUNT: number,
 *   MIN_DURATION_SECONDS: number,
 *   MAX_DURATION_SECONDS: number,
 *   ALLOWED_EXTENSIONS: string[],
 *   ALLOWED_MIME_TYPES: string[],
 * }>}
 */
export const AUDIO_CONSTANTS = Object.freeze({
  PURPOSES: ['report_narration', 'chat_voice_input', 'general_memo'],
  DEFAULT_PURPOSE: 'chat_voice_input',
  STATUSES: ['uploaded', 'transcribing', 'transcribed', 'failed'],
  DEFAULT_STATUS: 'uploaded',
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024, // 25MB single file limit
  MAX_BATCH_SIZE_BYTES: 50 * 1024 * 1024, // 50MB batch upload limit
  MAX_FILES_COUNT: 5,
  MIN_DURATION_SECONDS: 1,
  MAX_DURATION_SECONDS: 600, // 10 minutes maximum duration
  ALLOWED_EXTENSIONS: ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm', '.mp4'],
  ALLOWED_MIME_TYPES: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/x-pn-wav',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4',
    'video/mp4',
    'audio/aac',
    'audio/x-aac',
    'audio/webm',
    'video/webm',
    'audio/webm;codecs=opus',
    'video/webm;codecs=opus',
    'audio/ogg',
    'audio/ogg;codecs=opus',
    'application/ogg',
  ],
});

/**
 * Chat attachment and document upload constants, MIME whitelist, and file bounds.
 * Supports multi-modal image inspection, operational documents, and audit spreadsheets.
 * @constant
 * @type {Readonly<{
 *   MAX_FILE_SIZE_BYTES: number,
 *   MAX_BATCH_SIZE_BYTES: number,
 *   MAX_FILES_COUNT: number,
 *   ALLOWED_IMAGE_EXTENSIONS: string[],
 *   ALLOWED_IMAGE_MIME_TYPES: string[],
 *   ALLOWED_DOCUMENT_EXTENSIONS: string[],
 *   ALLOWED_DOCUMENT_MIME_TYPES: string[],
 *   ALLOWED_EXTENSIONS: string[],
 *   ALLOWED_MIME_TYPES: string[],
 * }>}
 */
export const ATTACHMENT_CONSTANTS = Object.freeze({
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024, // 25MB single file limit
  MAX_BATCH_SIZE_BYTES: 50 * 1024 * 1024, // 50MB batch upload limit
  MAX_FILES_COUNT: 5,
  ALLOWED_IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
  ALLOWED_IMAGE_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
  ALLOWED_DOCUMENT_EXTENSIONS: [
    '.pdf',
    '.txt',
    '.csv',
    '.md',
    '.xlsx',
    '.xls',
    '.docx',
    '.doc',
  ],
  ALLOWED_DOCUMENT_MIME_TYPES: [
    'application/pdf',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],
  ALLOWED_EXTENSIONS: [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.heic',
    '.heif',
    '.pdf',
    '.txt',
    '.csv',
    '.md',
    '.xlsx',
    '.xls',
    '.docx',
    '.doc',
  ],
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],
});

/**
 * Unified accept string for HTML file input elements covering images, audios, and documents.
 * Ensures operating systems (Windows Explorer, macOS Finder, mobile pickers) accurately filter allowed files.
 * @constant
 * @type {string}
 */
export const CHAT_FILE_ACCEPT = [
  'image/*',
  'audio/*',
  ...ATTACHMENT_CONSTANTS.ALLOWED_MIME_TYPES,
  ...AUDIO_CONSTANTS.ALLOWED_MIME_TYPES,
  ...ATTACHMENT_CONSTANTS.ALLOWED_EXTENSIONS,
  ...AUDIO_CONSTANTS.ALLOWED_EXTENSIONS,
].join(',');

/**
 * Single source of truth for supported Google Gemini AI models and STT engines.
 * @constant
 * @type {Readonly<{
 *   DEFAULT: string,
 *   FALLBACK: string,
 *   PRO: string,
 *   SUPPORTED: string[],
 *   STT_ENGINES: string[],
 *   DEFAULT_STT_ENGINE: string,
 * }>}
 */
export const AI_MODELS = Object.freeze({
  DEFAULT: 'gemini-3.1-flash-lite',
  FALLBACK: 'gemini-3-flash-preview',
  PRO: 'gemini-3.8-flash',
  SUPPORTED: ['gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-3.8-flash'],
  STT_ENGINES: ['addis_ai', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'],
  DEFAULT_STT_ENGINE: 'addis_ai',
});

/**
 * Canonical display labels for AI models.
 * Single Source of Truth for UI presentation, telemetry tooltips, and badges.
 * @constant
 * @type {Readonly<Record<string, string>>}
 */
export const AI_MODEL_LABELS = Object.freeze({
  [AI_MODELS.DEFAULT]: 'Gemini 3.1 Flash Lite',
  [AI_MODELS.PRO]: 'Gemini 3.8 Flash',
  [AI_MODELS.FALLBACK]: 'Gemini 3 Flash Preview',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
});

/**
 * Returns human-friendly display name for an AI model identifier using AI_MODEL_LABELS SSOT.
 * @param {string} [rawModel]
 * @returns {string} User-facing model name (e.g. "Gemini 3.1 Flash Lite").
 */
export const formatModelDisplayName = (rawModel) => {
  if (!rawModel) return 'Operon';
  if (AI_MODEL_LABELS[rawModel]) return AI_MODEL_LABELS[rawModel];
  return rawModel
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
};

/**
 * Canonical display labels for Speech-to-Text (STT) engines.
 * Single Source of Truth for logging, status pipeline, and telemetry.
 * @constant
 * @type {Readonly<Record<string, string>>}
 */
export const STT_ENGINE_LABELS = Object.freeze({
  addis_ai: 'Addis AI',
  'gemini-3.8-flash': 'Gemini 3.8 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
});

/**
 * Returns user-facing display label for an STT engine identifier.
 * @param {string} [engine]
 * @returns {string} Human-friendly display label (e.g. "Addis AI", "Gemini 3.8 Flash").
 */
export const formatSttEngineDisplayName = (engine) => {
  if (!engine) return 'Addis AI';
  if (STT_ENGINE_LABELS[engine]) return STT_ENGINE_LABELS[engine];
  if (AI_MODEL_LABELS[engine]) return AI_MODEL_LABELS[engine];
  return engine;
};

/**
 * Chat session and AI agent engine constants.
 * @constant
 * @type {Readonly<{
 *   DEFAULT_PERSONA: string,
 *   DEFAULT_MODEL: string,
 *   SUPPORTED_MODELS: string[],
 *   DEFAULT_THINKING_BUDGET: number,
 *   MIN_THINKING_BUDGET: number,
 *   MAX_THINKING_BUDGET: number,
 *   DEFAULT_LANGUAGE: string,
 *   SUPPORTED_LANGUAGES: string[],
 *   DEFAULT_TEMPERATURE: number,
 *   STT_ENGINES: string[],
 *   DEFAULT_STT_ENGINE: string,
 *   TITLE_MAX_LENGTH: number,
 *   MAX_MESSAGE_LENGTH: number,
 *   ATTACHMENTS: typeof ATTACHMENT_CONSTANTS,
 *   AUDIO: typeof AUDIO_CONSTANTS,
 *   PAGE_LIMIT_DEFAULT: number,
 *   PAGE_LIMIT_MIN: number,
 *   PAGE_LIMIT_MAX: number,
 * }>}
 */
export const CHAT_CONSTANTS = Object.freeze({
  DEFAULT_PERSONA:
    'Personal AI Agent and Executive Operations Partner for multi-branch restaurant operations, professional leadership, and personal productivity in Ethiopia',
  DEFAULT_MODEL: AI_MODELS.DEFAULT,
  SUPPORTED_MODELS: AI_MODELS.SUPPORTED,
  DEFAULT_THINKING_BUDGET: 2048,
  MIN_THINKING_BUDGET: 0,
  MAX_THINKING_BUDGET: 8192,
  DEFAULT_LANGUAGE: 'am',
  SUPPORTED_LANGUAGES: ['am', 'en', 'auto'],
  DEFAULT_TEMPERATURE: 0.2,
  STT_ENGINES: AI_MODELS.STT_ENGINES,
  DEFAULT_STT_ENGINE: AI_MODELS.DEFAULT_STT_ENGINE,
  TITLE_MAX_LENGTH: 100,
  MAX_MESSAGE_LENGTH: 10000,
  ATTACHMENTS: ATTACHMENT_CONSTANTS,
  AUDIO: AUDIO_CONSTANTS,
  PAGE_LIMIT_DEFAULT: 20,
  PAGE_LIMIT_MIN: 1,
  PAGE_LIMIT_MAX: 100,
});

/**
 * Centralized Chat Pagination governance constants.
 * Eliminates all hardcoded limit numbers from adapters and queries.
 * @constant
 * @type {Readonly<{ MESSAGES_PAGE_SIZE: number, RECENT_CHATS_PAGE_SIZE: number }>}
 */
export const CHAT_PAGINATION = Object.freeze({
  MESSAGES_PAGE_SIZE: 30,
  RECENT_CHATS_PAGE_SIZE: 20,
});

export default {
  HTTP_STATUS,
  PASSWORD_REGEX,
  EMAIL_REGEX,
  USER_NAME_LENGTH,
  PASSWORD_MIN_LENGTH,
  DEFAULT_POSITION,
  DEFAULT_PAGE_LIMIT,
  APP_NAME,
  APPBAR_MIN_HEIGHT,
  APPBAR_MIN_HEIGHT_SPACING,
  SIDEBAR_FULL_WIDTH,
  SIDEBAR_MINI_WIDTH,
  ROUTES,
  LANDING_ROUTE,
  LOGIN_ROUTE,
  REGISTER_ROUTE,
  DASHBOARD_ROUTE,
  PROFILE_ROUTE,
  LOGIN_REDIRECT_ROUTE,
  CHAT_ROUTE,
  REPORTS_ROUTE,
  REPORT_DETAIL_ROUTE,
  REPORT_EDIT_ROUTE,
  BRANCHES_ROUTE,
  BRANCH_DETAIL_ROUTE,
  AUTH_STATUSES,
  REPORT_CREATION_TBD_MESSAGE,
  LANDING_FEATURES,
  BRANCH_CONSTANTS,
  REPORT_CONSTANTS,
  AUDIO_CONSTANTS,
  ATTACHMENT_CONSTANTS,
  AI_MODELS,
  AI_MODEL_LABELS,
  formatModelDisplayName,
  STT_ENGINE_LABELS,
  formatSttEngineDisplayName,
  CHAT_CONSTANTS,
  CHAT_PAGINATION,
};

