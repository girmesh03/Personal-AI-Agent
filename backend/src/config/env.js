/**
 * @module config/env
 * @description Centralized, validated, and deeply frozen environment configuration.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * List of required environment variable keys that must be defined.
 * @constant
 * @type {readonly string[]}
 */
const REQUIRED_ENV_VARS = Object.freeze([
  'PORT',
  'NODE_ENV',
  'CLIENT_ORIGIN',
  'MONGO_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
]);

/**
 * Validates that all required environment variables are present in process.env.
 * @function validateEnv
 * @param {readonly string[]} requiredVars - Array of required variable names.
 * @throws {Error} If any required variable is missing or empty.
 * @returns {void}
 */
const validateEnv = (requiredVars) => {
  const missing = requiredVars.filter((varName) => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(
      `[FATAL] Missing required environment variables: ${missing.join(', ')}. Please verify your .env file.`
    );
  }
};

validateEnv(REQUIRED_ENV_VARS);

/**
 * Parses a string duration (e.g. '15m', '7d', '24h', '60s') into milliseconds.
 * @function parseDurationToMs
 * @param {string} durationStr - Formatted duration string.
 * @param {number} defaultMs - Fallback millisecond value if parsing fails.
 * @returns {number} Duration in milliseconds.
 */
export const parseDurationToMs = (durationStr, defaultMs) => {
  if (!durationStr || typeof durationStr !== 'string') {
    return defaultMs;
  }
  const match = durationStr.trim().match(/^(\d+)([smhd])$/);
  if (!match) {
    return defaultMs;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return defaultMs;
  }
};

/**
 * Deeply frozen application environment configuration.
 * @constant
 * @type {Readonly<{
 *   PORT: number,
 *   NODE_ENV: string,
 *   CLIENT_ORIGIN: string,
 *   MONGO_URI: string,
 *   JWT_ACCESS_SECRET: string,
 *   JWT_REFRESH_SECRET: string,
 *   JWT_ACCESS_EXPIRES_IN: string,
 *   JWT_REFRESH_EXPIRES_IN: string,
 *   ADDIS_API_KEY: string,
 *   GEMINI_API_KEY: string,
 *   FFMPEG_PATH: string,
 *   FFPROBE_PATH: string,
 *   OAUTH_GOOGLE_CLIENT_ID: string,
 *   OAUTH_GOOGLE_CLIENT_SECRET: string,
 *   OAUTH_GOOGLE_CALLBACK_URL: string
 * }>}
 */
export const env = Object.freeze({
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  MONGO_URI: process.env.MONGO_URI,
  
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,

  ADDIS_API_KEY: process.env.ADDIS_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  
  FFMPEG_PATH: process.env.FFMPEG_PATH || 'C:/ffmpeg/ffmpeg',
  FFPROBE_PATH: process.env.FFPROBE_PATH || 'C:/ffmpeg/ffprobe',

  OAUTH_GOOGLE_CLIENT_ID: process.env.OAUTH_GOOGLE_CLIENT_ID || '',
  OAUTH_GOOGLE_CLIENT_SECRET: process.env.OAUTH_GOOGLE_CLIENT_SECRET || '',
  OAUTH_GOOGLE_CALLBACK_URL: process.env.OAUTH_GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/v1/auth/oauth/google/callback',
});
