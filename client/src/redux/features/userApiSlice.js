/**
 * @module redux/features/userApiSlice
 * @description Injected RTK Query endpoints for supervisor profile, dedicated avatar routes, and password changes.
 */

import { apiSlice } from '../app/apiSlice.js';
import { updateUserProfile } from './authSlice.js';

/**
 * User and profile API endpoints injected into the core RTK Query slice.
 * @constant
 */
export const userApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query({
      query: () => '/users/profile',
      providesTags: ['User'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data?.data?.user) {
            dispatch(updateUserProfile({ user: data.data.user }));
          }
        } catch {
          // Handled by base query / caller
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
          if (data?.data?.user) {
            dispatch(updateUserProfile({ user: data.data.user }));
          }
        } catch {
          // Handled by caller
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
          if (data?.data?.user) {
            dispatch(updateUserProfile({ user: data.data.user }));
          }
        } catch {
          // Handled by caller
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
          if (data?.data?.user) {
            dispatch(updateUserProfile({ user: data.data.user }));
          }
        } catch {
          // Handled by caller
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
} = userApiSlice;

export default userApiSlice;
