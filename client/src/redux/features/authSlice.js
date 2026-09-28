/**
 * @module redux/features/authSlice
 * @description Redux Toolkit slice managing supervisor session authentication state.
 */

import { createSlice } from '@reduxjs/toolkit';

/**
 * Initial authentication state.
 * @constant
 * @type {{ user: object|null, isAuthenticated: boolean, isLoading: boolean }}
 */
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
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
      if (state.user && updatedFields) {
        state.user = {
          ...state.user,
          ...updatedFields,
        };
      }
    },
  },
});

/**
 * Authentication action creators.
 */
export const { setCredentials, logout, setLoading, updateUserProfile } = authSlice.actions;

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

export default authSlice.reducer;
