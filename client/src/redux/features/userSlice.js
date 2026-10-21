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
    updateAgentConfig: builder.mutation({
      query: (configData) => ({
        url: '/users/agent-config',
        method: 'PATCH',
        body: configData,
      }),
      invalidatesTags: ['User'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled, getState }) {
        try {
          const { data } = await queryFulfilled;
          const resData = data?.data || data;
          if (resData) {
            const currentUser = getState().auth.user;
            if (currentUser) {
              const updatedUser = {
                ...currentUser,
                settings: {
                  ...(currentUser.settings || {}),
                  sttEngine: resData.sttEngine || currentUser.settings?.sttEngine,
                  agentConfig: {
                    ...(currentUser.settings?.agentConfig || {}),
                    ...(resData.agentConfig || {}),
                  },
                },
              };
              dispatch(updateUserProfile({ user: updatedUser }));
            }
          }
        } catch {
          // Handled by caller UI
        }
      },
    }),
    getGoogleDriveStatus: builder.query({
      query: () => '/auth/google/status',
      providesTags: ['User'],
    }),
    getGoogleDriveConnectUrl: builder.query({
      query: () => '/auth/google/connect',
    }),
    disconnectGoogleDrive: builder.mutation({
      query: () => ({
        url: '/auth/google/disconnect',
        method: 'POST',
      }),
      invalidatesTags: ['User'],
    }),
    mockConnectGoogleDrive: builder.mutation({
      query: (body) => ({
        url: '/auth/google/mock-connect',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),
    toggleGoogleDrive: builder.mutation({
      query: (body) => ({
        url: '/auth/google/toggle',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),
  }),
  overrideExisting: false,
});

/**
 * RTK Query query and mutation hooks for supervisor user profile operations and cloud integrations.
 */
export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useUpdateAvatarMutation,
  useRemoveAvatarMutation,
  useUpdatePasswordMutation,
  useUpdateAgentConfigMutation,
  useGetGoogleDriveStatusQuery,
  useLazyGetGoogleDriveConnectUrlQuery,
  useDisconnectGoogleDriveMutation,
  useToggleGoogleDriveMutation,
  useMockConnectGoogleDriveMutation,
} = userSlice;

export default userSlice;
