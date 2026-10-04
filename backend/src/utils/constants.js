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
  DEFAULT_PURPOSE: 'report_narration',
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
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4',
    'audio/aac',
    'audio/x-aac',
    'audio/webm',
    'audio/ogg',
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
 * Supervisor avatar image constants and MIME whitelist.
 * @constant
 * @type {Readonly<{
 *   MAX_FILE_SIZE_BYTES: number,
 *   ALLOWED_EXTENSIONS: string[],
 *   ALLOWED_MIME_TYPES: string[],
 * }>}
 */
export const AVATAR_CONSTANTS = Object.freeze({
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB avatar limit
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
});

/**
 * Report domain constants, validation rules, and file bounds.
 * Note: Category and severity are permanently purged (issues have text and status only).
 * @constant
 * @type {Readonly<{
 *   TIME_REGEX: RegExp,
 *   ACTIVITY_STATUSES: string[],
 *   DEFAULT_ACTIVITY_STATUS: string,
 *   ISSUE_STATUSES: string[],
 *   DEFAULT_ISSUE_STATUS: string,
 *   MAX_AUDIO_FILES: number,
 *   MAX_AUDIO_FILE_SIZE_BYTES: number,
 *   MAX_AUDIO_BATCH_SIZE_BYTES: number,
 *   MAX_DOCUMENT_FILES: number,
 *   MAX_DOCUMENT_FILE_SIZE_BYTES: number,
 *   MAX_DOCUMENT_BATCH_SIZE_BYTES: number,
 *   ARCHIVE_RETENTION_DAYS: number,
 *   PAGE_LIMIT_DEFAULT: number,
 *   PAGE_LIMIT_MIN: number,
 *   PAGE_LIMIT_MAX: number,
 * }>}
 */
export const REPORT_CONSTANTS = Object.freeze({
  TIME_REGEX: /^([01]\d|2[0-3]):([0-5]\d)$/, // HH:mm format
  ACTIVITY_STATUSES: ['in_progress', 'completed'],
  DEFAULT_ACTIVITY_STATUS: 'completed',
  ISSUE_STATUSES: ['reported', 'completed', 'in_progress', 'no_issue'],
  DEFAULT_ISSUE_STATUS: 'reported',
  MAX_AUDIO_FILES: AUDIO_CONSTANTS.MAX_FILES_COUNT,
  MAX_AUDIO_FILE_SIZE_BYTES: AUDIO_CONSTANTS.MAX_FILE_SIZE_BYTES,
  MAX_AUDIO_BATCH_SIZE_BYTES: AUDIO_CONSTANTS.MAX_BATCH_SIZE_BYTES,
  MAX_DOCUMENT_FILES: ATTACHMENT_CONSTANTS.MAX_FILES_COUNT,
  MAX_DOCUMENT_FILE_SIZE_BYTES: ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES,
  MAX_DOCUMENT_BATCH_SIZE_BYTES: ATTACHMENT_CONSTANTS.MAX_BATCH_SIZE_BYTES,
  ARCHIVE_RETENTION_DAYS: 30,
  PAGE_LIMIT_DEFAULT: 10,
  PAGE_LIMIT_MIN: 1,
  PAGE_LIMIT_MAX: 100,
  ACTIVITY_TEXT_MAX_LENGTH: 1000,
  ISSUE_TEXT_MAX_LENGTH: 1000,
  COMMENT_TEXT_MAX_LENGTH: 2000,
  TRANSCRIPTION_MAX_LENGTH: 50000,
  TEMPLATE_MAX_LENGTH: 4000,
});

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
  DEFAULT_MODEL: 'gemini-2.5-flash',
  SUPPORTED_MODELS: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
  DEFAULT_THINKING_BUDGET: 2048,
  MIN_THINKING_BUDGET: 0,
  MAX_THINKING_BUDGET: 8192,
  DEFAULT_LANGUAGE: 'am',
  SUPPORTED_LANGUAGES: ['am', 'en', 'auto'],
  DEFAULT_TEMPERATURE: 0.2,
  STT_ENGINES: ['addis_ai', 'gemini-2.5-flash'],
  DEFAULT_STT_ENGINE: 'addis_ai',
  TITLE_MAX_LENGTH: 100,
  MAX_MESSAGE_LENGTH: 10000,
  ATTACHMENTS: ATTACHMENT_CONSTANTS,
  AUDIO: AUDIO_CONSTANTS,
  PAGE_LIMIT_DEFAULT: 20,
  PAGE_LIMIT_MIN: 1,
  PAGE_LIMIT_MAX: 100,
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
  REPORT_CONSTANTS,
  CHAT_CONSTANTS,
  AUDIO_CONSTANTS,
  ATTACHMENT_CONSTANTS,
  AVATAR_CONSTANTS,
};


