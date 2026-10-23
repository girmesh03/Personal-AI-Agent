/**
 * @module utils/constants
 * @description Centralized application constants and configuration thresholds for backend operations.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, parseDurationToMs } from '../config/env.js';

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Deterministically resolved uploads storage directories.
 * Anchored to backend/uploads/ regardless of process.cwd().
 * @constant
 */
export const UPLOADS_CONFIG = Object.freeze({
  ROOT_DIR: path.resolve(BACKEND_ROOT, 'uploads'),
  AUDIOS_DIR: path.resolve(BACKEND_ROOT, 'uploads/audios'),
  ATTACHMENTS_DIR: path.resolve(BACKEND_ROOT, 'uploads/attachments'),
  TEMP_DIR: path.resolve(BACKEND_ROOT, 'uploads/temp'),
});

/**
 * Centralized AI Model governance and identifiers.
 * Single Source of Truth for Gemini models, quota failover mappings, and STT engines.
 * @constant
 */
export const AI_MODELS = Object.freeze({
  DEFAULT: 'gemini-3.1-flash-lite',
  FALLBACK: 'gemini-3-flash-preview',
  PRO: 'gemini-3.8-flash',
  SUPPORTED: Object.freeze([
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
  ]),
  QUOTA_RETRY_MAP: Object.freeze({
    'gemini-3.8-flash': 'gemini-3.5-flash',
    'gemini-3.1-flash-lite': 'gemini-3-flash-preview',
    'gemini-3-flash-preview': 'gemini-3.5-flash',
    'gemini-3.5-flash': 'gemini-3.1-flash-lite',
  }),
  STT_ENGINES: Object.freeze(['addis_ai', 'gemini-3.8-flash', 'gemini-3.1-flash-lite']),
  DEFAULT_STT_ENGINE: 'addis_ai',
  DEFAULT_AUDIO_CHUNKER_MODEL: 'gemini-3.1-flash-lite',
});

/**
 * Canonical display labels for AI models.
 * Single Source of Truth for logging, telemetry, and reporting.
 * @constant
 * @type {Readonly<Record<string, string>>}
 */
export const AI_MODEL_LABELS = Object.freeze({
  [AI_MODELS.DEFAULT]: 'Gemini 3.1 Flash Lite',
  [AI_MODELS.PRO]: 'Gemini 3.8 Flash',
  [AI_MODELS.FALLBACK]: 'Gemini 3 Flash Preview',
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
});

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
 * Returns human-friendly display name for an AI model identifier.
 * @param {string} [rawModel]
 * @returns {string} User-facing model name (e.g. "Gemini 3.1 Flash Lite").
 */
export const formatModelDisplayName = (rawModel) => {
  if (!rawModel) return 'Operon';
  if (AI_MODEL_LABELS[rawModel]) return AI_MODEL_LABELS[rawModel];
  return rawModel;
};

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
  UNAUTHORIZED: 401,
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
 * Eliminates all hardcoded limit numbers from controllers, queries, and adapters.
 * @constant
 */
export const CHAT_PAGINATION = Object.freeze({
  DEFAULT_MESSAGES_LIMIT: 30,
  MAX_MESSAGES_LIMIT: 100,
  DEFAULT_RECENT_CHATS_LIMIT: 20,
  MAX_RECENT_CHATS_LIMIT: 50,
});

/**
 * Telegram integration constants, channels, limits, and image card styling metrics.
 * @constant
 * @type {Readonly<{
 *   MAX_MESSAGE_LENGTH: number,
 *   MAX_CAPTION_LENGTH: number,
 *   MAX_PHOTO_SIZE_BYTES: number,
 *   MAX_DOCUMENT_SIZE_BYTES: number,
 *   CHANNELS: readonly string[],
 *   FORMATS: readonly string[],
 *   DEFAULT_FORMAT: string,
 *   RATE_LIMIT: Readonly<{ MAX_PER_MINUTE_GROUP: number, RETRY_AFTER_DEFAULT_SEC: number }>,
 *   IMAGE_CARD: Readonly<{
 *     WIDTH: number,
 *     PADDING_X: number,
 *     BASE_FONT_SIZE: number,
 *     SECTION_FONT_SIZE: number,
 *     LINE_HEIGHT: number,
 *     SECTION_TOP_GAP: number,
 *     SECTION_BOTTOM_GAP: number,
 *     INTER_BULLET_GAP: number,
 *     BULLET_RADIUS: number,
 *     BULLET_INDENT: number,
 *     FONT_FAMILY: string,
 *     BG_COLOR: string,
 *     TEXT_COLOR: string,
 *   }>
 * }>}
 */
export const TELEGRAM_CONSTANTS = Object.freeze({
  MAX_MESSAGE_LENGTH: 4096,
  MAX_CAPTION_LENGTH: 1024,
  MAX_PHOTO_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_DOCUMENT_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  CHANNELS: Object.freeze(['management', 'maintenance', 'general']),
  FORMATS: Object.freeze(['text', 'image']),
  DEFAULT_FORMAT: 'text',
  RATE_LIMIT: Object.freeze({
    MAX_PER_MINUTE_GROUP: 20,
    RETRY_AFTER_DEFAULT_SEC: 5,
  }),
  IMAGE_CARD: Object.freeze({
    WIDTH: 1440,
    PADDING_X: 85,
    BASE_FONT_SIZE: 38,
    SECTION_FONT_SIZE: 44,
    LINE_HEIGHT: 48,
    SECTION_TOP_GAP: 24,
    SECTION_BOTTOM_GAP: 10,
    PARAGRAPH_GAP: 16,
    INTER_BULLET_GAP: 14,
    BULLET_RADIUS: 7,
    BULLET_INDENT: 32,
    FONT_FAMILY: '"Noto Sans Ethiopic", "Abyssinica SIL", "Nyala", "Segoe UI", Arial, sans-serif',
    BG_COLOR: '#FFFFFF',
    TEXT_COLOR: '#000000',
  }),
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
  CHAT_PAGINATION,
  TELEGRAM_CONSTANTS,
  AUDIO_CONSTANTS,
  ATTACHMENT_CONSTANTS,
  AVATAR_CONSTANTS,
  AI_MODELS,
  AI_MODEL_LABELS,
  STT_ENGINE_LABELS,
  formatModelDisplayName,
  formatSttEngineDisplayName,
  UPLOADS_CONFIG,
};


