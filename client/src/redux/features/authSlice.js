/**
 * @module redux/features/authSlice
 * @description Redux Toolkit slice and injected RTK Query endpoints managing
 * supervisor session authentication state and auth lifecycle operations.
 */

import { createSlice } from '@reduxjs/toolkit';
import { apiSlice } from '../app/apiSlice.js';

/**
 * Initial authentication state.
 * @constant
 * @type {{ user: object|null, isAuthenticated: boolean, isLoading: boolean }}
 */
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
};

/**
 * Authentication slice managing user session state and profile updates.
 * @constant
 */
export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const user = action.payload?.user || action.payload;
      state.user = user;
      state.isAuthenticated = Boolean(user);
      state.isLoading = false;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    updateUserProfile: (state, action) => {
      const updatedFields = action.payload?.user || action.payload;
      if (updatedFields) {
        state.user = state.user
          ? { ...state.user, ...updatedFields }
          : updatedFields;
      }
    },
  },
});

/**
 * Authentication synchronous action creators.
 */
export const {
  setCredentials,
  logout,
  setLoading,
  updateUserProfile,
} = authSlice.actions;

/**
 * Selects the authenticated user profile object from Redux state.
 *
 * @function selectCurrentUser
 * @param {object} state - Root Redux state tree.
 * @returns {object|null} Authenticated user profile or null.
 */
export const selectCurrentUser = (state) => state.auth.user;

/**
 * Selects the authenticated user profile object from Redux state (alias).
 *
 * @function selectAuthUser
 * @param {object} state - Root Redux state tree.
 * @returns {object|null} Authenticated user profile or null.
 */
export const selectAuthUser = (state) => state.auth.user;

/**
 * Selects the session authentication boolean flag from Redux state.
 *
 * @function selectIsAuthenticated
 * @param {object} state - Root Redux state tree.
 * @returns {boolean} True if supervisor is currently authenticated.
 */
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;

/**
 * Selects the session loading boolean flag from Redux state.
 *
 * @function selectAuthLoading
 * @param {object} state - Root Redux state tree.
 * @returns {boolean} True if initial session hydration is pending.
 */
export const selectAuthLoading = (state) => state.auth.isLoading;

/**
 * Selects the current categorical authentication status string.
 *
 * @function selectAuthStatus
 * @param {object} state - Root Redux state tree.
 * @returns {'LOADING'|'AUTHENTICATED'|'UNAUTHENTICATED'} Active session status.
 */
export const selectAuthStatus = (state) => {
  if (state.auth.isLoading) return 'LOADING';
  return state.auth.isAuthenticated ? 'AUTHENTICATED' : 'UNAUTHENTICATED';
};

/**
 * Authentication API endpoints injected into the core RTK Query slice.
 * @constant
 */
export const authApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation({
      query: (credentials) => ({
        url: '/auth/register',
        method: 'POST',
        body: credentials,
      }),
    }),
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Normalized by apiSlice: data.user is directly accessible
          const user = data?.user || data?.data?.user;
          if (user) {
            dispatch(setCredentials({ user }));
          }
        } catch {
          // Handled by caller UI
        }
      },
    }),
    logout: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(logout());
          dispatch(apiSlice.util.resetApiState());
        }
      },
    }),
    refreshToken: builder.mutation({
      query: () => ({
        url: '/auth/refresh',
        method: 'POST',
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const user = data?.user || data?.data?.user;
          if (user) {
            dispatch(setCredentials({ user }));
          }
        } catch {
          dispatch(logout());
        }
      },
    }),
  }),
  overrideExisting: false,
});

/**
 * RTK Query mutation hooks for supervisor authentication lifecycle.
 */
export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
} = authApiSlice;

export default authSlice.reducer;
