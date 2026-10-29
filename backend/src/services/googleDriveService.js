/**
 * @module services/googleDriveService
 * @description Enterprise Dual-Mode Google Workspace Integration Engine.
 * Supports native Google Drive (v3), Google Docs (v1), and Google Sheets (v4)
 * with atomic concurrency-safe token refresh mutex, default 'Personal AI Agent' root folder
 * lazy auto-provisioning, and high-fidelity Mock fallback for isolated automated testing.
 */

import { google } from 'googleapis';
import fs from 'fs';
import { User } from '../models/User.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { BadRequestError, NotFoundError } from '../errors/CustomError.js';

const DEFAULT_ROOT_FOLDER_NAME = 'Personal AI Agent';
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// In-memory token refresh mutex lock per user ID to prevent race conditions
const tokenRefreshLocks = new Map();

// In-memory virtual drive store for mock provider (userId -> { files: Map<fileId, FileObject> })
const mockDriveStore = new Map();

/**
 * Initializes the OAuth2 Client using environment configuration.
 *
 * @returns {import('googleapis').Auth.OAuth2Client}
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    env.OAUTH_GOOGLE_CLIENT_ID,
    env.OAUTH_GOOGLE_CLIENT_SECRET,
    env.OAUTH_GOOGLE_CALLBACK_URL
  );
}

/**
 * Generates Google OAuth 2.0 Authorization URL.
 *
 * @param {string} state - Cryptographically signed or base64 state token.
 * @returns {string}
 */
export function getAuthorizationUrl(state) {
  const oauth2Client = createOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state,
  });
}

/**
 * Exchanges authorization code for tokens and persists to user record.
 *
 * @param {string} userId - User ObjectId.
 * @param {string} code - OAuth authorization code.
 * @returns {Promise<object>} Integration profile.
 */
export async function exchangeCodeAndSaveTokens(userId, code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Retrieve user email from Google OAuth2 API
  let email = null;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    email = userInfo.data.email;
  } catch (err) {
    logger.warn(`[googleDriveService] Could not fetch user email: ${err.message}`);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  if (!user.integrations) {
    user.integrations = {};
  }

  user.integrations.googleDrive = {
    connected: true,
    enabled: true,
    email: email || user.email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || (user.integrations.googleDrive?.refreshToken || null),
    expiryDate: tokens.expiry_date,
    scope: tokens.scope ? tokens.scope.split(' ') : [],
    rootFolderId: user.integrations.googleDrive?.rootFolderId || null,
    connectedAt: new Date(),
  };

  await user.save();
  return {
    connected: true,
    email: user.integrations.googleDrive.email,
    connectedAt: user.integrations.googleDrive.connectedAt,
    rootFolderId: user.integrations.googleDrive.rootFolderId,
  };
}

/**
 * Disconnects the Google Drive integration for a user.
 *
 * @param {string} userId - User ObjectId.
 * @returns {Promise<boolean>}
 */
export async function disconnectGoogleDrive(userId) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found.');

  if (user.integrations?.googleDrive) {
    user.integrations.googleDrive.connected = false;
    user.integrations.googleDrive.enabled = true;
    user.integrations.googleDrive.accessToken = null;
    user.integrations.googleDrive.refreshToken = null;
    user.integrations.googleDrive.expiryDate = null;
    user.integrations.googleDrive.email = null;
    user.integrations.googleDrive.rootFolderId = null;
    await user.save();
  }

  mockDriveStore.delete(String(userId));
  return true;
}

/**
 * Returns an authenticated, auto-refreshed OAuth2 client or mock client descriptor.
 * Uses mutex locking to ensure concurrent requests do not trigger multiple refresh calls.
 *
 * @param {string} userId - User ObjectId.
 * @returns {Promise<{ isMock: boolean, authClient?: import('googleapis').Auth.OAuth2Client, user: object }>}
 */
export async function getValidGoogleClient(userId) {
  const user = await User.findById(userId).select(
    '+integrations.googleDrive.accessToken +integrations.googleDrive.refreshToken +integrations.googleDrive.expiryDate'
  );

  if (!user) {
    throw new NotFoundError('User not found.');
  }

  const integration = user.integrations?.googleDrive;
  if (!integration || !integration.connected) {
    throw new BadRequestError(
      'Google Drive is not connected. Please connect your Google account in Settings.'
    );
  }

  if (integration.enabled === false) {
    throw new BadRequestError(
      'Google Drive integration is temporarily disabled in your Settings. Please re-enable it in Settings to allow cloud operations.'
    );
  }

  // Detect Mock Mode
  const isMock =
    integration.accessToken?.startsWith('mock_') ||
    process.env.MOCK_GOOGLE_DRIVE === 'true' ||
    !env.OAUTH_GOOGLE_CLIENT_ID;

  if (isMock) {
    if (!mockDriveStore.has(String(userId))) {
      const rootId = integration.rootFolderId || 'mock_root_folder_id_' + userId;
      mockDriveStore.set(String(userId), {
        files: new Map([
          [
            rootId,
            {
              id: rootId,
              name: DEFAULT_ROOT_FOLDER_NAME,
              mimeType: 'application/vnd.google-apps.folder',
              parents: ['root'],
              webViewLink: `https://drive.google.com/drive/folders/${rootId}`,
              createdTime: new Date().toISOString(),
              modifiedTime: new Date().toISOString(),
            },
          ],
        ]),
      });
    }
    return { isMock: true, user };
  }

  // Real OAuth2 Token Lifecycle with Concurrency Mutex
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
    expiry_date: integration.expiryDate,
  });

  const now = Date.now();
  const isExpiringSoon = integration.expiryDate && integration.expiryDate - now < REFRESH_THRESHOLD_MS;

  if (isExpiringSoon && integration.refreshToken) {
    // Check if refresh is already in flight for this user
    let refreshPromise = tokenRefreshLocks.get(String(userId));
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          logger.info(`[googleDriveService] Refreshing Google OAuth token for user ${userId}...`);
          const { credentials } = await oauth2Client.refreshAccessToken();
          oauth2Client.setCredentials(credentials);

          await User.updateOne(
            { _id: userId },
            {
              $set: {
                'integrations.googleDrive.accessToken': credentials.access_token,
                'integrations.googleDrive.expiryDate': credentials.expiry_date,
                ...(credentials.refresh_token
                  ? { 'integrations.googleDrive.refreshToken': credentials.refresh_token }
                  : {}),
              },
            }
          );
          logger.info(`[googleDriveService] Successfully refreshed Google OAuth token for user ${userId}.`);
        } catch (refreshErr) {
          logger.error(`[googleDriveService] Failed to refresh Google OAuth token: ${refreshErr.message}`);
          const isRevokedOrInvalid =
            refreshErr.message?.includes('invalid_grant') ||
            refreshErr.response?.data?.error === 'invalid_grant' ||
            refreshErr.message?.includes('revoked');
          if (isRevokedOrInvalid) {
            await User.updateOne(
              { _id: userId },
              { $set: { 'integrations.googleDrive.connected': false } }
            );
          }
          throw new BadRequestError(
            'Google Drive authentication expired or was revoked. Please reconnect your Google account in Settings.'
          );
        } finally {
          tokenRefreshLocks.delete(String(userId));
        }
      })();
      tokenRefreshLocks.set(String(userId), refreshPromise);
    }
    await refreshPromise;
  }

  return { isMock: false, authClient: oauth2Client, user };
}

/**
 * Ensures the default 'Personal AI Agent' root folder exists in the user's Google Drive.
 *
 * @param {string} userId - User ObjectId.
 * @param {object} clientInfo - Output from getValidGoogleClient.
 * @returns {Promise<string>} Root folder ID.
 */
export async function ensureRootFolder(userId, clientInfo) {
  const { isMock, authClient, user } = clientInfo;
  if (user.integrations?.googleDrive?.rootFolderId) {
    return user.integrations.googleDrive.rootFolderId;
  }

  if (isMock) {
    const rootId = 'mock_root_folder_id_' + userId;
    const store = mockDriveStore.get(String(userId));
    if (store && !store.files.has(rootId)) {
      store.files.set(rootId, {
        id: rootId,
        name: DEFAULT_ROOT_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root'],
        webViewLink: `https://drive.google.com/drive/folders/${rootId}`,
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
      });
    }
    await User.updateOne(
      { _id: userId },
      { $set: { 'integrations.googleDrive.rootFolderId': rootId } }
    );
    return rootId;
  }

  const drive = google.drive({ version: 'v3', auth: authClient });
  // Check if folder already exists in Drive root
  const query = `name = '${DEFAULT_ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  let folderId = res.data.files?.[0]?.id;
  if (!folderId) {
    const createRes = await drive.files.create({
      requestBody: {
        name: DEFAULT_ROOT_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root'],
      },
      fields: 'id',
    });
    folderId = createRes.data.id;
    logger.info(`[googleDriveService] Created root folder '${DEFAULT_ROOT_FOLDER_NAME}' (${folderId}) for user ${userId}.`);
  }

  await User.updateOne(
    { _id: userId },
    { $set: { 'integrations.googleDrive.rootFolderId': folderId } }
  );

  return folderId;
}

/**
 * Universal manage_google_drive Tool Handler.
 * Supports: 'list' | 'create_folder' | 'search' | 'get_metadata' | 'share'.
 *
 * @param {string} userId - User ObjectId.
 * @param {object} args - Tool arguments.
 * @returns {Promise<object>}
 */
export async function manageGoogleDrive(userId, args = {}) {
  const { action = 'list', folderName, query, folderId, fileId, role = 'reader', emailAddress } = args;
  const clientInfo = await getValidGoogleClient(userId);
  const defaultFolderId = await ensureRootFolder(userId, clientInfo);

  if (clientInfo.isMock) {
    return handleMockManageDrive(userId, {
      action,
      folderName,
      query,
      folderId: folderId || defaultFolderId,
      fileId,
      role,
      emailAddress,
    });
  }

  const drive = google.drive({ version: 'v3', auth: clientInfo.authClient });

  switch (action) {
    case 'create_folder': {
      if (!folderName || typeof folderName !== 'string') {
        throw new BadRequestError('folderName is required to create a folder.');
      }
      const parentId = folderId || defaultFolderId;
      const res = await drive.files.create({
        requestBody: {
          name: folderName.trim(),
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        },
        fields: 'id, name, mimeType, webViewLink, createdTime',
      });
      return {
        success: true,
        action: 'create_folder',
        folder: res.data,
        message: `Folder "${folderName}" created successfully in Google Drive.`,
      };
    }

    case 'list': {
      const parentId = folderId || defaultFolderId;
      const q = `'${parentId}' in parents and trashed = false`;
      const res = await drive.files.list({
        q,
        fields: 'files(id, name, mimeType, webViewLink, size, modifiedTime, createdTime)',
        pageSize: 50,
      });
      return {
        success: true,
        action: 'list',
        folderId: parentId,
        files: res.data.files || [],
        count: (res.data.files || []).length,
      };
    }

    case 'search': {
      const searchTerm = (query || '').replace(/'/g, "\\'");
      const q = searchTerm
        ? `name contains '${searchTerm}' and trashed = false`
        : 'trashed = false';
      const res = await drive.files.list({
        q,
        fields: 'files(id, name, mimeType, webViewLink, size, modifiedTime, parents)',
        pageSize: 30,
      });
      return {
        success: true,
        action: 'search',
        query,
        files: res.data.files || [],
        count: (res.data.files || []).length,
      };
    }

    case 'get_metadata': {
      if (!fileId) throw new BadRequestError('fileId is required to retrieve metadata.');
      const res = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, webViewLink, size, modifiedTime, createdTime, permissions, parents',
      });
      return {
        success: true,
        action: 'get_metadata',
        metadata: res.data,
      };
    }

    case 'share': {
      if (!fileId) throw new BadRequestError('fileId is required to share a document or folder.');
      const permissionBody = emailAddress
        ? { role, type: 'user', emailAddress }
        : { role, type: 'anyone' };

      const res = await drive.permissions.create({
        fileId,
        requestBody: permissionBody,
        fields: 'id, role, type, emailAddress',
      });

      const fileRes = await drive.files.get({
        fileId,
        fields: 'id, name, webViewLink',
      });

      return {
        success: true,
        action: 'share',
        permission: res.data,
        file: fileRes.data,
        message: emailAddress
          ? `Shared "${fileRes.data.name}" with ${emailAddress} as ${role}.`
          : `Shared "${fileRes.data.name}" publicly as ${role}.`,
      };
    }

    default:
      throw new BadRequestError(`Unsupported Google Drive action: ${action}`);
  }
}

/**
 * Universal create_cloud_document Tool Handler.
 * Supports: 'doc' | 'sheet' with open-ended content (markdown/text) or structured data (grid/table).
 *
 * @param {string} userId - User ObjectId.
 * @param {object} args - Tool arguments.
 * @returns {Promise<object>}
 */
export async function createCloudDocument(userId, args = {}) {
  const { type = 'doc', title, folderId, content, data } = args;
  if (!title || typeof title !== 'string') {
    throw new BadRequestError('title is required to create a cloud document.');
  }

  const clientInfo = await getValidGoogleClient(userId);
  const targetFolderId = folderId || (await ensureRootFolder(userId, clientInfo));

  if (clientInfo.isMock) {
    return handleMockCreateCloudDoc(userId, {
      type,
      title: title.trim(),
      folderId: targetFolderId,
      content,
      data,
    });
  }

  const drive = google.drive({ version: 'v3', auth: clientInfo.authClient });

  if (type === 'sheet') {
    // 1. Create Google Spreadsheet
    const sheets = google.sheets({ version: 'v4', auth: clientInfo.authClient });
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: title.trim() },
      },
    });

    const spreadsheetId = createRes.data.spreadsheetId;
    const webViewLink = createRes.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    // Move file into targetFolderId
    if (targetFolderId && targetFolderId !== 'root') {
      try {
        await drive.files.update({
          fileId: spreadsheetId,
          addParents: targetFolderId,
          fields: 'id, parents',
        });
      } catch (moveErr) {
        logger.warn(`[googleDriveService] Failed to set parent folder for sheet: ${moveErr.message}`);
      }
    }

    // Populate data if provided
    let rowsCount = 0;
    if (data) {
      const rows = normalizeSpreadsheetData(data);
      if (rows.length > 0) {
        rowsCount = rows.length;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'Sheet1!A1',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: rows },
        });
      }
    }

    return {
      success: true,
      type: 'sheet',
      fileId: spreadsheetId,
      title: title.trim(),
      webViewLink,
      rowsCount,
      folderId: targetFolderId,
      message: `Google Sheet "${title}" created and populated successfully in Google Drive.`,
    };
  }

  // 2. Default: Google Doc
  const docs = google.docs({ version: 'v1', auth: clientInfo.authClient });
  const docCreateRes = await docs.documents.create({
    requestBody: { title: title.trim() },
  });

  const documentId = docCreateRes.data.documentId;
  const webViewLink = `https://docs.google.com/document/d/${documentId}`;

  // Move file into targetFolderId
  if (targetFolderId && targetFolderId !== 'root') {
    try {
      await drive.files.update({
        fileId: documentId,
        addParents: targetFolderId,
        fields: 'id, parents',
      });
    } catch (moveErr) {
      logger.warn(`[googleDriveService] Failed to set parent folder for doc: ${moveErr.message}`);
    }
  }

  // Insert content if provided
  let charCount = 0;
  if (content && typeof content === 'string' && content.trim()) {
    const textToInsert = content.trim() + '\n';
    charCount = textToInsert.length;
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: textToInsert,
            },
          },
        ],
      },
    });
  }

  return {
    success: true,
    type: 'doc',
    fileId: documentId,
    title: title.trim(),
    webViewLink,
    characterCount: charCount,
    folderId: targetFolderId,
    message: `Google Doc "${title}" created and formatted successfully in Google Drive.`,
  };
}

/**
 * Uploads a local file to Google Drive.
 *
 * @param {string} userId - User ObjectId.
 * @param {object} params - { filePath, fileName, mimeType, folderId }
 * @returns {Promise<object>}
 */
export async function uploadFileToDrive(userId, { filePath, fileName, mimeType, folderId }) {
  const clientInfo = await getValidGoogleClient(userId);
  const targetFolderId = folderId || (await ensureRootFolder(userId, clientInfo));

  if (clientInfo.isMock) {
    const store = mockDriveStore.get(String(userId)) || { files: new Map() };
    const fileId = 'mock_file_' + Date.now();
    const mockFile = {
      id: fileId,
      name: fileName,
      mimeType,
      size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 1024,
      parents: [targetFolderId],
      webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
    };
    store.files.set(fileId, mockFile);
    mockDriveStore.set(String(userId), store);
    return {
      success: true,
      fileId,
      fileName,
      mimeType,
      webViewLink: mockFile.webViewLink,
      message: `File "${fileName}" uploaded successfully to Google Drive (Mock Mode).`,
    };
  }

  const drive = google.drive({ version: 'v3', auth: clientInfo.authClient });
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType,
      parents: [targetFolderId],
    },
    media: {
      mimeType,
      body: fs.createReadStream(filePath),
    },
    fields: 'id, name, mimeType, webViewLink, size',
  });

  return {
    success: true,
    fileId: res.data.id,
    fileName: res.data.name,
    mimeType: res.data.mimeType,
    webViewLink: res.data.webViewLink,
    message: `File "${fileName}" uploaded successfully to Google Drive.`,
  };
}

/**
 * Normalizes open-ended data into 2D array of spreadsheet values.
 * Handles:
 * - 2D Array: [['Name', 'Score'], ['Alice', 95]]
 * - Array of Objects: [{ name: 'Alice', score: 95 }]
 * - Object with headers & rows: { headers: [...], rows: [...] }
 * - Object with rows: { rows: [...] }
 *
 * @param {any} data
 * @returns {Array<Array<any>>}
 */
export function normalizeSpreadsheetData(data) {
  if (!data) return [];
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    if (Array.isArray(data[0])) {
      return data;
    }
    if (typeof data[0] === 'object' && data[0] !== null) {
      const headers = Object.keys(data[0]);
      const rows = data.map((item) => headers.map((h) => item[h] ?? ''));
      return [headers, ...rows];
    }
    return data.map((item) => [item]);
  }

  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data.rows)) {
      if (Array.isArray(data.headers)) {
        return [data.headers, ...data.rows];
      }
      return data.rows;
    }
    if (Array.isArray(data.items)) {
      return normalizeSpreadsheetData(data.items);
    }
    const entries = Object.entries(data);
    return [
      ['Key', 'Value'],
      ...entries.map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]),
    ];
  }

  return [[String(data)]];
}

// ==============================================================================
// Mock Provider Handlers (Zero external network dependencies for unit/integration tests)
// ==============================================================================

function handleMockManageDrive(userId, { action, folderName, query, folderId, fileId, role, emailAddress }) {
  const store = mockDriveStore.get(String(userId)) || { files: new Map() };
  mockDriveStore.set(String(userId), store);

  switch (action) {
    case 'create_folder': {
      if (!folderName) throw new BadRequestError('folderName is required.');
      const id = 'mock_folder_' + Date.now();
      const folder = {
        id,
        name: folderName.trim(),
        mimeType: 'application/vnd.google-apps.folder',
        parents: [folderId],
        webViewLink: `https://drive.google.com/drive/folders/${id}`,
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
      };
      store.files.set(id, folder);
      return {
        success: true,
        action: 'create_folder',
        folder,
        message: `Folder "${folderName}" created successfully in Google Drive (Mock Mode).`,
      };
    }

    case 'list': {
      const allFiles = Array.from(store.files.values());
      const filtered = allFiles.filter((f) => (f.parents || []).includes(folderId));
      return {
        success: true,
        action: 'list',
        folderId,
        files: filtered,
        count: filtered.length,
      };
    }

    case 'search': {
      const term = (query || '').toLowerCase();
      const allFiles = Array.from(store.files.values());
      const filtered = allFiles.filter((f) => f.name.toLowerCase().includes(term));
      return {
        success: true,
        action: 'search',
        query,
        files: filtered,
        count: filtered.length,
      };
    }

    case 'get_metadata': {
      if (!fileId) throw new BadRequestError('fileId is required.');
      const file = store.files.get(fileId);
      if (!file) throw new NotFoundError(`Mock file "${fileId}" not found.`);
      return {
        success: true,
        action: 'get_metadata',
        metadata: file,
      };
    }

    case 'share': {
      if (!fileId) throw new BadRequestError('fileId is required.');
      const file = store.files.get(fileId);
      if (!file) throw new NotFoundError(`Mock file "${fileId}" not found.`);
      return {
        success: true,
        action: 'share',
        permission: { id: 'perm_' + Date.now(), role, emailAddress: emailAddress || 'anyone' },
        file,
        message: emailAddress
          ? `Shared "${file.name}" with ${emailAddress} as ${role} (Mock Mode).`
          : `Shared "${file.name}" publicly as ${role} (Mock Mode).`,
      };
    }

    default:
      throw new BadRequestError(`Unsupported action: ${action}`);
  }
}

function handleMockCreateCloudDoc(userId, { type, title, folderId, content, data }) {
  const store = mockDriveStore.get(String(userId)) || { files: new Map() };
  mockDriveStore.set(String(userId), store);

  const id = `mock_${type}_${Date.now()}`;
  const isSheet = type === 'sheet';
  const mimeType = isSheet
    ? 'application/vnd.google-apps.spreadsheet'
    : 'application/vnd.google-apps.document';
  const webViewLink = isSheet
    ? `https://docs.google.com/spreadsheets/d/${id}`
    : `https://docs.google.com/document/d/${id}`;

  const docRecord = {
    id,
    name: title,
    mimeType,
    parents: [folderId],
    webViewLink,
    content: content || null,
    data: data ? normalizeSpreadsheetData(data) : null,
    createdTime: new Date().toISOString(),
    modifiedTime: new Date().toISOString(),
  };

  store.files.set(id, docRecord);

  return {
    success: true,
    type,
    fileId: id,
    title,
    webViewLink,
    folderId,
    rowsCount: docRecord.data ? docRecord.data.length : undefined,
    characterCount: content ? content.length : undefined,
    message: `Google ${isSheet ? 'Sheet' : 'Doc'} "${title}" created successfully in Google Drive (Mock Mode).`,
  };
}

export default {
  createOAuth2Client,
  getAuthorizationUrl,
  exchangeCodeAndSaveTokens,
  disconnectGoogleDrive,
  getValidGoogleClient,
  ensureRootFolder,
  manageGoogleDrive,
  createCloudDocument,
  uploadFileToDrive,
  normalizeSpreadsheetData,
};
