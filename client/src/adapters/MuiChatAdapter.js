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
import { chatApi, setActiveChatId } from '../redux/features/chatSlice.js';
import { AUDIO_CONSTANTS } from '../utils/constants.js';

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
          { page, limit: 50, search: input.query },
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
          { chatId: conversationId, limit: 50, before: cursor },
          { forceRefetch: Boolean(cursor) }
        )
      ).unwrap();

      const rawMessages =
        result?.chat?.messages ||
        result?.data?.chat?.messages ||
        result?.messages ||
        [];

      const formatted = rawMessages.map((msg) => {
        const isUser = msg.role === 'user';
        const textContent =
          msg.text ||
          (Array.isArray(msg.parts) ? msg.parts[0]?.text : '') ||
          '';

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
          parts: [{ type: 'text', text: textContent }],
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
   * Sends user message to backend SSE endpoint and yields live ChatMessageChunk stream.
   *
   * @async
   * @param {object} input
   * @param {string} [input.conversationId] - Active conversation ID.
   * @param {object} input.message - User ChatMessage entity.
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

    // 1. Pre-upload file attachments if present (differentiating audio notes vs document/image attachments)
    let uploadedAttachments = [];
    let uploadedAudioIds = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      const audioFiles = [];
      const docFiles = [];

      attachments.forEach((att) => {
        const file = att.file;
        if (!file) return;
        const fileType = (file.type || '').toLowerCase();
        const cleanType = fileType.split(';')[0].trim();
        const fileName = (file.name || '').toLowerCase();

        const isAudio =
          (fileType && (
            AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes(fileType) ||
            AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes(cleanType) ||
            cleanType.startsWith('audio/') ||
            cleanType === 'video/webm' ||
            cleanType === 'application/ogg'
          )) ||
          AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

        if (isAudio) {
          audioFiles.push(file);
        } else {
          docFiles.push(file);
        }
      });

      // 1.1 Upload audio files to /chat/upload-audio under field 'audios' with re-auth protection
      if (audioFiles.length > 0) {
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
        uploadedAudioIds = rawAudios.map((a) => a._id || a.id).filter(Boolean);
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
        uploadedAttachments = uploadData?.data?.attachments || uploadData?.attachments || [];
      }
    }

    const retryTurnIndex =
      typeof message?.retryTurnIndex === 'number'
        ? message.retryTurnIndex
        : undefined;

    const payload = {
      id: message?.id,
      text: userText,
      chatId: targetChatId,
      retryTurnIndex,
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
        const reasoningPartId = 'reasoning-1';
        let hasTextStarted = false;
        let hasTextEnded = false;
        let hasReasoningStarted = false;
        let hasReasoningEnded = false;

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
                  // Synchronize active conversation ID with Redux store
                  adapterInstance.dispatch?.(setActiveChatId(data.chatId));
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
                    if (!hasReasoningStarted) {
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

                case 'text': {
                  if (data.delta) {
                    if (hasReasoningStarted && !hasReasoningEnded) {
                      controller.enqueue({
                        type: 'reasoning-end',
                        id: reasoningPartId,
                      });
                      hasReasoningEnded = true;
                    }
                    if (!hasTextStarted) {
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
                    type: 'finish',
                    messageId: assistantMessageId,
                  });

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
                  });

                  controller.close();
                  return;
                }

                case 'error': {
                  if (hasReasoningStarted && !hasReasoningEnded) {
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: reasoningPartId,
                    });
                    hasReasoningEnded = true;
                  }
                  if (!hasTextStarted) {
                    controller.enqueue({
                      type: 'text-start',
                      id: textPartId,
                    });
                    hasTextStarted = true;
                  }
                  controller.enqueue({
                    type: 'text-delta',
                    id: textPartId,
                    delta: `\n\n> ⚠️ **Error**: ${data.message || 'Streaming failed.'}`,
                  });
                  controller.enqueue({
                    type: 'text-end',
                    id: textPartId,
                  });
                  hasTextEnded = true;
                  controller.enqueue({
                    type: 'finish',
                    messageId: assistantMessageId,
                    finishReason: data.reason || 'error',
                  });
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
            controller.enqueue({
              type: 'finish',
              messageId: assistantMessageId,
              finishReason: 'stop',
            });
          } else {
            if (hasReasoningStarted && !hasReasoningEnded) {
              controller.enqueue({
                type: 'reasoning-end',
                id: reasoningPartId,
              });
            }
            if (!hasTextStarted) {
              controller.enqueue({
                type: 'text-start',
                id: textPartId,
              });
            }
            controller.enqueue({
              type: 'text-delta',
              id: textPartId,
              delta: `\n\n> ⚠️ **Connection Error**: ${streamErr.message || 'Stream connection failed.'}`,
            });
            controller.enqueue({
              type: 'text-end',
              id: textPartId,
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
