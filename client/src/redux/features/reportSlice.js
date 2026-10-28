/**
 * @module redux/features/reportSlice
 * @description Injected RTK Query endpoints for supervisor operational reports,
 * branch audit histories, status filtering, and corporate multi-channel exports.
 * Scoped strictly to authenticated supervisor under tag 'Report'.
 */

import { apiSlice } from '../app/apiSlice.js';

/**
 * Report management and inspection history API endpoints injected into apiSlice.
 * @constant
 */
export const reportSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Retrieve paginated operational reports with optional branch, date, search, and archival filters.
     */
    getReports: builder.query({
      query: (params = {}) => {
        const { page = 1, limit = 10, search = '', branch, date, archived, isArchived } = params;
        const isArchivedVal = archived !== undefined ? archived : isArchived;
        const searchParams = new URLSearchParams();

        if (page) searchParams.append('page', String(page));
        if (limit) searchParams.append('limit', String(limit));
        if (search && search.trim()) searchParams.append('search', search.trim());
        if (branch) searchParams.append('branch', String(branch));
        if (date) searchParams.append('date', String(date));
        if (isArchivedVal !== undefined) searchParams.append('archived', String(isArchivedVal));

        const queryString = searchParams.toString();
        return `/reports${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: (result) => {
        const list = result?.reports || result?.docs || [];
        return list.length
          ? [
              ...list.map(({ _id }) => ({ type: 'Report', id: _id })),
              { type: 'Report', id: 'LIST' },
            ]
          : [{ type: 'Report', id: 'LIST' }];
      },
    }),

    /**
     * Retrieve a single operational report by its ObjectId.
     */
    getReportById: builder.query({
      query: (reportId) => `/reports/${reportId}`,
      providesTags: (_result, _error, reportId) => [{ type: 'Report', id: reportId }],
    }),

    /**
     * Update an operational report document.
     */
    updateReport: builder.mutation({
      query: ({ reportId, ...updates }) => ({
        url: `/reports/${reportId}`,
        method: 'PATCH',
        body: updates.data ? updates.data : updates,
      }),
      invalidatesTags: (_result, _error, { reportId }) => [
        { type: 'Report', id: reportId },
        { type: 'Report', id: 'LIST' },
        'Dashboard',
      ],
    }),

    /**
     * Soft-archive an operational report.
     */
    archiveReport: builder.mutation({
      query: (reportId) => ({
        url: `/reports/${reportId}/archive`,
        method: 'PATCH',
      }),
      invalidatesTags: (_result, _error, reportId) => [
        { type: 'Report', id: reportId },
        { type: 'Report', id: 'LIST' },
        'Dashboard',
      ],
    }),

    /**
     * Restore an archived operational report.
     */
    restoreReport: builder.mutation({
      query: (reportId) => ({
        url: `/reports/${reportId}/restore`,
        method: 'PATCH',
      }),
      invalidatesTags: (_result, _error, reportId) => [
        { type: 'Report', id: reportId },
        { type: 'Report', id: 'LIST' },
        'Dashboard',
      ],
    }),

    /**
     * Permanently delete an operational report.
     */
    deleteReport: builder.mutation({
      query: (reportId) => ({
        url: `/reports/${reportId}/delete`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, reportId) => [
        { type: 'Report', id: reportId },
        { type: 'Report', id: 'LIST' },
        'Dashboard',
      ],
    }),
  }),
});

export const {
  useGetReportsQuery,
  useGetReportByIdQuery,
  useUpdateReportMutation,
  useArchiveReportMutation,
  useRestoreReportMutation,
  useDeleteReportMutation,
} = reportSlice;

export default reportSlice;
