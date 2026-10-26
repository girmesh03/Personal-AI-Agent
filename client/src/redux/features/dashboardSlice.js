/**
 * @module redux/features/dashboardSlice
 * @description Injected RTK Query endpoints for executive operational dashboard intelligence,
 * KPI metric counters, 14-day continuous audit timeline curves, branch inspection frequencies,
 * and recent operational activity ledgers.
 * Scoped strictly to authenticated supervisor under tag 'Dashboard'.
 */

import { apiSlice } from '../app/apiSlice.js';

/**
 * Dashboard metrics and intelligence API endpoints injected into the core RTK Query slice.
 * @constant
 */
export const dashboardSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Retrieve aggregated operational metrics for the active supervisor canvas.
     * Yields { kpis, branchVisitFrequency, auditVolumeTrend, recurringIssues, recentReports }.
     */
    getDashboardMetrics: builder.query({
      query: () => '/dashboard/metrics',
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useGetDashboardMetricsQuery } = dashboardSlice;

export default dashboardSlice;
