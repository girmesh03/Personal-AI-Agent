/**
 * @module redux/features/authApiSlice
 * @description Injected RTK Query endpoints for supervisor authentication lifecycle.
 */

import { apiSlice } from '../app/apiSlice.js';
import { setCredentials, logout } from './authSlice.js';

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
          if (data?.data?.user) {
            dispatch(setCredentials({ user: data.data.user }));
          }
        } catch {
          // Handled by caller UI
        }
      },
    }),
    logoutApi: builder.mutation({
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
          if (data?.data?.user) {
            dispatch(setCredentials({ user: data.data.user }));
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
  useLogoutApiMutation,
  useRefreshTokenMutation,
} = authApiSlice;

export default authApiSlice;
