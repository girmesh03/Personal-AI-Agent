/**
 * @module adapters/MuiChatAdapter
 * @description Idiomatic ChatAdapter connecting @mui/x-chat and @mui/x-chat-headless to
 * Operon's Express 5 SSE streaming pipeline and RTK Query apiSlice.
 * Implements the official ChatAdapter contract (sendMessage, listMessages, listConversations, stop),
 * seamless Turn 1 conversational lifecycle without empty-state flash, side-by-side author alignment,
 * and concurrency-safe token re-authentication.
 */

import { apiSlice } from '../redux/app/apiSlice.js';
import { executeWithReauth } from '../redux/app/authClient.js';
import { chatApi, setActiveChatId, setPipelineStatus } from '../redux/features/chatSlice.js';
import { AUDIO_CONSTANTS, CHAT_PAGINATION, formatModelDisplayName } from '../utils/constants.js';
import { getUploadState } from '../utils/attachmentRegistry.js';

/**
 * Default API base URL from client environment configuration.
 * @constant
 * @type {string}
 */
const DEFAULT_API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:4000/api/v1';

/**
 * Idiomatic MUI X Chat Adapter powered by RTK Query apiSlice.
 *
 * @class MuiChatAdapter
 */
export class MuiChatAdapter {
  /**
   * Initializes the adapter with store dispatch and conversational lifecycle handlers.
   *
   * @constructor
   * @param {object} [options={}] - Adapter configuration.
   * @param {import('@reduxjs/toolkit').Dispatch} options.dispatch - Redux store dispatcher.
   * @param {() => object} options.getCurrentUser - Accessor for active supervisor identity.
   * @param {string} [options.baseUrl=DEFAULT_API_BASE] - Target API base URL.
   * @param {() => string} [options.getModel] - Accessor for active model identifier.
   * @param {() => string|null} [options.getActiveChatId] - Accessor for active conversation identifier.
   * @param {(data: { chatId: string, title?: string }) => void} [options.onSessionCreated] - Callback on initial session allocation.
   * @param {(data: { chatId: string, title: string }) => void} [options.onTitleGenerated] - Callback on auto-titling.
   * @param {(data: { chatId: string, messageId?: string, title?: string }) => void} [options.onTurnCompleted] - Callback on stream finish.
   * @param {(error: Error) => void} [options.onError] - Error notification callback.
   */
  constructor({
    dispatch,
    getCurrentUser,
    baseUrl = DEFAULT_API_BASE,
    onSessionCreated,
    onTitleGenerated,
    onTurnCompleted,
    onError,
    getModel,
    getThinkingBudget,
    getLanguage,
    getSttEngine,
    getActiveChatId,
  } = {}) {
    this.dispatch = dispatch;
    this.getCurrentUser = getCurrentUser;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.onSessionCreated = onSessionCreated;
    this.onTitleGenerated = onTitleGenerated;
    this.onTurnCompleted = onTurnCompleted;
    this.onError = onError;
    this.getModel = getModel;
    this.getThinkingBudget = getThinkingBudget;
    this.getLanguage = getLanguage;
    this.getSttEngine = getSttEngine;
    this.getActiveChatId = getActiveChatId;
    this.activeAbortController = null;
    this.currentChatId = null;
    this.activeModel = null;
    this.activeThinkingBudget = undefined;
    this.activeLanguage = undefined;
    this.activeSttEngine = undefined;
    this.sentUserMessageIds = new Set();
  }

  /**
   * Sets or synchronizes active conversation ID on route navigation.
   * Defensively preserves currentChatId if called with falsy while a session is already active.
   * @param {string|null} id - Target chat session ID.
   */
  setActiveChatId(id) {
    if (id) {
      this.currentChatId = id;
    } else if (id === null && !this.currentChatId) {
      this.currentChatId = null;
    }
  }

  /**
   * Explicitly clears the active conversation ID when resetting to a fresh canvas.
   */
  clearActiveChatId() {
    this.currentChatId = null;
    this.sentUserMessageIds?.clear();
  }

  /**
   * Sets or synchronizes active supervisor identity.
   * @param {object|null} user - Current user object.
   */
  setCurrentUser(user) {
    this.currentUser = user || null;
  }

  /**
   * Sets or synchronizes selected AI inference model.
   * @param {string|null} model - Model identifier.
   */
  setModel(model) {
    this.activeModel = model || null;
  }

  /**
   * Sets or synchronizes thinking budget.
   * @param {number|undefined} budget - Token budget.
   */
  setThinkingBudget(budget) {
    this.activeThinkingBudget = budget;
  }

  /**
   * Sets or synchronizes synthesis language.
   * @param {string|undefined} lang - Language code.
   */
  setLanguage(lang) {
    this.activeLanguage = lang;
  }

  /**
   * Sets or synchronizes speech-to-text engine preference.
   * @param {string|undefined} engine - STT engine identifier.
   */
  setSttEngine(engine) {
    this.activeSttEngine = engine;
  }

  /**
   * Retrieves conversation summaries for the active supervisor.
   * Dispatches RTK Query getChats endpoint, inheriting automatic reauth and caching.
   *
   * @async
   * @param {object} [input={}] - Query arguments.
   * @param {string} [input.cursor] - Page cursor if paginated.
   * @param {string} [input.query] - Search term filter.
   * @returns {Promise<{ conversations: Array<{ id: string, title: string }>, hasMore?: boolean }>}
   */
  async listConversations(input = {}) {
    if (!this.dispatch) {
      return { conversations: [] };
    }

    try {
      const page = input.cursor ? parseInt(input.cursor, 10) : 1;
      const result = await this.dispatch(
        chatApi.endpoints.getChats.initiate(
          { page, limit: CHAT_PAGINATION.RECENT_CHATS_PAGE_SIZE, search: input.query },
          { forceRefetch: true }
        )
      ).unwrap();

      const chats = result?.chats || result?.data?.chats || [];
      const formatted = chats.map((chat) => ({
        id: String(chat._id),
        title: chat.title || 'Untitled Chat',
      }));

      return {
        conversations: formatted,
        hasMore: Boolean(result?.pagination?.hasNextPage),
      };
    } catch (err) {
      console.warn('[MuiChatAdapter] listConversations warning:', err);
      return { conversations: [] };
    }
  }

  /**
   * Loads turn history for the specified conversation.
   * Dispatches RTK Query getChatById endpoint and maps messages into @mui/x-chat schema.
   *
   * @async
   * @param {object} input
   * @param {string} input.conversationId - Conversation ID.
   * @param {string} [input.cursor] - Message pagination cursor.
   * @returns {Promise<{ messages: Array<object>, hasMore?: boolean, cursor?: string }>}
   */
  async listMessages({ conversationId, cursor } = {}) {
    if (!conversationId || !this.dispatch) {
      return { messages: [] };
    }

    const activeUser =
      (typeof this.getCurrentUser === 'function' ? this.getCurrentUser() : null) ||
      this.currentUser ||
      { id: 'supervisor', name: 'Supervisor' };

    try {
      const result = await this.dispatch(
        chatApi.endpoints.getChatById.initiate(
          { chatId: conversationId, limit: CHAT_PAGINATION.MESSAGES_PAGE_SIZE, before: cursor },
          { forceRefetch: Boolean(cursor) }
        )
      ).unwrap();

      const rawMessages = (
        result?.chat?.messages ||
        result?.data?.chat?.messages ||
        result?.messages ||
        []
      ).filter(
        (msg) =>
          msg.role !== 'user' ||
          (msg.text && typeof msg.text === 'string' && msg.text.trim()) ||
          (Array.isArray(msg.attachments) && msg.attachments.length > 0) ||
          (Array.isArray(msg.audios) && msg.audios.length > 0)
      );

      const formatted = rawMessages.map((msg) => {
        const isUser = msg.role === 'user';
        const parts = [];

        // For assistant turns: hydrate persisted thoughts and tool executions
        if (!isUser) {
          if (msg.thought && typeof msg.thought === 'string' && msg.thought.trim()) {
            parts.push({
              type: 'reasoning',
              text: msg.thought.trim(),
              state: 'done',
            });
          }

          if (Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
            msg.toolCalls.forEach((tc, idx) => {
              parts.push({
                type: 'tool',
                toolInvocation: {
                  toolCallId: tc.id || `hist-tc-${idx}`,
                  toolName: tc.name || 'tool',
                  state: 'output-available',
                  input: tc.args || {},
                  output: tc.result !== undefined ? tc.result : null,
                },
              });
            });
          }
        }

        const textContent =
          msg.text ||
          (Array.isArray(msg.parts) ? msg.parts.find((p) => p.type === 'text')?.text || msg.parts[0]?.text : '') ||
          '';

        if (textContent || parts.length === 0) {
          parts.push({ type: 'text', text: textContent });
        }

        const serverOrigin = this.baseUrl.replace(/\/api\/v1\/?$/, '');

        const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
        const hydratedAttachments = [];
        attachments.forEach((att) => {
          const cleanPath = att.path ? att.path.replace(/\\/g, '/') : null;
          const relUrl = att.url || (cleanPath ? (cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`) : null);
          const fullUrl = relUrl ? (relUrl.startsWith('http') || relUrl.startsWith('blob:') ? relUrl : `${serverOrigin}${relUrl}`) : null;

          const attObj = {
            id: String(att._id || att.fileName),
            _id: String(att._id || att.fileName),
            fileName: att.fileName,
            filename: att.originalName || att.fileName,
            name: att.originalName || att.fileName,
            originalName: att.originalName || att.fileName,
            mediaType: att.mimeType,
            mimeType: att.mimeType,
            size: att.size,
            path: cleanPath,
            url: fullUrl,
          };
          hydratedAttachments.push(attObj);

          parts.push({
            type: 'file',
            ...attObj,
          });
        });

        const audios = Array.isArray(msg.audios) ? msg.audios : [];
        const hydratedAudios = [];
        audios.forEach((aud) => {
          const cleanPath = aud.path ? aud.path.replace(/\\/g, '/') : null;
          const relUrl = aud.url || (cleanPath ? (cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`) : null);
          const fullUrl = relUrl ? (relUrl.startsWith('http') || relUrl.startsWith('blob:') ? relUrl : `${serverOrigin}${relUrl}`) : null;

          const audObj = {
            id: String(aud._id || aud.fileName),
            _id: String(aud._id || aud.fileName),
            fileName: aud.fileName,
            filename: aud.originalName || aud.fileName || 'Voice Recording',
            name: aud.originalName || aud.fileName || 'Voice Recording',
            originalName: aud.originalName || aud.fileName || 'Voice Recording',
            mediaType: aud.mimeType || 'audio/webm',
            mimeType: aud.mimeType || 'audio/webm',
            size: aud.size,
            duration: aud.duration,
            path: cleanPath,
            url: fullUrl,
          };
          hydratedAudios.push(audObj);

          parts.push({
            type: 'audio',
            ...audObj,
          });
        });

        if (isUser) {
          this.sentUserMessageIds?.add(String(msg.id || msg._id));
        }

        const isError = Boolean(msg.isError || msg.error);
        const isStopped = Boolean(msg.isStopped);
        const status = isError ? 'error' : (isStopped ? 'cancelled' : 'sent');

        return {
          id: String(msg.id || msg._id),
          conversationId,
          role: isUser ? 'user' : 'assistant',
          status,
          author: isUser
            ? {
                id: activeUser.id,
                role: 'user',
                displayName: activeUser.name,
              }
            : {
                id: 'assistant',
                role: 'assistant',
                displayName: 'Operon',
              },
          parts,
          attachments: hydratedAttachments,
          audios: hydratedAudios,
          metadata: {
            model: msg.model || null,
            usage: msg.usage || null,
            isStopped,
            isError,
            error: msg.error || null,
            thoughtDuration: msg.thoughtDuration || null,
          },
          isError,
          error: msg.error || null,
          createdAt: msg.createdAt
            ? new Date(msg.createdAt).toISOString()
            : new Date().toISOString(),
        };
      });

      // Safeguard against duplicate message IDs during reverse pagination merges
      const seenIds = new Set();
      const dedupedMessages = [];
      for (const msg of formatted) {
        if (msg?.id && !seenIds.has(msg.id)) {
          seenIds.add(msg.id);
          dedupedMessages.push(msg);
        }
      }

      return {
        messages: dedupedMessages,
        hasMore: Boolean(result?.hasMore),
        cursor: result?.cursor || null,
      };
    } catch (err) {
      console.warn('[MuiChatAdapter] listMessages warning for conversation:', conversationId, err);
      return { messages: [] };
    }
  }

  /**
   * Cancels in-flight SSE stream generation.
   */
  stop() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  /**
   * Transport refinement for assistant message regeneration.
   * Called natively by @mui/x-chat-headless actions.regenerate(messageId).
   * Re-runs the anchor user message through the SSE stream with retryTurnIndex,
   * completely avoiding the creation of phantom user turns.
   *
   * @async
   * @param {object} input
   * @param {string} [input.conversationId] - Active conversation ID.
   * @param {string} input.messageId - Assistant message ID being regenerated.
   * @param {object} input.message - Anchor user message.
   * @param {Array<object>} [input.messages] - Active message list in store.
   * @param {AbortSignal} [input.signal] - Abort signal.
   * @returns {Promise<ReadableStream>}
   */
  async regenerate({ conversationId, messageId, message, messages, signal }) {
    const anchorIndex = Array.isArray(messages)
      ? messages.findIndex((m) => String(m.id) === String(message?.id))
      : -1;
    const assistantIndex = Array.isArray(messages)
      ? messages.findIndex((m) => String(m.id) === String(messageId))
      : -1;
    const retryTurnIndex =
      anchorIndex >= 0
        ? anchorIndex + 1
        : (assistantIndex >= 0 ? assistantIndex : undefined);

    return this.sendMessage({
      conversationId,
      message: {
        ...message,
        metadata: {
          ...(message?.metadata || {}),
          isRetry: true,
          retryTurnIndex,
          anchorUserMessageId: message?.id,
          targetAssistantMessageId: messageId,
        },
      },
      messages,
      signal,
    });
  }

  /**
   * Sends user message to backend SSE endpoint and yields live ChatMessageChunk stream.
   *
   * @async
   * @param {object} input
   * @param {string} [input.conversationId] - Active conversation ID.
   * @param {object} input.message - User ChatMessage entity.
   * @param {Array<object>} [input.messages] - Active message list in store.
   * @param {Array<object>} [input.attachments] - Queued draft attachments.
   * @param {AbortSignal} [input.signal] - External stop signal.
   * @returns {Promise<ReadableStream>}
   */
  async sendMessage({ conversationId, message, attachments, signal }) {
    const userText =
      message?.parts?.find((p) => p.type === 'text')?.text ||
      (typeof message?.content === 'string' ? message.content : '') ||
      '';

    const targetChatId =
      conversationId ||
      (typeof this.getActiveChatId === 'function' ? this.getActiveChatId() : null) ||
      this.currentChatId ||
      undefined;
    const streamUrl = targetChatId
      ? `${this.baseUrl}/chat/${targetChatId}/stream`
      : `${this.baseUrl}/chat/stream`;

    const isEdit = Boolean(
      message?.isEdit ||
      message?.metadata?.isEdit ||
      typeof message?.editTurnIndex === 'number' ||
      typeof message?.metadata?.editTurnIndex === 'number'
    );

    const isRetry =
      !isEdit &&
      Boolean(
        message?.isRetry ||
        message?.metadata?.isRetry ||
        typeof message?.retryTurnIndex === 'number' ||
        typeof message?.metadata?.retryTurnIndex === 'number' ||
        (message?.metadata?.anchorUserMessageId && !isEdit) ||
        (targetChatId && message?.id && this.sentUserMessageIds?.has(String(message.id)))
      );

    if (message?.id) {
      this.sentUserMessageIds?.add(String(message.id));
    }

    // 1. Pre-upload file attachments if present (differentiating audio notes vs document/image attachments)
    // On RETRY: Skip uploading and do not synthesize uploadedAttachments or uploadedAudioIds.
    // The server will re-hydrate multi-modal context directly from the persisted MongoDB turn record.
    let uploadedAttachments = [];
    let uploadedAudioIds = [];

    if (!isRetry) {
      const rawActive = [
        ...(Array.isArray(attachments) ? attachments : []),
        ...(Array.isArray(message?.attachments) ? message.attachments : []),
      ];
      const seenItems = new Set();
      const activeAttachments = [];
      rawActive.forEach((item) => {
        if (!item) return;
        const key = item.file || item.localId || item.id || item._id || item.path || item.name || item;
        if (!seenItems.has(key)) {
          seenItems.add(key);
          activeAttachments.push(item);
        }
      });

      if (Array.isArray(message?.audios) && message.audios.length > 0) {
        message.audios.forEach((a) => {
          const id = typeof a === 'string' ? a : (a?._id || a?.id || a?.audioId);
          if (id && /^[0-9a-fA-F]{24}$/.test(String(id))) {
            if (!uploadedAudioIds.includes(String(id))) {
              uploadedAudioIds.push(String(id));
            }
          } else if (typeof a === 'object' && a !== null) {
            uploadedAttachments.push({
              ...a,
              isAudio: true,
            });
          }
        });
      }

      if (activeAttachments.length === 0 && Array.isArray(message?.parts)) {
        message.parts.forEach((p) => {
          if (p.type === 'file' || p.type === 'audio') {
            activeAttachments.push({
              id: p.id,
              _id: p._id || p.id,
              type: p.type,
              fileName: p.filename || p.name || p.fileName,
              originalName: p.originalName || p.filename || p.name,
              mimeType: p.mediaType || p.mimeType,
              size: p.size,
              path: p.path,
              url: p.url,
              file: p.file,
            });
          }
        });
      }

      if (activeAttachments.length > 0) {
        const audioFiles = [];
        const docFiles = [];

        activeAttachments.forEach((att) => {
          const file = (att instanceof File || att instanceof Blob)
            ? att
            : ((att.file instanceof File || att.file instanceof Blob) ? att.file : null);

          const mime = (att.mimeType || att.type || att.mediaType || (file && file.type) || '').toLowerCase();
          const cleanType = mime.split(';')[0].trim();
          const attName = (att.name || att.originalName || att.fileName || (file && file.name) || '').toLowerCase();

          const isAudioItem =
            att.type === 'audio' ||
            att.isAudio === true ||
            (cleanType && (
              AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes(cleanType) ||
              cleanType.startsWith('audio/') ||
              cleanType === 'video/webm' ||
              cleanType === 'application/ogg'
            )) ||
            AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.some((ext) => attName.endsWith(ext));

          if (file) {
            const eagerState = getUploadState(file);
            if (eagerState?.result) {
              if (isAudioItem || eagerState.result.isAudio || eagerState.result.purpose === 'chat_voice_input') {
                const rawAudioId = eagerState.result._id || eagerState.result.id;
                if (rawAudioId && !uploadedAudioIds.includes(String(rawAudioId))) {
                  uploadedAudioIds.push(String(rawAudioId));
                }
              } else {
                uploadedAttachments.push({
                  _id: eagerState.result._id,
                  fileName: eagerState.result.fileName || file.name,
                  originalName: eagerState.result.originalName || file.name,
                  mimeType: eagerState.result.mimeType || file.type,
                  size: eagerState.result.size || file.size,
                  path: eagerState.result.path,
                  url: eagerState.result.url,
                  cloudUrl: eagerState.result.cloudUrl,
                  publicId: eagerState.result.publicId,
                });
              }
              return;
            }

            // Direct ID decoration on file from earlier upload
            const fileDirectId = file._id || file.audioId;
            if (fileDirectId && /^[0-9a-fA-F]{24}$/.test(String(fileDirectId))) {
              if (isAudioItem && !uploadedAudioIds.includes(String(fileDirectId))) {
                uploadedAudioIds.push(String(fileDirectId));
                return;
              }
            }
          }

          if (!file) {
            // Pre-existing uploaded attachment or audio from an earlier turn
            if (isAudioItem) {
              const rawId = att._id || att.id || att.audioId;
              if (rawId && /^[0-9a-fA-F]{24}$/.test(String(rawId))) {
                if (!uploadedAudioIds.includes(String(rawId))) {
                  uploadedAudioIds.push(String(rawId));
                }
              } else {
                // If ID is not a 24-hex ObjectId, still pass audio descriptor into uploadedAttachments
                // so backend dual-pool matching can match it against stored targetTurn audios!
                const safeFileName = att.fileName || att.originalName || att.name || 'voice-note.webm';
                uploadedAttachments.push({
                  _id: att._id || undefined,
                  id: att.id || undefined,
                  fileName: safeFileName,
                  originalName: att.originalName || att.name || safeFileName,
                  mimeType: cleanType || att.mimeType || att.type || 'audio/webm',
                  size: Number(att.size) || 1,
                  path: att.path || undefined,
                  url: att.url || null,
                  cloudUrl: att.cloudUrl || undefined,
                  publicId: att.publicId || undefined,
                  isAudio: true,
                });
              }
            } else if (att.fileName || att.originalName || att.name || att.path || att.url) {
              const rawPath = att.path || (att.url && att.url.replace(/^.*\/uploads\//, 'uploads/')) || att.url;
              const isBlobOrHttp = rawPath && (rawPath.startsWith('blob:') || rawPath.startsWith('http://') || rawPath.startsWith('https://'));
              const cleanPath = (rawPath && !isBlobOrHttp)
                ? rawPath.replace(/\\/g, '/').replace(/^.*\/uploads\//, 'uploads/').replace(/^\/+/, '')
                : (att.path && !att.path.startsWith('blob:') && !att.path.startsWith('http') ? att.path.replace(/\\/g, '/').replace(/^\/+/, '') : '');

              let resolvedName = att.fileName || att.originalName || att.name || '';
              if (!resolvedName && cleanPath) {
                resolvedName = cleanPath.split('/').pop() || '';
              }
              const extFromName = resolvedName.includes('.') ? `.${resolvedName.split('.').pop()}` : '';
              const safeFileName = att.fileName && att.fileName.includes('.')
                ? att.fileName
                : (resolvedName.includes('.') ? resolvedName : `${resolvedName || 'attachment'}${extFromName || '.png'}`);

              uploadedAttachments.push({
                _id: att._id || att.id || undefined,
                fileName: safeFileName,
                originalName: att.originalName || att.name || safeFileName,
                mimeType: att.mimeType || att.type || (safeFileName.endsWith('.png') ? 'image/png' : 'application/octet-stream'),
                size: Number(att.size) || 1,
                path: cleanPath || undefined,
                url: att.url || (cleanPath ? `/${cleanPath}` : null),
                cloudUrl: att.cloudUrl || undefined,
                publicId: att.publicId || undefined,
              });
            }
            return;
          }

          if (isAudioItem) {
            audioFiles.push(file);
          } else {
            docFiles.push(file);
          }
        });

        // 1.1 Upload audio files to /chat/upload-audio under field 'audios' with re-auth protection
        if (audioFiles.length > 0) {
          const audioFormData = new FormData();
          audioFiles.forEach((f) => audioFormData.append('audios', f));
          const effectiveStt =
            (typeof this.getSttEngine === 'function' ? this.getSttEngine() : undefined) ||
            this.activeSttEngine;
          if (effectiveStt) {
            audioFormData.append('sttEngine', effectiveStt);
          }
          const audioRes = await executeWithReauth(
            () =>
              fetch(`${this.baseUrl}/chat/upload-audio`, {
                method: 'POST',
                credentials: 'include',
                body: audioFormData,
                signal,
              }),
            { dispatch: this.dispatch, baseUrl: this.baseUrl }
          );
          if (!audioRes.ok) {
            const errData = await audioRes.json().catch(() => ({}));
            throw new Error(errData?.message || `Failed to upload audio recordings (${audioRes.status})`);
          }
          const audioData = await audioRes.json();
          const rawAudios = audioData?.data?.audios || audioData?.audios || [];
          const newlyUploadedAudioIds = rawAudios.map((a) => a._id || a.id).filter(Boolean);
          uploadedAudioIds.push(...newlyUploadedAudioIds);
        }

        // 1.2 Upload document and image files to /chat/upload-attachments under field 'attachments' with re-auth protection
        if (docFiles.length > 0) {
          const docFormData = new FormData();
          docFiles.forEach((f) => docFormData.append('attachments', f));
          const uploadRes = await executeWithReauth(
            () =>
              fetch(`${this.baseUrl}/chat/upload-attachments`, {
                method: 'POST',
                credentials: 'include',
                body: docFormData,
                signal,
              }),
            { dispatch: this.dispatch, baseUrl: this.baseUrl }
          );
          if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({}));
            throw new Error(errData?.message || `Failed to upload file attachments (${uploadRes.status})`);
          }
          const uploadData = await uploadRes.json();
          const newlyUploaded = uploadData?.data?.attachments || uploadData?.attachments || [];
          uploadedAttachments.push(...newlyUploaded);
        }
      }
    }

    const retryTurnIndex =
      typeof message?.retryTurnIndex === 'number'
        ? message.retryTurnIndex
        : (typeof message?.metadata?.retryTurnIndex === 'number'
          ? message.metadata.retryTurnIndex
          : undefined);

    const editTurnIndex =
      typeof message?.editTurnIndex === 'number'
        ? message.editTurnIndex
        : (typeof message?.metadata?.editTurnIndex === 'number'
          ? message.metadata.editTurnIndex
          : undefined);

    const payload = {
      id: message?.id,
      text: userText,
      chatId: targetChatId,
      isRetry: isRetry ? true : undefined,
      retryTurnIndex,
      isEdit: isEdit ? true : undefined,
      anchorUserMessageId: message?.metadata?.anchorUserMessageId || (isRetry ? message?.id : undefined),
      targetAssistantMessageId: message?.metadata?.targetAssistantMessageId,
      editTurnIndex,
      model:
        message?.metadata?.model ||
        (typeof this.getModel === 'function' ? this.getModel() : undefined) ||
        this.activeModel,
      thinkingBudget:
        (typeof this.getThinkingBudget === 'function' ? this.getThinkingBudget() : undefined) ??
        this.activeThinkingBudget,
      language:
        (typeof this.getLanguage === 'function' ? this.getLanguage() : undefined) ??
        this.activeLanguage,
      sttEngine:
        (typeof this.getSttEngine === 'function' ? this.getSttEngine() : undefined) ||
        this.activeSttEngine,
      audios: isEdit ? uploadedAudioIds : (uploadedAudioIds.length > 0 ? uploadedAudioIds : undefined),
      attachments: isEdit ? uploadedAttachments : (uploadedAttachments.length > 0 ? uploadedAttachments : undefined),
    };

    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    const abortController = new AbortController();
    this.activeAbortController = abortController;

    if (signal) {
      signal.addEventListener('abort', () => {
        abortController.abort();
      });
    }

    const adapterInstance = this;

    return new ReadableStream({
      async start(controller) {
        const assistantMessageId =
          isRetry && message?.metadata?.targetAssistantMessageId
            ? message.metadata.targetAssistantMessageId
            : `asst-${Date.now()}`;
        controller.enqueue({
          type: 'start',
          messageId: assistantMessageId,
          author: { id: 'assistant', displayName: 'Operon', role: 'assistant' },
        });

        let textCounter = 1;
        let textPartId = 'text-1';
        let reasoningCounter = 1;
        let reasoningPartId = 'reasoning-1';
        let toolCounter = 0;
        let activeToolCallId = null;
        let hasTextStarted = false;
        let hasTextEnded = false;
        let hasReasoningStarted = false;
        let hasReasoningEnded = false;
        let thoughtStartTime = null;
        let thoughtDuration = null;

        try {
          const response = await executeWithReauth(
            () =>
              fetch(streamUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'text/event-stream',
                },
                credentials: 'include',
                body: JSON.stringify(payload),
                signal: abortController.signal,
              }),
            { dispatch: adapterInstance.dispatch, baseUrl: adapterInstance.baseUrl }
          );

          if (!response.ok) {
            const errorText = await response.text();
            let parsedMsg = `Request failed with status ${response.status}`;
            try {
              const parsed = JSON.parse(errorText);
              if (parsed.message) parsedMsg = parsed.message;
            } catch {
              // Non-JSON error
            }
            throw new Error(parsedMsg);
          }

          if (!response.body) {
            throw new Error('ReadableStream not supported by response body.');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let boundaryIndex;
            while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
              const rawEvent = buffer.slice(0, boundaryIndex);
              buffer = buffer.slice(boundaryIndex + 2);

              let eventType = 'message';
              let dataStr = '';
              const lines = rawEvent.split(/\r?\n/);
              for (const line of lines) {
                if (line.startsWith('event:')) {
                  eventType = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                  dataStr += (dataStr ? '\n' : '') + line.slice(5).trim();
                }
              }

              if (!dataStr) continue;

              let data;
              try {
                data = JSON.parse(dataStr);
              } catch {
                continue;
              }

              switch (eventType) {
                case 'session': {
                  adapterInstance.currentChatId = data.chatId;
                  if (!conversationId && typeof window !== 'undefined' && window.history?.replaceState) {
                    window.history.replaceState(null, '', `/chat/${data.chatId}`);
                  }
                  // Invalidate recent chats list immediately so sidebar reflects the new session in real time
                  adapterInstance.dispatch?.(
                    apiSlice.util.invalidateTags([{ type: 'Chat', id: 'LIST' }])
                  );
                  adapterInstance.dispatch?.(setActiveChatId(data.chatId));
                  adapterInstance.onSessionCreated?.({
                    chatId: data.chatId,
                    title: data.title,
                  });
                  break;
                }

                case 'thought': {
                  if (data.delta) {
                    if (!thoughtStartTime) {
                      thoughtStartTime = Date.now();
                    }
                    if (hasReasoningEnded) {
                      reasoningCounter += 1;
                      reasoningPartId = `reasoning-${reasoningCounter}`;
                      hasReasoningStarted = false;
                      hasReasoningEnded = false;
                    }
                    if (!hasReasoningStarted) {
                      adapterInstance.dispatch?.(setPipelineStatus('Thinking...'));
                      controller.enqueue({
                        type: 'reasoning-start',
                        id: reasoningPartId,
                      });
                      hasReasoningStarted = true;
                    }
                    controller.enqueue({
                      type: 'reasoning-delta',
                      id: reasoningPartId,
                      delta: data.delta,
                    });
                  }
                  break;
                }

                case 'tool_call': {
                  if (hasReasoningStarted && !hasReasoningEnded) {
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: reasoningPartId,
                    });
                    hasReasoningEnded = true;
                  }
                  adapterInstance.dispatch?.(setPipelineStatus(`Executing ${data.name || 'tool'}...`));
                  toolCounter += 1;
                  activeToolCallId = data.id || `tc-${Date.now()}-${toolCounter}`;
                  controller.enqueue({
                    type: 'tool-input-available',
                    toolCallId: activeToolCallId,
                    toolName: data.name,
                    input: data.args || {},
                  });
                  break;
                }

                case 'tool_result': {
                  const currentToolId = data.id || activeToolCallId || `tc-${Date.now()}-${toolCounter}`;
                  controller.enqueue({
                    type: 'tool-output-available',
                    toolCallId: currentToolId,
                    output: data.result !== undefined ? data.result : null,
                  });
                  activeToolCallId = null;
                  break;
                }

                case 'text': {
                  if (data.delta) {
                    if (hasReasoningStarted && !hasReasoningEnded) {
                      controller.enqueue({
                        type: 'reasoning-end',
                        id: reasoningPartId,
                      });
                      hasReasoningEnded = true;
                    }
                    if (thoughtStartTime && !thoughtDuration) {
                      thoughtDuration = ((Date.now() - thoughtStartTime) / 1000).toFixed(1);
                    }
                    if (!hasTextStarted) {
                      adapterInstance.dispatch?.(setPipelineStatus(''));
                      controller.enqueue({
                        type: 'text-start',
                        id: textPartId,
                      });
                      hasTextStarted = true;
                    }
                    controller.enqueue({
                      type: 'text-delta',
                      id: textPartId,
                      delta: data.delta,
                    });
                  }
                  break;
                }

                case 'reset_stream': {
                  if (data.alternateModel) {
                    adapterInstance.dispatch?.(
                      setPipelineStatus(`Switching model to ${formatModelDisplayName(data.alternateModel)}...`)
                    );
                  }
                  if (hasReasoningStarted && !hasReasoningEnded) {
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: reasoningPartId,
                    });
                    hasReasoningEnded = true;
                  }
                  if (hasTextStarted && !hasTextEnded) {
                    controller.enqueue({
                      type: 'text-end',
                      id: textPartId,
                    });
                    hasTextEnded = true;
                  }
                  textCounter += 1;
                  textPartId = `text-${textCounter}`;
                  reasoningCounter += 1;
                  reasoningPartId = `reasoning-${reasoningCounter}`;
                  hasTextStarted = false;
                  hasTextEnded = false;
                  hasReasoningStarted = false;
                  hasReasoningEnded = false;
                  break;
                }

                case 'status': {
                  if (data.message) {
                    adapterInstance.dispatch?.(setPipelineStatus(data.message));
                    if (typeof adapterInstance.onStatusUpdate === 'function') {
                      adapterInstance.onStatusUpdate(data.message);
                    }
                  }
                  break;
                }

                case 'title': {
                  adapterInstance.dispatch?.(
                    apiSlice.util.invalidateTags([{ type: 'Chat', id: 'LIST' }])
                  );
                  adapterInstance.onTitleGenerated?.({
                    chatId: adapterInstance.currentChatId,
                    title: data.title,
                  });
                  break;
                }

                case 'done': {
                  adapterInstance.dispatch?.(setPipelineStatus(''));
                  if (hasReasoningStarted && !hasReasoningEnded) {
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: reasoningPartId,
                    });
                    hasReasoningEnded = true;
                  }
                  if (hasTextStarted && !hasTextEnded) {
                    controller.enqueue({
                      type: 'text-end',
                      id: textPartId,
                    });
                    hasTextEnded = true;
                  }
                  if (thoughtStartTime && !thoughtDuration) {
                    thoughtDuration = ((Date.now() - thoughtStartTime) / 1000).toFixed(1);
                  }
                  if (thoughtDuration) {
                    controller.enqueue({
                      type: 'message-metadata',
                      metadata: { thoughtDuration },
                    });
                  }
                  controller.enqueue({
                    type: 'finish',
                    messageId: assistantMessageId,
                  });

                  if (adapterInstance.currentChatId) {
                    adapterInstance.dispatch?.(setActiveChatId(adapterInstance.currentChatId));
                  }

                  adapterInstance.dispatch?.(
                    apiSlice.util.invalidateTags([
                      { type: 'Chat', id: 'LIST' },
                      { type: 'Chat', id: adapterInstance.currentChatId },
                    ])
                  );

                  adapterInstance.onTurnCompleted?.({
                    chatId: adapterInstance.currentChatId,
                    messageId: data.messageId,
                    userTurnId: data.userTurnId,
                    userAudios: data.userAudios,
                    userAttachments: data.userAttachments,
                    title: data.title,
                    model: data.model,
                    usage: data.usage,
                  });

                  controller.close();
                  return;
                }

                case 'error': {
                  adapterInstance.dispatch?.(setPipelineStatus(''));
                  if (hasReasoningStarted && !hasReasoningEnded) {
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: reasoningPartId,
                    });
                    hasReasoningEnded = true;
                  }
                  if (hasTextStarted && !hasTextEnded) {
                    controller.enqueue({
                      type: 'text-end',
                      id: textPartId,
                    });
                    hasTextEnded = true;
                  }
                  controller.enqueue({
                    type: 'message-metadata',
                    metadata: {
                      isError: true,
                      error: data.message || 'Streaming failed.',
                      reason: data.reason || 'error',
                      failedModel: data.failedModel,
                      suggestedModels: data.suggestedModels,
                    },
                  });
                  controller.enqueue({
                    type: 'finish',
                    messageId: assistantMessageId,
                    finishReason: 'error',
                  });
                  if (adapterInstance.currentChatId) {
                    adapterInstance.dispatch?.(setActiveChatId(adapterInstance.currentChatId));
                  }
                  controller.close();
                  adapterInstance.onError?.({
                    message: data.message || 'Streaming failed.',
                    reason: data.reason,
                    failedModel: data.failedModel,
                    suggestedModels: data.suggestedModels,
                    messageId: assistantMessageId,
                  });
                  return;
                }

                default:
                  break;
              }
            }
          }

          if (hasReasoningStarted && !hasReasoningEnded) {
            controller.enqueue({
              type: 'reasoning-end',
              id: reasoningPartId,
            });
          }
          if (hasTextStarted && !hasTextEnded) {
            controller.enqueue({
              type: 'text-end',
              id: textPartId,
            });
          }
          controller.enqueue({
            type: 'finish',
            messageId: assistantMessageId,
          });
          controller.close();
        } catch (streamErr) {
          adapterInstance.dispatch?.(setPipelineStatus(''));
          if (abortController.signal.aborted) {
            if (hasReasoningStarted && !hasReasoningEnded) {
              controller.enqueue({
                type: 'reasoning-end',
                id: reasoningPartId,
              });
            }
            if (hasTextStarted && !hasTextEnded) {
              controller.enqueue({
                type: 'text-end',
                id: textPartId,
              });
            }
            if (thoughtStartTime && !thoughtDuration) {
              thoughtDuration = ((Date.now() - thoughtStartTime) / 1000).toFixed(1);
            }
            controller.enqueue({
              type: 'message-metadata',
              metadata: {
                isStopped: true,
                ...(thoughtDuration ? { thoughtDuration } : {}),
              },
            });
            controller.enqueue({
              type: 'abort',
              messageId: assistantMessageId,
            });
          } else {
            if (hasReasoningStarted && !hasReasoningEnded) {
              controller.enqueue({
                type: 'reasoning-end',
                id: reasoningPartId,
              });
            }
            if (hasTextStarted && !hasTextEnded) {
              controller.enqueue({
                type: 'text-end',
                id: textPartId,
              });
            }
            controller.enqueue({
              type: 'message-metadata',
              metadata: {
                isError: true,
                error: streamErr.message || 'Stream connection failed.',
                reason: 'connection_error',
              },
            });
            controller.enqueue({
              type: 'finish',
              messageId: assistantMessageId,
              finishReason: 'error',
            });
            adapterInstance.onError?.(streamErr);
          }
          controller.close();
        } finally {
          adapterInstance.activeAbortController = null;
        }
      },
    });
  }

  /**
   * Resumes generation of an interrupted assistant message turn in-place (Model A).
   * Appends incoming streaming tokens directly to the target assistant message in the store
   * without creating synthetic user bubbles or polluting database history.
   *
   * @async
   * @param {object} input
   * @param {string} [input.conversationId] - Target conversation ID.
   * @param {string} input.messageId - Assistant message ID being resumed.
   * @param {object} input.store - Headless chat store instance.
   * @param {AbortSignal} [input.signal] - Optional external abort signal.
   * @returns {Promise<void>}
   */
  async continueGeneration({ conversationId, messageId, store, signal } = {}) {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    const targetChatId =
      conversationId ||
      (typeof this.getActiveChatId === 'function' ? this.getActiveChatId() : null) ||
      this.currentChatId;

    if (!targetChatId) {
      throw new Error('Cannot continue generation without an active conversation ID.');
    }

    const streamUrl = `${this.baseUrl}/chat/${targetChatId}/stream`;
    const payload = {
      chatId: targetChatId,
      continueTurn: true,
      targetAssistantMessageId: messageId,
      model:
        (typeof this.getModel === 'function' ? this.getModel() : undefined) ||
        this.activeModel,
      thinkingBudget:
        (typeof this.getThinkingBudget === 'function' ? this.getThinkingBudget() : undefined) ??
        this.activeThinkingBudget,
      language:
        (typeof this.getLanguage === 'function' ? this.getLanguage() : undefined) ??
        this.activeLanguage,
      sttEngine:
        (typeof this.getSttEngine === 'function' ? this.getSttEngine() : undefined) ||
        this.activeSttEngine,
    };

    const abortController = new AbortController();
    this.activeAbortController = abortController;

    if (signal) {
      signal.addEventListener('abort', () => {
        abortController.abort();
      });
    }

    const adapterInstance = this;

    // Set streaming state on store so global indicators reflect active generation
    store?.setStreaming?.(true, targetChatId);
    store?.setError?.(null);

    // Snapshot existing target message from store
    const existingMsg = store?.state?.messagesById?.[messageId];
    let currentText;
    if (typeof existingMsg?.content === 'string') {
      currentText = existingMsg.content;
    } else {
      const textPart = existingMsg?.parts?.find((p) => p.type === 'text');
      currentText = textPart?.text || existingMsg?.text || '';
    }

    try {
      const response = await executeWithReauth(
        () =>
          fetch(streamUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
            },
            credentials: 'include',
            body: JSON.stringify(payload),
            signal: abortController.signal,
          }),
        { dispatch: adapterInstance.dispatch, baseUrl: adapterInstance.baseUrl }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Stream request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = currentText;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'message';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            currentEvent = 'message';
            continue;
          }
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
            continue;
          }
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim();
            let data = null;
            try {
              data = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            if (currentEvent === 'text' && data?.delta) {
              accumulatedText += data.delta;
              if (store && existingMsg) {
                const updatedParts = (existingMsg.parts || []).map((p) =>
                  p.type === 'text' ? { ...p, text: accumulatedText } : p
                );
                if (!updatedParts.some((p) => p.type === 'text')) {
                  updatedParts.push({ type: 'text', text: accumulatedText });
                }
                store.update({
                  messagesById: {
                    ...store.state.messagesById,
                    [messageId]: {
                      ...existingMsg,
                      text: accumulatedText,
                      content: accumulatedText,
                      parts: updatedParts,
                      metadata: {
                        ...(existingMsg.metadata || {}),
                        isStopped: false,
                      },
                    },
                  },
                });
              }
            } else if (currentEvent === 'status' && data?.message) {
              adapterInstance.dispatch?.(setPipelineStatus(data.message));
            } else if (currentEvent === 'done') {
              adapterInstance.dispatch?.(setPipelineStatus(''));
              if (store && existingMsg) {
                store.update({
                  messagesById: {
                    ...store.state.messagesById,
                    [messageId]: {
                      ...existingMsg,
                      text: accumulatedText,
                      content: accumulatedText,
                      parts: (existingMsg.parts || []).map((p) =>
                        p.type === 'text' ? { ...p, text: accumulatedText } : p
                      ),
                      metadata: {
                        ...(existingMsg.metadata || {}),
                        isStopped: false,
                        model: data.model || existingMsg.metadata?.model,
                        usage: data.usage || existingMsg.metadata?.usage,
                      },
                    },
                  },
                });
              }
              adapterInstance.dispatch?.(
                apiSlice.util.invalidateTags([
                  { type: 'Chat', id: 'LIST' },
                  { type: 'Chat', id: targetChatId },
                ])
              );
              store?.setStreaming?.(false);
              return;
            } else if (currentEvent === 'error') {
              adapterInstance.dispatch?.(setPipelineStatus(''));
              throw new Error(data?.message || 'Continuation failed.');
            }
          }
        }
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        if (store && existingMsg) {
          store.update({
            messagesById: {
              ...store.state.messagesById,
              [messageId]: {
                ...existingMsg,
                metadata: {
                  ...(existingMsg.metadata || {}),
                  isStopped: true,
                },
              },
            },
          });
        }
      } else {
        console.warn('[MuiChatAdapter] continueGeneration error:', err);
        adapterInstance.onError?.(err);
      }
    } finally {
      store?.setStreaming?.(false);
      adapterInstance.dispatch?.(setPipelineStatus(''));
      adapterInstance.activeAbortController = null;
    }
  }

  /**
   * Universal retry method for failed or regenerated conversational turns.
   * Resolves the anchor user turn, enforces zero duplicate user turns,
   * passes isRetry: true with complete multi-modal context re-hydration metadata,
   * and dispatches through the streaming pipeline.
   *
   * @async
   * @param {object} input
   * @param {string} [input.conversationId] - Target conversation ID.
   * @param {string} [input.targetAssistantMessageId] - Assistant message ID being replaced.
   * @param {string} [input.anchorUserMessageId] - Prior user message ID being regenerated.
   * @param {string} [input.model] - Optional alternate AI model identifier.
   * @param {object} input.store - Headless chat store.
   * @param {AbortSignal} [input.signal] - Optional external abort signal.
   * @returns {Promise<ReadableStream>}
   */
  async retryTurn({ conversationId, targetAssistantMessageId, anchorUserMessageId, model, store, signal } = {}) {
    if (model) {
      this.setModel(model);
    }
    const currentIds = store?.state?.messageIds || [];
    let anchorId = anchorUserMessageId;
    if (!anchorId && targetAssistantMessageId) {
      const asstIdx = currentIds.indexOf(targetAssistantMessageId);
      if (asstIdx > 0) {
        anchorId = currentIds[asstIdx - 1];
      }
    }
    if (!anchorId) {
      anchorId = currentIds.findLast((id) => store?.state?.messagesById[id]?.role === 'user');
    }
    const anchorMessage = anchorId ? store?.state?.messagesById[anchorId] : null;
    if (!anchorMessage) {
      throw new Error('Cannot retry: anchor user message not found in store.');
    }
    const targetChatId = conversationId || this.currentChatId;
    const enrichedMessage = {
      ...anchorMessage,
      metadata: {
        ...(anchorMessage.metadata || {}),
        model: model || this.activeModel,
      },
    };
    return this.regenerate({
      conversationId: targetChatId,
      messageId: targetAssistantMessageId || `asst-retry-${Date.now()}`,
      message: enrichedMessage,
      messages: currentIds.map((id) => store?.state?.messagesById[id]).filter(Boolean),
      signal,
    });
  }
}

export default MuiChatAdapter;
