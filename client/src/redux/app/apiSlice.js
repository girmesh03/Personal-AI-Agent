/**
 * @module redux/app/apiSlice
 * @description Central RTK Query Base API with concurrency-safe silent token refresh on 401,
 * credentials inclusion, multipart upload safety, tag definitions including Dashboard,
 * and centralized response and error envelope normalization.
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout, setCredentials } from '../features/authSlice.js';

/**
 * Normalizes API query and mutation responses and error envelopes so consumer
 * slices and components receive clean data without redundant nesting (e.g., data.data.<...>).
 * Also maps technical errors to empathetic, user-friendly messages.
 *
 * @function normalizeResult
 * @param {import('@reduxjs/toolkit/query').QueryReturnValue} result - Raw RTK Query return object.
 * @returns {import('@reduxjs/toolkit/query').QueryReturnValue} Normalized query return object.
 */
export const normalizeResult = (result) => {
  if (!result) return result;

  // 1. Normalize Successful Responses
  if (result.data !== undefined && result.data !== null && typeof result.data === 'object') {
    // If backend wrapped payload in standard { success, message, data } envelope
    if ('data' in result.data && result.data.data !== undefined) {
      result.data = result.data.data;
    }
  }

  // 2. Normalize Error Envelopes
  if (result.error) {
    const errorData = result.error.data;
    let message = 'An unexpected error occurred. Please try again.';
    let errors = null;

    if (result.error.status === 'FETCH_ERROR') {
      message = 'Unable to connect to the server. Please check your internet connection.';
    } else if (result.error.status === 401) {
      message = 'Please log in again to continue.';
    } else if (result.error.status === 403) {
      message = 'You do not have permission to access this resource.';
    } else if (result.error.status === 404) {
      message = 'The requested resource was not found.';
    } else if (result.error.status === 409) {
      message = 'A resource with this information already exists.';
    } else if (result.error.status === 422) {
      message = 'Please check the entered information and correct any validation issues.';
    } else if (result.error.status === 429) {
      message = 'Too many requests. Please wait a moment and try again.';
    } else if (result.error.status === 500) {
      message = 'A server error occurred. Our team has been notified. Please try again later.';
    }

    if (typeof errorData === 'string') {
      message = errorData;
    } else if (errorData && typeof errorData === 'object') {
      if (errorData.message) {
        message = errorData.message;
      }
      if (errorData.errors || errorData.details) {
        errors = errorData.errors || errorData.details;
      }
    }

    // Attach normalized properties directly to error
    result.error = {
      ...result.error,
      message,
      errors,
      data: {
        ...(typeof errorData === 'object' && errorData !== null ? errorData : {}),
        message,
        errors,
      },
    };
  }

  return result;
};

/**
 * Base HTTP fetch query configuration with credentials inclusion and JSON headers.
 * Safely preserves multipart form boundaries for audio and image uploads.
 * @constant
 */
const baseQuery = fetchBaseQuery({
  baseUrl: (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:4000/api/v1',
  credentials: 'include',
  prepareHeaders: (headers) => {
    // Standard JSON acceptance header
    headers.set('Accept', 'application/json');
    // Note: Do NOT explicitly set 'Content-Type' here. fetchBaseQuery automatically sets
    // 'application/json' for objects and leaves it unset for FormData so the browser
    // injects the correct multipart/form-data boundary for audio and image uploads.
    return headers;
  },
});

/** Concurrency lock promise preventing refresh token rotation race condition */
let activeRefreshPromise = null;

/**
 * Custom base query wrapper intercepting 401 UNAUTHENTICATED errors to refresh session cookies.
 * Strictly attempts token refresh only for logged-in users with active session state.
 * Uses a concurrency lock so parallel queries share a single refresh request.
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
    // Never attempt token refresh for public authentication endpoints
    if (
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/register')
    ) {
      return normalizeResult(result);
    }

    // Refresh token is strictly for currently logged-in users with active session state
    const state = api.getState();
    const isAuthenticated = state?.auth?.isAuthenticated;
    const user = state?.auth?.user;

    if (!isAuthenticated || !user) {
      return normalizeResult(result);
    }

    // Mutex concurrency lock: Only execute a single /auth/refresh at any time
    if (!activeRefreshPromise) {
      activeRefreshPromise = (async () => {
        try {
          return await baseQuery(
            { url: '/auth/refresh', method: 'POST' },
            api,
            extraOptions
          );
        } finally {
          activeRefreshPromise = null;
        }
      })();
    }

    const refreshResult = await activeRefreshPromise;

    if (refreshResult && refreshResult.data) {
      const refreshedUser = refreshResult.data?.data?.user || refreshResult.data?.user;
      if (refreshedUser) {
        api.dispatch(setCredentials({ user: refreshedUser }));
      }
      // Re-run original query with refreshed session credentials
      result = await baseQuery(args, api, extraOptions);
    } else {
      // Refresh failed silently: cleanly clear state without throwing unhandled exceptions
      api.dispatch(logout());
      api.dispatch(apiSlice.util.resetApiState());
    }
  }

  return normalizeResult(result);
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
  tagTypes: ['User', 'Branch', 'Chat', 'Report', 'Preset', 'Dashboard'],
  endpoints: () => ({}),
});

export default apiSlice;
