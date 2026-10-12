/**
 * @module redux/features/chatSlice
 * @description Redux Toolkit slice and injected RTK Query endpoints managing
 * conversational AI chat sessions, SSE streaming telemetry, thread drawer state,
 * model inference preferences, and media upload mutations.
 */

import { createSlice } from '@reduxjs/toolkit';
import { apiSlice } from '../app/apiSlice.js';
import { AI_MODELS, CHAT_CONSTANTS } from '../../utils/constants.js';

/**
 * Initial UI state for conversational canvas.
 * @constant
 * @type {{
 *   activeChatId: string|null,
 *   isDrawerOpen: boolean,
 *   activeModel: string,
 *   thinkingBudget: number,
 *   language: string,
 *   sttEngine: string,
 *   isStreaming: boolean,
 *   streamingStatus: 'idle'|'reasoning'|'answering'|'error',
 * }}
 */
const initialState = {
  activeChatId: null,
  isDrawerOpen: false,
  activeModel: AI_MODELS.DEFAULT,
  thinkingBudget: CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET,
  language: CHAT_CONSTANTS.DEFAULT_LANGUAGE,
  sttEngine: CHAT_CONSTANTS.DEFAULT_STT_ENGINE,
  isStreaming: false,
  streamingStatus: 'idle',
  pipelineStatus: '',
};

/**
 * Synchronous UI state slice for conversational AI chat experience.
 * @constant
 */
export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    /**
     * Sets currently active chat session identifier.
     * @param {object} state - Current slice state.
     * @param {{ payload: string|null }} action - Action payload.
     */
    setActiveChatId: (state, action) => {
      state.activeChatId = action.payload || null;
    },

    /**
     * Toggles or explicitly sets history drawer visibility.
     * @param {object} state - Current slice state.
     * @param {{ payload?: boolean }} action - Optional explicit boolean.
     */
    toggleDrawer: (state, action) => {
      state.isDrawerOpen =
        typeof action.payload === 'boolean' ? action.payload : !state.isDrawerOpen;
    },

    /**
     * Sets history drawer visibility explicitly.
     * @param {object} state - Current slice state.
     * @param {{ payload: boolean }} action - Action payload.
     */
    setDrawerOpen: (state, action) => {
      state.isDrawerOpen = Boolean(action.payload);
    },

    /**
     * Sets selected Gemini model identifier.
     * @param {object} state - Current slice state.
     * @param {{ payload: string }} action - Selected model string.
     */
    setActiveModel: (state, action) => {
      if (action.payload) {
        state.activeModel = action.payload;
      }
    },

    /**
     * Updates thinking budget clamped between system bounds.
     * @param {object} state - Current slice state.
     * @param {{ payload: number }} action - Thinking budget in tokens.
     */
    setThinkingBudget: (state, action) => {
      const budget = Number(action.payload);
      if (!Number.isNaN(budget)) {
        state.thinkingBudget = Math.max(
          CHAT_CONSTANTS.MIN_THINKING_BUDGET,
          Math.min(budget, CHAT_CONSTANTS.MAX_THINKING_BUDGET)
        );
      }
    },

    /**
     * Sets synthesis language preference ('am'|'en'|'auto').
     * @param {object} state - Current slice state.
     * @param {{ payload: string }} action - Language code.
     */
    setLanguage: (state, action) => {
      if (action.payload) {
        state.language = action.payload;
      }
    },

    /**
     * Sets speech-to-text transcription engine ('addis_ai'|'gemini-2.5-flash').
     * @param {object} state - Current slice state.
     * @param {{ payload: string }} action - Engine name.
     */
    setSttEngine: (state, action) => {
      if (action.payload) {
        state.sttEngine = action.payload;
      }
    },

    /**
     * Updates active streaming flag. Resets status to idle when streaming terminates.
     * @param {object} state - Current slice state.
     * @param {{ payload: boolean }} action - Streaming flag.
     */
    setIsStreaming: (state, action) => {
      state.isStreaming = Boolean(action.payload);
      if (!state.isStreaming && state.streamingStatus !== 'idle') {
        state.streamingStatus = 'idle';
      }
    },

    /**
     * Sets granular streaming phase.
     * @param {object} state - Current slice state.
     * @param {{ payload: 'idle'|'reasoning'|'answering'|'error' }} action - Stream phase.
     */
    setStreamingStatus: (state, action) => {
      state.streamingStatus = action.payload || 'idle';
    },

    /**
     * Sets real-time dynamic pipeline status string for multi-modal ingestion and tool execution.
     * @param {object} state - Current slice state.
     * @param {{ payload: string }} action - Pipeline status string.
     */
    setPipelineStatus: (state, action) => {
      state.pipelineStatus = action.payload || '';
    },

    /**
     * Resets canvas UI state to pristine defaults.
     * @param {object} state - Current slice state.
     */
    resetChatUiState: (state) => {
      state.activeChatId = null;
      state.isStreaming = false;
      state.streamingStatus = 'idle';
      state.pipelineStatus = '';
    },
  },
});

export const {
  setActiveChatId,
  toggleDrawer,
  setDrawerOpen,
  setActiveModel,
  setThinkingBudget,
  setLanguage,
  setSttEngine,
  setIsStreaming,
  setStreamingStatus,
  setPipelineStatus,
  resetChatUiState,
} = chatSlice.actions;

// Synchronous Selectors
export const selectActiveChatId = (state) => state.chat?.activeChatId ?? null;
export const selectIsDrawerOpen = (state) => state.chat?.isDrawerOpen ?? false;
export const selectActiveModel = (state) => state.chat?.activeModel ?? AI_MODELS.DEFAULT;
export const selectThinkingBudget = (state) =>
  state.chat?.thinkingBudget ?? CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET;
export const selectLanguage = (state) =>
  state.chat?.language ?? CHAT_CONSTANTS.DEFAULT_LANGUAGE;
export const selectSttEngine = (state) =>
  state.chat?.sttEngine ?? CHAT_CONSTANTS.DEFAULT_STT_ENGINE;
export const selectIsStreaming = (state) => state.chat?.isStreaming ?? false;
export const selectStreamingStatus = (state) => state.chat?.streamingStatus ?? 'idle';
export const selectPipelineStatus = (state) => state.chat?.pipelineStatus ?? '';

/**
 * Chat API endpoints injected into central RTK Query apiSlice.
 * Scoped to tag 'Chat' with fine-grained query invalidation.
 * @constant
 */
export const chatApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Retrieves paginated chat sessions list.
     */
    getChats: builder.query({
      query: (params) => ({
        url: '/chat',
        params,
      }),
      providesTags: (result) =>
        result?.chats
          ? [
              ...result.chats.map(({ _id }) => ({ type: 'Chat', id: _id })),
              { type: 'Chat', id: 'LIST' },
            ]
          : [{ type: 'Chat', id: 'LIST' }],
    }),

    /**
     * Retrieves full chat session with message history.
     */
    getChatById: builder.query({
      query: ({ chatId, limit = 30 }) => ({
        url: `/chat/${chatId}`,
        params: { limit },
      }),
      providesTags: (_result, _error, { chatId }) => [{ type: 'Chat', id: chatId }],
    }),

    /**
     * Dedicated transcription mutation for audio blobs.
     */
    transcribeAudio: builder.mutation({
      query: (formData) => ({
        url: '/chat/transcribe-audio',
        method: 'POST',
        body: formData,
      }),
    }),

    /**
     * Uploads audio recordings for chat grounding.
     */
    uploadAudio: builder.mutation({
      query: (formData) => ({
        url: '/chat/upload-audio',
        method: 'POST',
        body: formData,
      }),
    }),

    /**
     * Uploads document and image attachments for chat grounding.
     */
    uploadAttachments: builder.mutation({
      query: (formData) => ({
        url: '/chat/upload-attachments',
        method: 'POST',
        body: formData,
      }),
    }),

    /**
     * Toggles pinned status for a chat session.
     */
    pinChat: builder.mutation({
      query: (chatId) => ({
        url: `/chat/${chatId}/pin`,
        method: 'PATCH',
      }),
      invalidatesTags: [{ type: 'Chat', id: 'LIST' }],
    }),

    /**
     * Renames chat session title.
     */
    renameChat: builder.mutation({
      query: ({ chatId, title }) => ({
        url: `/chat/${chatId}/title`,
        method: 'PATCH',
        body: { title },
      }),
      invalidatesTags: (_result, _error, { chatId }) => [
        { type: 'Chat', id: chatId },
        { type: 'Chat', id: 'LIST' },
      ],
    }),

    /**
     * Updates chat model parameters (model, thinkingBudget, language, persona).
     */
    updateChatConfig: builder.mutation({
      query: ({ chatId, ...config }) => ({
        url: `/chat/${chatId}/config`,
        method: 'PATCH',
        body: config,
      }),
      invalidatesTags: (_result, _error, { chatId }) => [{ type: 'Chat', id: chatId }],
    }),

    /**
     * Permanently deletes a chat session and its turn history.
     */
    deleteChat: builder.mutation({
      query: (chatId) => ({
        url: `/chat/${chatId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Chat', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetChatsQuery,
  useGetChatByIdQuery,
  useTranscribeAudioMutation,
  useUploadAudioMutation,
  useUploadAttachmentsMutation,
  usePinChatMutation,
  useRenameChatMutation,
  useUpdateChatConfigMutation,
  useDeleteChatMutation,
} = chatApi;

export default chatSlice.reducer;
