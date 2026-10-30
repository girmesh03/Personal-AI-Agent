/**
 * @module redux/features/sttSlice
 * @description Injected RTK Query endpoints for standalone Speech-to-Text (STT) services.
 * Mounted at /api/v1/stt, completely decoupled from chat domains.
 */

import { apiSlice } from '../app/apiSlice.js';

export const sttApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Generates a single-use session ticket and WebSocket URL for Addis AI Scribe Live STT.
     */
    createScribeSession: builder.mutation({
      query: (params = {}) => ({
        url: '/stt/scribe-session',
        method: 'POST',
        body: params,
      }),
    }),
  }),
});

export const { useCreateScribeSessionMutation } = sttApi;
export default sttApi;
