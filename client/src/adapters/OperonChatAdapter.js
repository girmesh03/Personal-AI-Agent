/**
 * @module adapters/OperonChatAdapter
 * @description Native ChatAdapter connecting Express 5 SSE streaming pipeline to MUI X Chat runtime.
 * Implements the @mui/x-chat-headless ChatAdapter contract, Two-Phase Ingestion for audio/attachments,
 * strongly-typed SSE chunk decoding, stream cancellation via AbortController, and report/directive metadata extraction.
 */

/**
 * Default API base URL from client environment configuration.
 * @constant
 * @type {string}
 */
const DEFAULT_API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:4000/api/v1';

/**
 * Operon Streaming ChatAdapter for MUI X Chat headless runtime.
 * Handles two-phase upload ingestion, SSE chunk parsing, and conversation/message queries.
 *
 * @class OperonChatAdapter
 */
export class OperonChatAdapter {
  /**
   * Initializes the chat adapter with API options and lifecycle callbacks.
   *
   * @constructor
   * @param {object} [options={}] - Configuration options.
   * @param {string} [options.baseUrl=DEFAULT_API_BASE] - Target API base URL.
   * @param {(data: { chatId?: string, title?: string, model?: string, usage?: object }) => void} [options.onSessionCreated] - Callback when session completes or done event fires.
   * @param {(data: { title: string }) => void} [options.onTitleGenerated] - Callback when server auto-generates a thread title.
   * @param {(error: object|Error) => void} [options.onError] - Error handler callback.
   */
  constructor({
    baseUrl = DEFAULT_API_BASE,
    onSessionCreated,
    onTitleGenerated,
    onError,
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.onSessionCreated = onSessionCreated;
    this.onTitleGenerated = onTitleGenerated;
    this.onError = onError;
    this.activeAbortController = null;
  }

  /**
   * Dispatches a user message turn to the backend streaming pipeline.
   * Implements Two-Phase Ingestion:
   * Phase 1: Uploads any attached audio recordings and document/image files to obtain server IDs.
   * Phase 2: Dispatches structured JSON payload to Express 5 SSE streaming endpoint.
   * Phase 3: Converts raw SSE chunk byte stream into ReadableStream<ChatMessageChunk>.
   *
   * @param {object} input - Adapter send input.
   * @param {import('@mui/x-chat-headless').ChatMessage} input.message - User message entity.
   * @param {import('@mui/x-chat-headless').ChatMessage[]} [input.messages=[]] - Thread messages context.
   * @param {import('@mui/x-chat-headless').ChatDraftAttachment[]} [input.attachments=[]] - Composer draft attachments.
   * @param {string} [input.conversationId] - Active conversation ID.
   * @param {Record<string, unknown>} [input.metadata] - Optional additional metadata.
   * @param {AbortSignal} [input.signal] - Runtime abort signal from chat runtime.
   * @returns {Promise<ReadableStream<import('@mui/x-chat-headless').ChatMessageChunk>>}
   */
  async sendMessage(input) {
    const {
      message,
      attachments: draftAttachments = [],
      conversationId: inputConvId,
      metadata: inputMetadata = {},
      signal,
    } = input || {};

    if (!message) {
      throw new Error('A valid message object is required to send.');
    }

    // Set up active abort controller
    this.activeAbortController = new AbortController();
    const activeSignal = this.activeAbortController.signal;

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          this.stop();
        },
        { once: true }
      );
    }

    // Determine target endpoint via resilient multi-tier resolution hierarchy
    const conversationId =
      inputConvId ??
      input?.chatId ??
      message?.conversationId ??
      message?.chatId ??
      inputMetadata?.chatId ??
      null;
    const isNewSession = !conversationId || conversationId === 'new';
    const endpoint = isNewSession
      ? `${this.baseUrl}/chat/stream`
      : `${this.baseUrl}/chat/${conversationId}/stream`;

    // Extract message content and file parts
    const textPart = (message.parts || []).find((p) => p.type === 'text');
    const textContent = (textPart?.text || '').trim();

    const fileParts = (message.parts || []).filter((p) => p.type === 'file');

    // Aggregate files across parts and draft attachments
    const audioFilesToUpload = [];
    const docFilesToUpload = [];
    const retainedAudioIds = [];
    const retainedAttachments = [];

    // Helper to categorize raw file
    const categorizeFile = (file) => {
      if (!file) return;
      const type = (file.type || '').toLowerCase();
      const name = (file.name || '').toLowerCase();
      const isAudio =
        type.startsWith('audio/') ||
        name.endsWith('.webm') ||
        name.endsWith('.mp3') ||
        name.endsWith('.m4a') ||
        name.endsWith('.wav') ||
        name.endsWith('.ogg');

      if (isAudio) {
        audioFilesToUpload.push(file);
      } else {
        docFilesToUpload.push(file);
      }
    };

    // 1. Inspect parts
    for (const part of fileParts) {
      if (part.file) {
        categorizeFile(part.file);
      } else if (part.url && part.id) {
        // Pre-existing uploaded media (e.g. from inline turn edit)
        if (part.mediaType && part.mediaType.startsWith('audio/')) {
          retainedAudioIds.push(part.id);
        } else {
          retainedAttachments.push({
            fileName: part.id,
            originalName: part.filename || part.id,
            mimeType: part.mediaType || 'application/octet-stream',
            url: part.url,
          });
        }
      }
    }

    // 2. Inspect draft attachments
    for (const draft of draftAttachments) {
      if (draft.file) {
        categorizeFile(draft.file);
      }
    }

    // 3. Inspect metadata
    if (Array.isArray(message.metadata?.files)) {
      message.metadata.files.forEach(categorizeFile);
    }

    // Phase 1: Upload media files if present
    const audioIds = [...retainedAudioIds];
    const attachments = [...retainedAttachments];

    if (audioFilesToUpload.length > 0) {
      const audioFormData = new FormData();
      audioFilesToUpload.forEach((af) => audioFormData.append('audios', af));

      const audioRes = await fetch(`${this.baseUrl}/chat/upload-audio`, {
        method: 'POST',
        body: audioFormData,
        credentials: 'include',
        signal: activeSignal,
      });

      if (!audioRes.ok) {
        const errorJson = await audioRes.json().catch(() => ({}));
        throw new Error(
          errorJson.message || `Failed to upload audio recording (${audioRes.status}).`
        );
      }

      const audioData = await audioRes.json();
      const uploadedAudios = audioData.data?.audios || audioData.audios || [];
      uploadedAudios.forEach((a) => {
        if (a._id) audioIds.push(a._id);
      });
    }

    if (docFilesToUpload.length > 0) {
      const docFormData = new FormData();
      docFilesToUpload.forEach((df) => docFormData.append('attachments', df));

      const docRes = await fetch(`${this.baseUrl}/chat/upload-attachments`, {
        method: 'POST',
        body: docFormData,
        credentials: 'include',
        signal: activeSignal,
      });

      if (!docRes.ok) {
        const errorJson = await docRes.json().catch(() => ({}));
        throw new Error(
          errorJson.message || `Failed to upload attachments (${docRes.status}).`
        );
      }

      const docData = await docRes.json();
      const uploadedAttachments = docData.data?.attachments || docData.attachments || [];
      uploadedAttachments.forEach((att) => attachments.push(att));
    }

    // Phase 2: Send structured JSON payload to SSE stream endpoint
    const requestPayload = {
      text: textContent,
      audios: audioIds,
      attachments,
      editTurnIndex:
        message.metadata?.editTurnIndex ?? inputMetadata.editTurnIndex ?? undefined,
      retryTurnIndex:
        message.metadata?.retryTurnIndex ?? inputMetadata.retryTurnIndex ?? undefined,
      model: message.metadata?.model ?? inputMetadata.model ?? undefined,
      thinkingBudget:
        message.metadata?.thinkingBudget ?? inputMetadata.thinkingBudget ?? undefined,
      language: message.metadata?.language ?? inputMetadata.language ?? undefined,
      sttEngine: message.metadata?.sttEngine ?? inputMetadata.sttEngine ?? undefined,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(requestPayload),
      credentials: 'include',
      signal: activeSignal,
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(
        errorJson.message || `Chat request failed with status ${response.status}`
      );
    }

    if (!response.body) {
      throw new Error('Server returned an empty streaming response body.');
    }

    // Phase 3: Convert SSE stream into ReadableStream<ChatMessageChunk>
    return this.createChunkStreamFromSSE(response.body, activeSignal);
  }

  /**
   * Transforms raw SSE byte stream into strongly-typed ChatMessageChunk events.
   *
   * @param {ReadableStream<Uint8Array>} sseStream - Raw response body stream.
   * @param {AbortSignal} signal - Active cancellation signal.
   * @returns {ReadableStream<import('@mui/x-chat-headless').ChatMessageChunk>}
   */
  createChunkStreamFromSSE(sseStream, signal) {
    const reader = sseStream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const self = this;
    const assistantMessageId = `asst-${Date.now()}`;
    const reasoningId = `reasoning-${Date.now()}`;
    const textId = `text-${Date.now()}`;

    return new ReadableStream({
      async start(controller) {
        controller.enqueue({ type: 'start', messageId: assistantMessageId });

        let isReasoningOpen = false;
        let isTextOpen = false;
        let activeReportData = null;
        let activeDirectiveData = null;
        let currentToolCallId = null;

        try {
          while (true) {
            if (signal.aborted) {
              controller.enqueue({ type: 'abort', messageId: assistantMessageId });
              break;
            }

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split('\n\n');
            buffer = blocks.pop() || '';

            for (const block of blocks) {
              if (!block.trim()) continue;

              let eventType = 'message';
              let dataStr = '';

              const lines = block.split('\n');
              for (const line of lines) {
                if (line.startsWith('event:')) {
                  eventType = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                  dataStr = line.slice(5).trim();
                }
              }

              if (!dataStr) continue;

              let payload;
              try {
                payload = JSON.parse(dataStr);
              } catch {
                continue;
              }

              switch (eventType) {
                case 'thought':
                  if (!isReasoningOpen) {
                    controller.enqueue({
                      type: 'reasoning-start',
                      id: reasoningId,
                    });
                    isReasoningOpen = true;
                  }
                  controller.enqueue({
                    type: 'reasoning-delta',
                    id: reasoningId,
                    delta: payload.delta || '',
                  });
                  break;

                case 'tool_call':
                  if (isReasoningOpen) {
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: reasoningId,
                    });
                    isReasoningOpen = false;
                  }
                  currentToolCallId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                  controller.enqueue({
                    type: 'tool-input-start',
                    toolCallId: currentToolCallId,
                    toolName: payload.name,
                  });
                  controller.enqueue({
                    type: 'tool-input-available',
                    toolCallId: currentToolCallId,
                    toolName: payload.name,
                    input: payload.args || {},
                  });
                  break;

                case 'tool_result':
                  controller.enqueue({
                    type: 'tool-output-available',
                    toolCallId: currentToolCallId || `call-${Date.now()}`,
                    output: payload.result,
                  });

                  if (
                    payload.name === 'create_report' &&
                    (payload.result?.reportId || payload.result?._id)
                  ) {
                    activeReportData = payload.result;
                  }
                  if (payload.name === 'save_supervisor_directive') {
                    activeDirectiveData = payload.result;
                  }
                  break;

                case 'text':
                  if (isReasoningOpen) {
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: reasoningId,
                    });
                    isReasoningOpen = false;
                  }
                  if (!isTextOpen) {
                    controller.enqueue({
                      type: 'text-start',
                      id: textId,
                    });
                    isTextOpen = true;
                  }
                  controller.enqueue({
                    type: 'text-delta',
                    id: textId,
                    delta: payload.delta || '',
                  });
                  break;

                case 'title':
                  if (typeof self.onTitleGenerated === 'function') {
                    self.onTitleGenerated({ title: payload.title });
                  }
                  break;

                case 'done':
                  if (isReasoningOpen) {
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: reasoningId,
                    });
                    isReasoningOpen = false;
                  }
                  if (isTextOpen) {
                    controller.enqueue({
                      type: 'text-end',
                      id: textId,
                    });
                    isTextOpen = false;
                  }

                  if (typeof self.onSessionCreated === 'function') {
                    self.onSessionCreated({
                      chatId: payload.chatId,
                      title: payload.title,
                      model: payload.model,
                      usage: payload.usage,
                    });
                  }

                  controller.enqueue({
                    type: 'message-metadata',
                    metadata: {
                      report: activeReportData,
                      directive: activeDirectiveData,
                      model: payload.model,
                      usage: payload.usage,
                      chatId: payload.chatId,
                      turnIndex: payload.turnIndex,
                    },
                  });

                  controller.enqueue({
                    type: 'finish',
                    messageId: assistantMessageId,
                    finishReason: 'stop',
                  });
                  break;

                case 'error':
                  if (isReasoningOpen) {
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: reasoningId,
                    });
                    isReasoningOpen = false;
                  }
                  if (isTextOpen) {
                    controller.enqueue({
                      type: 'text-end',
                      id: textId,
                    });
                    isTextOpen = false;
                  }
                  controller.enqueue({
                    type: 'abort',
                    messageId: assistantMessageId,
                  });
                  if (typeof self.onError === 'function') {
                    self.onError(payload);
                  }
                  break;

                default:
                  break;
              }
            }
          }
        } catch (err) {
          if (isReasoningOpen) {
            controller.enqueue({ type: 'reasoning-end', id: reasoningId });
          }
          if (isTextOpen) {
            controller.enqueue({ type: 'text-end', id: textId });
          }
          controller.enqueue({ type: 'abort', messageId: assistantMessageId });
          throw err;
        } finally {
          controller.close();
        }
      },
    });
  }

  /**
   * Explicitly aborts the active stream connection and cleans up controller state.
   */
  stop() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  /**
   * Loads historical messages for a given chat session, mapping MongoDB document structure
   * into strongly-typed ChatMessage objects with parts and metadata.
   *
   * @param {object} input - Input payload.
   * @param {string} input.conversationId - Session identifier.
   * @param {string} [input.cursor] - Pagination cursor.
   * @returns {Promise<{ messages: import('@mui/x-chat-headless').ChatMessage[], cursor: string|null, hasMore: boolean }>}
   */
  async listMessages(input = {}) {
    const { conversationId: convId, chatId, cursor } = input || {};
    const conversationId = convId ?? chatId ?? null;
    if (!conversationId || conversationId === 'new') {
      return { messages: [], cursor: null, hasMore: false };
    }

    const limit = 30;
    const res = await fetch(`${this.baseUrl}/chat/${conversationId}?limit=${limit}`, {
      credentials: 'include',
    });

    if (!res.ok) {
      return { messages: [], cursor: null, hasMore: false };
    }

    const data = await res.json();
    const chat = data.data?.chat || data.chat;

    const mapped = (chat?.messages || []).map((m, idx) => {
      const parts = [];

      // 1. Reasoning part
      if (m.thought) {
        parts.push({
          type: 'reasoning',
          text: m.thought,
          state: 'done',
        });
      }

      // 2. Tool calls
      (m.toolCalls || []).forEach((tc, tcIdx) => {
        parts.push({
          type: 'tool',
          toolInvocation: {
            toolCallId: tc.id || tc._id || `tool-${idx}-${tcIdx}`,
            toolName: tc.name,
            state: 'output-available',
            input: tc.args || {},
            output: tc.result,
          },
        });
      });

      // 3. Text markdown part
      if (m.text) {
        parts.push({
          type: 'text',
          text: m.text,
          state: 'done',
        });
      }

      // 4. Audio files
      (m.audios || []).forEach((a) => {
        parts.push({
          type: 'file',
          mediaType: a.mimeType || 'audio/webm',
          url: a.url || a.path,
          id: a._id,
          filename: a.originalName || 'Audio Recording',
        });
      });

      // 5. Attachments
      (m.attachments || []).forEach((att) => {
        parts.push({
          type: 'file',
          mediaType: att.mimeType || 'application/octet-stream',
          url: att.url,
          id: att.fileName || att._id,
          filename: att.originalName || att.fileName,
        });
      });

      // Extract report or directive from toolCalls
      const createReportCall = (m.toolCalls || []).find((tc) => tc.name === 'create_report');
      const saveDirectiveCall = (m.toolCalls || []).find(
        (tc) => tc.name === 'save_supervisor_directive'
      );

      return {
        id: m._id || m.id || `msg-${idx}`,
        conversationId,
        role: m.role || 'assistant',
        status: 'sent',
        parts,
        metadata: {
          turnIndex: idx,
          report: createReportCall?.result || null,
          directive: saveDirectiveCall?.result || null,
          model: m.model,
          usage: m.usage,
        },
        createdAt: m.createdAt,
      };
    });

    return {
      messages: mapped,
      cursor: null,
      hasMore: false,
    };
  }

  /**
   * Loads user chat sessions list for the thread drawer.
   *
   * @param {object} [input={}] - Input payload.
   * @param {string} [input.cursor] - Page cursor string.
   * @returns {Promise<{ conversations: import('@mui/x-chat-headless').ChatConversation[], cursor: string|null, hasMore: boolean }>}
   */
  async listConversations(input = {}) {
    const cursor = input.cursor;
    const page = cursor ? parseInt(cursor, 10) : 1;

    const res = await fetch(`${this.baseUrl}/chat?page=${page}&limit=20`, {
      credentials: 'include',
    });

    if (!res.ok) {
      return { conversations: [], cursor: null, hasMore: false };
    }

    const data = await res.json();
    const payload = data.data || data;

    const conversations = (payload.chats || []).map((c) => ({
      id: c._id,
      title: c.title || 'Operational Discussion',
      isPinned: Boolean(c.isPinned),
      updatedAt: c.updatedAt,
      metadata: {
        model: c.model,
        thinkingBudget: c.thinkingBudget,
        language: c.language,
      },
    }));

    const currentPage = payload.pagination?.page || page;
    const totalPages = payload.pagination?.totalPages || 1;
    const hasMore = currentPage < totalPages;

    return {
      conversations,
      cursor: hasMore ? String(currentPage + 1) : null,
      hasMore,
    };
  }
}

/**
 * Factory helper for creating an OperonChatAdapter instance.
 *
 * @function createOperonChatAdapter
 * @param {object} [options={}] - Adapter configuration.
 * @returns {OperonChatAdapter}
 */
export const createOperonChatAdapter = (options) => new OperonChatAdapter(options);

export default OperonChatAdapter;
