/**
 * @module utils/avatarUtils
 * @description Centralized supervisor and user avatar URL resolution utility.
 * Guarantees proper URL resolution across Cloudinary CDN, local disk static uploads (/uploads/avatars),
 * Base64 data URLs, and blob/object URLs regardless of hosting domain or Vite proxy.
 */

import { API_BASE_URL } from './constants.js';

/**
 * Resolves an avatar string to a fully-qualified, browser-renderable image URL.
 *
 * @param {string|null|undefined} avatar - Raw avatar field from user profile.
 * @returns {string|null} Resolved absolute URL, CDN URL, or data URL; null if invalid/empty.
 */
export const getAvatarUrl = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return null;
  const trimmed = avatar.trim();
  if (!trimmed) return null;

  // 1. Direct web URLs, base64 data URIs, or temporary client object blobs
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // 2. Local uploads relative path resolution (e.g. /uploads/avatars/avatar-xxx.png)
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const serverOrigin = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
    API_BASE_URL ||
    'http://localhost:4000/api/v1'
  ).replace(/\/api\/v1\/?$/, '');

  return `${serverOrigin}${cleanPath}`;
};

export default {
  getAvatarUrl,
};
