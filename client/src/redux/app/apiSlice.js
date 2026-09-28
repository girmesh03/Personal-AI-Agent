/**
 * @module redux/app/apiSlice
 * @description Central RTK Query Base API with automatic token refresh on 401,
 * credentials inclusion, and standardized response normalization.
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout } from '../features/authSlice.js';

/**
 * Base HTTP fetch query configuration with credentials inclusion and JSON headers.
 * @constant
 */
const baseQuery = fetchBaseQuery({
  baseUrl: (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:4000/api/v1',
  credentials: 'include',
  prepareHeaders: (headers) => {
    headers.set('Accept', 'application/json');
    return headers;
  },
});

/**
 * Custom base query wrapper intercepting 401 UNAUTHENTICATED errors to refresh session cookies.
 * Dispatches session logout when refresh token rotation fails.
 *
 * @function baseQueryWithReauth
 * @param {string|object} args - Query arguments or URL string.
 * @param {import('@reduxjs/toolkit/query').BaseQueryApi} api - Base query API context and dispatcher.
 * @param {object} extraOptions - Additional query execution options.
 * @returns {Promise<import('@reduxjs/toolkit/query').QueryReturnValue>} Query execution result.
 */
const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const url = typeof args === 'string' ? args : args.url;
    if (url.includes('/auth/refresh') || url.includes('/auth/login')) {
      return result;
    }

    const refreshResult = await baseQuery(
      { url: '/auth/refresh', method: 'POST' },
      api,
      extraOptions
    );

    if (refreshResult.data) {
      result = await baseQuery(args, api, extraOptions);
    } else {
      api.dispatch(logout());
    }
  }

  return result;
};

/**
 * Central RTK Query API slice definition.
 * Serves as the single root entry point for code-split injected feature endpoints.
 *
 * @constant
 * @type {import('@reduxjs/toolkit/query/react').Api}
 */
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Branch', 'Chat', 'Report', 'Preset'],
  endpoints: () => ({}),
});

export default apiSlice;
