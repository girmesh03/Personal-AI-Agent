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
import { AUDIO_CONSTANTS, CHAT_PAGINATION } from '../utils/constants.js';

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
    this.getActiveChatId = getActiveChatId;
    this.activeAbortController = null;
    this.currentChatId = null;
    this.activeModel = null;
    this.activeThinkingBudget = undefined;
    this.activeLanguage = undefined;
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

        return {
          id: String(msg.id || msg._id),
          conversationId,
          role: isUser ? 'user' : 'assistant',
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
            isStopped: Boolean(msg.isStopped),
            thoughtDuration: msg.thoughtDuration || null,
          },
          createdAt: msg.createdAt
            ? new Date(msg.createdAt).toISOString()
            : new Date().toISOString(),
        };
      });

      return {
        messages: formatted,
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
  async sendMessage({ conversationId, message, messages, attachments, signal }) {
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

    const isRetry = Boolean(
      message?.isRetry ||
      message?.metadata?.isRetry
    );

    // 1. Pre-upload file attachments if present (differentiating audio notes vs document/image attachments)
    // On RETRY: Skip uploading and do not synthesize uploadedAttachments or uploadedAudioIds.
    // The server will re-hydrate multi-modal context directly from the persisted MongoDB turn record.
    let uploadedAttachments = [];
    let uploadedAudioIds = [];

    if (!isRetry) {
      const activeAttachments = [
        ...(Array.isArray(attachments) ? attachments : []),
        ...(Array.isArray(message?.attachments) ? message.attachments : []),
      ];

      if (Array.isArray(message?.audios) && message.audios.length > 0) {
        message.audios.forEach((a) => {
          const id = typeof a === 'string' ? a : (a?._id || a?.id);
          if (id && /^[0-9a-fA-F]{24}$/.test(String(id))) {
            if (!uploadedAudioIds.includes(String(id))) {
              uploadedAudioIds.push(String(id));
            }
          }
        });
      }

      if (activeAttachments.length === 0 && Array.isArray(message?.parts)) {
        message.parts.forEach((p) => {
          if (p.type === 'file' || p.type === 'audio') {
            activeAttachments.push({
              id: p.id,
              _id: p._id || p.id,
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
          const file = att.file;
          const mime = (att.mimeType || att.type || att.mediaType || (file && file.type) || '').toLowerCase();
          const cleanType = mime.split(';')[0].trim();
          const attName = (att.name || att.originalName || att.fileName || (file && file.name) || '').toLowerCase();

          const isAudioItem =
            (cleanType && (
              AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes(cleanType) ||
              cleanType.startsWith('audio/') ||
              cleanType === 'video/webm' ||
              cleanType === 'application/ogg'
            )) ||
            AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.some((ext) => attName.endsWith(ext));

          if (!file) {
            // Pre-existing uploaded attachment or audio from an earlier turn
            if (isAudioItem) {
              const rawId = att._id || att.id;
              if (rawId && /^[0-9a-fA-F]{24}$/.test(String(rawId))) {
                uploadedAudioIds.push(String(rawId));
              }
            } else if (att.fileName && (att.path || att.url)) {
              const rawPath = att.path || (att.url && att.url.replace(/^.*\/uploads\//, 'uploads/')) || att.url;
              const isBlobOrHttp = rawPath && (rawPath.startsWith('blob:') || rawPath.startsWith('http://') || rawPath.startsWith('https://'));
              if (isBlobOrHttp && !rawPath.includes('/uploads/')) {
                // Ephemeral client-only blob URL with no server path; ignore
                return;
              }
              const cleanPath = (rawPath ? rawPath.replace(/\\/g, '/').replace(/^.*\/uploads\//, 'uploads/').replace(/^\/+/, '') : '');
              uploadedAttachments.push({
                fileName: att.fileName,
                originalName: att.originalName || att.name || att.fileName,
                mimeType: att.mimeType || att.type || 'application/octet-stream',
                size: Number(att.size) || 1,
                path: cleanPath,
                url: att.url || (cleanPath ? `/${cleanPath}` : null),
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
          this.dispatch?.(setPipelineStatus('Uploading audio note...'));
          const audioFormData = new FormData();
          audioFiles.forEach((f) => audioFormData.append('audios', f));
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
          this.dispatch?.(setPipelineStatus('Uploading attachments...'));
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
      isRetry: isRetry || undefined,
      retryTurnIndex,
      anchorUserMessageId: message?.metadata?.anchorUserMessageId || (isRetry ? message?.id : undefined),
      targetAssistantMessageId: message?.metadata?.targetAssistantMessageId,
      editTurnIndex,
      model:
        (typeof this.getModel === 'function' ? this.getModel() : undefined) ||
        this.activeModel,
      thinkingBudget:
        (typeof this.getThinkingBudget === 'function' ? this.getThinkingBudget() : undefined) ??
        this.activeThinkingBudget,
      language:
        (typeof this.getLanguage === 'function' ? this.getLanguage() : undefined) ??
        this.activeLanguage,
      audios: uploadedAudioIds.length > 0 ? uploadedAudioIds : undefined,
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
    };

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
        const assistantMessageId = `asst-${Date.now()}`;
        controller.enqueue({
          type: 'start',
          messageId: assistantMessageId,
          author: { id: 'assistant', displayName: 'Operon', role: 'assistant' },
        });

        const textPartId = 'text-1';
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
}

export default MuiChatAdapter;
