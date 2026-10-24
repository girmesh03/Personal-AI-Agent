/**
 * @module redux/features/branchSlice
 * @description Injected RTK Query endpoints for physical store branch management, bilingual search,
 * branch report metrics aggregation, soft archival, restoration, and permanent cascade deletion.
 * Scoped strictly to authenticated supervisor under tag 'Branch'.
 */

import { apiSlice } from '../app/apiSlice.js';

/**
 * Branch management and analytics API endpoints injected into the core RTK Query slice.
 * @constant
 */
export const branchSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Retrieve paginated list of operational branches with optional bilingual search and archival filter.
     */
    getBranches: builder.query({
      query: (params = {}) => {
        const { page = 1, limit = 10, search = '', archived, isArchived } = params;
        const isArchivedVal = archived !== undefined ? archived : isArchived;
        const searchParams = new URLSearchParams();

        if (page) searchParams.append('page', String(page));
        if (limit) searchParams.append('limit', String(limit));
        if (search && search.trim()) searchParams.append('search', search.trim());
        if (isArchivedVal !== undefined) searchParams.append('archived', String(isArchivedVal));

        const queryString = searchParams.toString();
        return `/branches${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: (result) =>
        result?.branches
          ? [
              ...result.branches.map(({ _id }) => ({ type: 'Branch', id: _id })),
              { type: 'Branch', id: 'LIST' },
            ]
          : [{ type: 'Branch', id: 'LIST' }],
    }),

    /**
     * Retrieve details of a single branch by ObjectId or operational uppercase code.
     */
    getBranchById: builder.query({
      query: (branchId) => `/branches/${branchId}`,
      providesTags: (_result, _error, branchId) => [{ type: 'Branch', id: branchId }],
    }),

    /**
     * Retrieve analytics metrics and report aggregations for a single branch.
     */
    getBranchMetrics: builder.query({
      query: (branchId) => `/branches/${branchId}/metrics`,
      providesTags: (_result, _error, branchId) => [{ type: 'Branch', id: `${branchId}-metrics` }],
    }),

    /**
     * Create a new operational store branch location.
     */
    createBranch: builder.mutation({
      query: (branchData) => ({
        url: '/branches',
        method: 'POST',
        body: branchData,
      }),
      invalidatesTags: [{ type: 'Branch', id: 'LIST' }, 'Dashboard'],
    }),

    /**
     * Update operational store branch attributes.
     */
    updateBranch: builder.mutation({
      query: ({ branchId, ...updates }) => ({
        url: `/branches/${branchId}`,
        method: 'PATCH',
        body: updates,
      }),
      invalidatesTags: (_result, _error, { branchId }) => [
        { type: 'Branch', id: branchId },
        { type: 'Branch', id: `${branchId}-metrics` },
        { type: 'Branch', id: 'LIST' },
        'Dashboard',
      ],
    }),

    /**
     * Soft-archive an active branch location.
     */
    archiveBranch: builder.mutation({
      query: (branchId) => ({
        url: `/branches/${branchId}/archive`,
        method: 'PATCH',
      }),
      invalidatesTags: (_result, _error, branchId) => [
        { type: 'Branch', id: branchId },
        { type: 'Branch', id: `${branchId}-metrics` },
        { type: 'Branch', id: 'LIST' },
        'Dashboard',
      ],
    }),

    /**
     * Restore a soft-archived branch location.
     */
    restoreBranch: builder.mutation({
      query: (branchId) => ({
        url: `/branches/${branchId}/restore`,
        method: 'PATCH',
      }),
      invalidatesTags: (_result, _error, branchId) => [
        { type: 'Branch', id: branchId },
        { type: 'Branch', id: `${branchId}-metrics` },
        { type: 'Branch', id: 'LIST' },
        'Dashboard',
      ],
    }),

    /**
     * Permanently cascade-delete an archived branch and all associated inspection reports/audios.
     */
    deleteBranchPermanently: builder.mutation({
      query: (branchId) => ({
        url: `/branches/${branchId}/delete`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, branchId) => [
        { type: 'Branch', id: branchId },
        { type: 'Branch', id: `${branchId}-metrics` },
        { type: 'Branch', id: 'LIST' },
        'Report',
        'Dashboard',
      ],
    }),
  }),
});

export const {
  useGetBranchesQuery,
  useGetBranchByIdQuery,
  useGetBranchMetricsQuery,
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useArchiveBranchMutation,
  useRestoreBranchMutation,
  useDeleteBranchPermanentlyMutation,
  useDeleteBranchPermanentlyMutation: useDeleteBranchMutation,
} = branchSlice;

export default branchSlice;
