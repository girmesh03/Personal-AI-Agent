/**
 * @module redux/features/userSlice
 * @description Injected RTK Query endpoints for supervisor profile, dedicated avatar routes, and password changes.
 * Adheres to standard slice naming convention (<name>Slice.js).
 */

import { apiSlice } from '../app/apiSlice.js';
import { setCredentials, logout, updateUserProfile } from './authSlice.js';

/**
 * User and profile API endpoints injected into the core RTK Query slice.
 * @constant
 */
export const userSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query({
      query: () => '/users/profile',
      providesTags: ['User'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Normalized by apiSlice: data.user is directly accessible
          const user = data?.user || data?.data?.user;
          if (user) {
            dispatch(setCredentials({ user }));
          }
        } catch {
          // If session profile retrieval fails (e.g. 401 expired cookie), purge state cleanly
          dispatch(logout());
        }
      },
    }),
    updateProfile: builder.mutation({
      query: (profileData) => ({
        url: '/users/profile',
        method: 'PATCH',
        body: profileData,
      }),
      invalidatesTags: ['User'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const user = data?.user || data?.data?.user;
          if (user) {
            dispatch(updateUserProfile({ user }));
          }
        } catch {
          // Handled by caller UI
        }
      },
    }),
    updateAvatar: builder.mutation({
      query: (avatarData) => ({
        url: '/users/avatar',
        method: 'PATCH',
        body: avatarData,
      }),
      invalidatesTags: ['User'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const user = data?.user || data?.data?.user;
          if (user) {
            dispatch(updateUserProfile({ user }));
          }
        } catch {
          // Handled by caller UI
        }
      },
    }),
    removeAvatar: builder.mutation({
      query: () => ({
        url: '/users/avatar',
        method: 'DELETE',
      }),
      invalidatesTags: ['User'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const user = data?.user || data?.data?.user;
          if (user) {
            dispatch(updateUserProfile({ user }));
          }
        } catch {
          // Handled by caller UI
        }
      },
    }),
    updatePassword: builder.mutation({
      query: (passwordData) => ({
        url: '/users/password',
        method: 'PATCH',
        body: passwordData,
      }),
    }),
  }),
  overrideExisting: false,
});

/**
 * RTK Query query and mutation hooks for supervisor user profile operations.
 */
export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useUpdateAvatarMutation,
  useRemoveAvatarMutation,
  useUpdatePasswordMutation,
} = userSlice;

export default userSlice;
