/**
 * @module services/storageService
 * @description Cloud storage abstraction adapter powering persistent asset storage via Cloudinary
 * with automatic fallback to local filesystem and an exhaustive 8-vector lifecycle cleanup engine.
 *
 * Capabilities:
 * 1. Zero-dependency native REST communication via Node fetch and crypto (SHA-1 signature).
 * 2. Multi-resource type classification: 'image', 'video' (audios), 'raw' (documents).
 * 3. Permanent CDN delivery avoiding Render ephemeral filesystem data loss on restart.
 * 4. 8-Vector Lifecycle Cleanup Engine to aggressively preserve the free tier 25GB quota.
 * 5. Resilient error handling adhering to the Zero-Crash Invariant.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import logger from '../config/logger.js';
import { UPLOADS_CONFIG } from '../utils/constants.js';
import Audio from '../models/Audio.js';

/**
 * Checks if Cloudinary credentials are fully defined in the environment.
 * @returns {boolean}
 */
export const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

/**
 * Derives the Cloudinary resource_type ('image' | 'video' | 'raw') based on MIME type or file extension.
 * In Cloudinary REST API, audio files MUST be uploaded under resource_type 'video'.
 *
 * @param {string} [mimeType='']
 * @param {string} [fileName='']
 * @returns {'image' | 'video' | 'raw'}
 */
export const inferResourceType = (mimeType = '', fileName = '') => {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();

  if (
    mime.startsWith('audio/') ||
    mime.includes('webm') ||
    name.endsWith('.wav') ||
    name.endsWith('.mp3') ||
    name.endsWith('.m4a') ||
    name.endsWith('.aac') ||
    name.endsWith('.ogg') ||
    name.endsWith('.webm')
  ) {
    return 'video';
  }

  if (
    mime.startsWith('image/') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp') ||
    name.endsWith('.gif') ||
    name.endsWith('.svg')
  ) {
    return 'image';
  }

  return 'raw';
};

/**
 * Computes the Cloudinary SHA-1 authentication signature for signed REST operations.
 *
 * @param {Record<string, string|number>} params - Key-value parameters to sign.
 * @param {string} apiSecret - Cloudinary API secret.
 * @returns {string} SHA-1 hex digest.
 */
const generateSignature = (params, apiSecret) => {
  const sortedKeys = Object.keys(params).sort();
  const signatureString = sortedKeys
    .map((k) => `${k}=${params[k]}`)
    .join('&') + apiSecret;

  return crypto.createHash('sha1').update(signatureString).digest('hex');
};

/**
 * Uploads a local file or buffer to Cloudinary CDN.
 * Falls back to local disk storage representation if Cloudinary is not configured.
 *
 * @param {object} options
 * @param {string} [options.filePath] - Absolute path on disk.
 * @param {Buffer} [options.buffer] - Raw memory buffer (optional alternative to filePath).
 * @param {string} [options.fileName] - Original or designated filename.
 * @param {string} [options.mimeType] - File MIME type.
 * @param {string} [options.folder='personal-agent/general'] - Cloudinary folder prefix.
 * @param {'image' | 'video' | 'raw'} [options.resourceType] - Cloudinary resource type override.
 * @returns {Promise<{ url: string, secure_url: string, publicId: string|null, bytes: number, format: string, resourceType: string, isCloud: boolean }>}
 */
export const uploadFile = async ({
  filePath,
  buffer,
  fileName = 'file',
  mimeType = 'application/octet-stream',
  folder = 'personal-agent/general',
  resourceType,
}) => {
  if (!isCloudinaryConfigured()) {
    // Local disk fallback
    const localBytes = buffer ? buffer.length : (filePath && fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);
    const localUrl = filePath
      ? `/uploads/${path.basename(path.dirname(filePath))}/${path.basename(filePath)}`
      : `/uploads/general/${fileName}`;

    return {
      url: localUrl,
      secure_url: localUrl,
      publicId: null,
      bytes: localBytes,
      format: path.extname(fileName).replace(/^\./, ''),
      resourceType: resourceType || inferResourceType(mimeType, fileName),
      isCloud: false,
    };
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const targetResourceType = resourceType || inferResourceType(mimeType, fileName);
  const fileBytes = buffer || (filePath ? await fs.promises.readFile(filePath) : null);

  if (!fileBytes || fileBytes.length === 0) {
    throw new Error(`Cannot upload empty file "${fileName}" to Cloudinary.`);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signParams = {
    folder,
    timestamp,
  };

  const signature = generateSignature(signParams, apiSecret);

  const formData = new FormData();
  formData.append('file', new Blob([fileBytes], { type: mimeType }), fileName);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('folder', folder);
  formData.append('signature', signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${targetResourceType}/upload`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(`Cloudinary upload failed: ${data.error?.message || res.statusText}`);
    }

    logger.info(`[storageService] Uploaded asset to Cloudinary: ${data.public_id} (${data.bytes} bytes, ${targetResourceType})`);

    return {
      url: data.secure_url || data.url,
      secure_url: data.secure_url || data.url,
      publicId: data.public_id,
      bytes: data.bytes,
      format: data.format,
      resourceType: data.resource_type || targetResourceType,
      isCloud: true,
    };
  } catch (err) {
    logger.error(`[storageService] Cloudinary upload error for "${fileName}": ${err.message}`);
    // If local path exists, graceful fallback to local representation
    if (filePath && fs.existsSync(filePath)) {
      return {
        url: `/uploads/${path.basename(path.dirname(filePath))}/${path.basename(filePath)}`,
        secure_url: `/uploads/${path.basename(path.dirname(filePath))}/${path.basename(filePath)}`,
        publicId: null,
        bytes: fileBytes.length,
        format: path.extname(fileName).replace(/^\./, ''),
        resourceType: targetResourceType,
        isCloud: false,
      };
    }
    throw err;
  }
};

/**
 * Destroys a single asset from Cloudinary by its publicId.
 * Adheres strictly to Zero-Crash Invariant: suppresses network failures and logs cleanly.
 *
 * @param {string} publicId - Cloudinary public identifier.
 * @param {'image' | 'video' | 'raw' | 'auto'} [resourceType='auto'] - Cloudinary resource type.
 * @returns {Promise<{ result: string }>}
 */
export const destroyFile = async (publicId, resourceType = 'auto') => {
  if (!publicId || !isCloudinaryConfigured()) {
    return { result: 'skipped' };
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const typesToTry = resourceType === 'auto'
    ? ['video', 'image', 'raw']
    : [resourceType];

  for (const type of typesToTry) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const signParams = {
        public_id: publicId,
        timestamp,
      };
      const signature = generateSignature(signParams, apiSecret);

      const formData = new FormData();
      formData.append('public_id', publicId);
      formData.append('api_key', apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signature);

      const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${type}/destroy`;
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.result === 'ok') {
        logger.info(`[storageService] Purged Cloudinary asset: ${publicId} (type: ${type})`);
        return { result: 'ok' };
      }
    } catch (err) {
      logger.warn(`[storageService] Cloudinary destroy attempt failed for ${publicId} (${type}): ${err.message}`);
    }
  }

  return { result: 'not_found_or_already_purged' };
};

/**
 * Destroys multiple Cloudinary assets in parallel.
 *
 * @param {Array<{ publicId: string, resourceType?: string } | string>} items
 * @returns {Promise<void>}
 */
export const batchDestroyFiles = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0 || !isCloudinaryConfigured()) {
    return;
  }

  const tasks = items
    .filter(Boolean)
    .map((item) => {
      const publicId = typeof item === 'string' ? item : item.publicId;
      const resourceType = typeof item === 'object' && item.resourceType ? item.resourceType : 'auto';
      return destroyFile(publicId, resourceType);
    });

  await Promise.allSettled(tasks);
};

// =============================================================================
// THE 8-VECTOR LIFECYCLE CLEANUP ENGINE (DUAL-TIER PARITY: CLOUDINARY + LOCAL DISK)
// =============================================================================

/**
 * Safely unlinks a file from the local filesystem with multi-directory resolution
 * and strict test fixture protection.
 *
 * @param {string} filePathOrName - Absolute path, relative path, or file name.
 * @param {string} [domainDir] - Optional specific directory hint.
 * @returns {boolean} True if a file was found and unlinked.
 */
export const safeUnlinkDiskFile = (filePathOrName, domainDir = null) => {
  if (!filePathOrName || typeof filePathOrName !== 'string') return false;

  const baseName = path.basename(filePathOrName);
  // Strictly protect committed fixtures and sample files
  if (
    baseName.startsWith('sample-') ||
    baseName.includes('-sample-') ||
    baseName.endsWith('-sample') ||
    baseName === 'sample-report.wav' ||
    baseName === 'sample-voice.mp3' ||
    baseName === 'sample-doc.pdf' ||
    baseName === 'sample-image.png'
  ) {
    return false;
  }

  // 1. Direct absolute path or exact relative path check
  const pathsToCheck = [];
  if (path.isAbsolute(filePathOrName)) {
    pathsToCheck.push(filePathOrName);
  } else {
    // Relative to process.cwd()
    const relativeClean = filePathOrName.replace(/^[\\/]+/, '');
    pathsToCheck.push(path.resolve(process.cwd(), relativeClean));
    if (!relativeClean.startsWith('backend/')) {
      pathsToCheck.push(path.resolve(process.cwd(), 'backend', relativeClean));
    }
  }

  // 2. Candidate domain directories for baseName
  const candidateDirs = [
    domainDir,
    UPLOADS_CONFIG.IMAGES_DIR,
    UPLOADS_CONFIG.FILES_DIR,
    UPLOADS_CONFIG.AUDIOS_DIR,
    UPLOADS_CONFIG.ATTACHMENTS_DIR,
    UPLOADS_CONFIG.AVATARS_DIR,
    UPLOADS_CONFIG.TEMP_DIR,
    UPLOADS_CONFIG.GENERATED_DOCUMENTS_DIR,
    UPLOADS_CONFIG.ROOT_DIR,
  ].filter(Boolean);

  for (const dir of candidateDirs) {
    pathsToCheck.push(path.join(dir, baseName));
  }

  // If baseName has no extension (e.g. raw Cloudinary publicId suffix), search prefix matches
  if (!path.extname(baseName) && baseName.length >= 8) {
    for (const dir of candidateDirs) {
      if (fs.existsSync(dir)) {
        try {
          const dirFiles = fs.readdirSync(dir);
          for (const df of dirFiles) {
            if (df.startsWith(baseName) && !df.startsWith('sample-')) {
              pathsToCheck.push(path.join(dir, df));
            }
          }
        } catch (_) {}
      }
    }
  }

  let unlinked = false;
  const seenPaths = new Set();
  for (const p of pathsToCheck) {
    const normalized = path.normalize(p);
    if (seenPaths.has(normalized)) continue;
    seenPaths.add(normalized);

    try {
      if (fs.existsSync(normalized)) {
        const stats = fs.statSync(normalized);
        if (stats.isFile()) {
          fs.unlinkSync(normalized);
          logger.info(`[storageService] Unlinked local disk file: ${normalized}`);
          unlinked = true;
        }
      }
    } catch (err) {
      logger.warn(`[storageService] Failed to unlink disk file ${normalized}: ${err.message}`);
    }
  }

  return unlinked;
};

/**
 * Vector 1: Chat Session Deletion.
 * Purges all attachment files and private session audios from Cloudinary AND unlinks local disk files.
 *
 * @param {object} chat - Chat document.
 * @returns {Promise<number>} Count of purged assets.
 */
export const cleanupChatAssets = async (chat) => {
  if (!chat || !Array.isArray(chat.messages)) return 0;

  const targets = [];
  const audioIds = [];
  const diskFiles = [];

  for (const msg of chat.messages) {
    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        if (att.publicId) {
          targets.push({ publicId: att.publicId, resourceType: inferResourceType(att.mimeType, att.fileName) });
          diskFiles.push(att.publicId);
        }
        if (att.path) diskFiles.push(att.path);
        if (att.fileName) diskFiles.push(att.fileName);
      }
    }
    if (Array.isArray(msg.audios)) {
      for (const aud of msg.audios) {
        const id = typeof aud === 'object' && aud !== null ? (aud._id || aud.id) : aud;
        if (id) audioIds.push(id);
      }
    }
  }

  if (targets.length > 0) {
    await batchDestroyFiles(targets);
  }
  for (const f of diskFiles) {
    safeUnlinkDiskFile(f);
  }
  if (audioIds.length > 0) {
    await cleanupAudiosById(audioIds);
  }

  return targets.length + audioIds.length + diskFiles.length;
};

/**
 * Vector 2: Turn Edit Pruning & Turn Edit Delta Purging.
 * Destroys assets belonging to downstream turns or removed turn assets from Cloudinary AND local disk.
 *
 * @param {Array<object>} prunedMessages - Array of pruned message turn objects.
 * @returns {Promise<number>} Count of purged assets.
 */
export const cleanupPrunedTurnAssets = async (prunedMessages = []) => {
  if (!Array.isArray(prunedMessages) || prunedMessages.length === 0) return 0;

  const targets = [];
  const audioIds = [];
  const diskFiles = [];

  for (const msg of prunedMessages) {
    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        if (att.publicId) {
          targets.push({ publicId: att.publicId, resourceType: inferResourceType(att.mimeType, att.fileName) });
          diskFiles.push(att.publicId);
        }
        if (att.path) diskFiles.push(att.path);
        if (att.fileName) diskFiles.push(att.fileName);
      }
    }
    if (Array.isArray(msg.audios)) {
      for (const aud of msg.audios) {
        const id = typeof aud === 'object' && aud !== null ? (aud._id || aud.id) : aud;
        if (id) audioIds.push(id);
      }
    }
  }

  if (targets.length > 0) {
    await batchDestroyFiles(targets);
  }
  for (const f of diskFiles) {
    safeUnlinkDiskFile(f);
  }
  if (audioIds.length > 0) {
    await cleanupAudiosById(audioIds);
  }

  return targets.length + audioIds.length + diskFiles.length;
};

/**
 * Vector 3: Turn Retry Cleanup.
 * Destroys assets attached to a retried turn if discarded from Cloudinary AND local disk.
 *
 * @param {object} userTurn - The user message turn being retried.
 * @returns {Promise<void>}
 */
export const cleanupRetryTurnAssets = async (userTurn) => {
  if (!userTurn) return;
  const targets = [];
  const diskFiles = [];
  if (Array.isArray(userTurn.attachments)) {
    for (const a of userTurn.attachments) {
      if (a.publicId) {
        targets.push({ publicId: a.publicId, resourceType: inferResourceType(a.mimeType, a.fileName) });
        diskFiles.push(a.publicId);
      }
      if (a.path) diskFiles.push(a.path);
      if (a.fileName) diskFiles.push(a.fileName);
    }
  }
  if (targets.length > 0) {
    await batchDestroyFiles(targets);
  }
  for (const f of diskFiles) {
    safeUnlinkDiskFile(f);
  }
  if (Array.isArray(userTurn.audios) && userTurn.audios.length > 0) {
    const audioIds = userTurn.audios
      .map((a) => (typeof a === 'object' && a !== null ? (a._id || a.id) : a))
      .filter(Boolean);
    if (audioIds.length > 0) {
      await cleanupAudiosById(audioIds);
    }
  }
};

/**
 * Vector 5 / Extension: Audio ID Batch Cleanup.
 * Completely purges audio records from Cloudinary CDN, local filesystem disk, and MongoDB.
 *
 * @param {Array<string|object>} audioIds - Array of Audio ObjectId strings or subdocuments.
 * @returns {Promise<number>} Count of purged audio assets.
 */
export const cleanupAudiosById = async (audioIds = []) => {
  if (!Array.isArray(audioIds) || audioIds.length === 0) return 0;

  const validIds = audioIds
    .map((id) => (typeof id === 'object' && id !== null ? (id._id || id.id) : id))
    .filter(Boolean)
    .map(String)
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (validIds.length === 0) return 0;

  try {
    const audioDocs = await Audio.find({ _id: { $in: validIds } }).select('publicId fileName path');
    const targets = [];
    const diskPaths = [];

    for (const doc of audioDocs) {
      if (doc.publicId) {
        targets.push({ publicId: doc.publicId, resourceType: 'video' });
      }
      if (doc.path) {
        diskPaths.push(doc.path);
      }
      if (doc.fileName) {
        diskPaths.push(doc.fileName);
      }
    }

    if (targets.length > 0) {
      await batchDestroyFiles(targets);
    }

    for (const p of diskPaths) {
      safeUnlinkDiskFile(p, UPLOADS_CONFIG.AUDIOS_DIR);
    }

    await Audio.deleteMany({ _id: { $in: validIds } });
    return audioDocs.length;
  } catch (err) {
    logger.warn(`[storageService] cleanupAudiosById failed: ${err.message}`);
    return 0;
  }
};

/**
 * Vector 4: Composer Shelf Dismissal.
 * Directly destroys a single uploaded attachment if user removes it before sending from Cloudinary AND local disk.
 *
 * @param {string} publicId - Attachment Cloudinary public ID.
 * @param {string} [mimeType='']
 * @param {string} [fileName='']
 * @param {string} [localPath='']
 * @returns {Promise<{ result: string }>}
 */
export const cleanupComposerAttachment = async (publicId, mimeType = '', fileName = '', localPath = '') => {
  let destroyRes = { result: 'noop' };
  if (publicId) {
    const resourceType = inferResourceType(mimeType, fileName);
    destroyRes = await destroyFile(publicId, resourceType);
    safeUnlinkDiskFile(publicId);
  }
  if (fileName) {
    safeUnlinkDiskFile(fileName);
  }
  if (localPath) {
    safeUnlinkDiskFile(localPath);
  }
  return destroyRes;
};

/**
 * Vector 6: Avatar Replacement / Removal.
 * Purges old user profile avatar from Cloudinary AND local disk.
 *
 * @param {string} avatarPublicId
 * @param {string} [avatarPathOrUrl='']
 * @returns {Promise<void>}
 */
export const cleanupAvatarAsset = async (avatarPublicId, avatarPathOrUrl = '') => {
  if (avatarPublicId) {
    await destroyFile(avatarPublicId, 'image');
    safeUnlinkDiskFile(avatarPublicId, UPLOADS_CONFIG.AVATARS_DIR);
  }
  if (avatarPathOrUrl) {
    safeUnlinkDiskFile(avatarPathOrUrl, UPLOADS_CONFIG.AVATARS_DIR);
  }
};

/**
 * Vector 7: Permanent Report Deletion.
 * Purges evidentiary audio files associated with an archived report from Cloudinary AND local disk.
 *
 * @param {Array<object>} audios - Array of Audio documents or references.
 * @returns {Promise<number>}
 */
export const cleanupReportAudios = async (audios = []) => {
  if (!Array.isArray(audios) || audios.length === 0) return 0;
  const targets = [];
  const diskFiles = [];
  for (const a of audios) {
    if (a?.publicId) {
      targets.push({ publicId: a.publicId, resourceType: 'video' });
      diskFiles.push(a.publicId);
    }
    if (a?.path) diskFiles.push(a.path);
    if (a?.fileName) diskFiles.push(a.fileName);
  }

  if (targets.length > 0) {
    await batchDestroyFiles(targets);
  }
  for (const f of diskFiles) {
    safeUnlinkDiskFile(f, UPLOADS_CONFIG.AUDIOS_DIR);
  }
  return targets.length;
};

/**
 * Vector 8: User Account Cascade Deletion.
 * Purges all user avatars, chat attachments, and private audios from Cloudinary AND local disk.
 *
 * @param {object} user - User document.
 * @param {Array<object>} userChats - All chat documents belonging to user.
 * @param {Array<object>} userAudios - All audio documents belonging to user.
 * @returns {Promise<void>}
 */
export const cleanupUserCascadeAssets = async (user, userChats = [], userAudios = []) => {
  const targets = [];
  const diskFiles = [];

  if (user?.avatarPublicId) {
    targets.push({ publicId: user.avatarPublicId, resourceType: 'image' });
    diskFiles.push(user.avatarPublicId);
  }
  if (user?.avatar) {
    diskFiles.push(user.avatar);
  }

  for (const chat of userChats) {
    if (Array.isArray(chat.messages)) {
      for (const msg of chat.messages) {
        if (Array.isArray(msg.attachments)) {
          for (const att of msg.attachments) {
            if (att.publicId) {
              targets.push({ publicId: att.publicId, resourceType: inferResourceType(att.mimeType, att.fileName) });
              diskFiles.push(att.publicId);
            }
            if (att.path) diskFiles.push(att.path);
            if (att.fileName) diskFiles.push(att.fileName);
          }
        }
      }
    }
  }

  for (const aud of userAudios) {
    if (aud?.publicId) {
      targets.push({ publicId: aud.publicId, resourceType: 'video' });
      diskFiles.push(aud.publicId);
    }
    if (aud?.path) diskFiles.push(aud.path);
    if (aud?.fileName) diskFiles.push(aud.fileName);
  }

  if (targets.length > 0) {
    await batchDestroyFiles(targets);
  }
  for (const f of diskFiles) {
    safeUnlinkDiskFile(f);
  }
};

export default {
  isCloudinaryConfigured,
  inferResourceType,
  uploadFile,
  destroyFile,
  batchDestroyFiles,
  safeUnlinkDiskFile,
  cleanupChatAssets,
  cleanupPrunedTurnAssets,
  cleanupRetryTurnAssets,
  cleanupAudiosById,
  cleanupComposerAttachment,
  cleanupAvatarAsset,
  cleanupReportAudios,
  cleanupUserCascadeAssets,
};
