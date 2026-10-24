/**
 * @module components/branches/BranchAnalyticsCharts
 * @description Side-by-side responsive analytical charts for operational branch inspection metrics (Row 3).
 * Integrates:
 * 1. Chart 1: Inspection Visit Volume & Audit Frequency Trend.
 * 2. Chart 2: Operational Status Distribution (comparing actual schema statuses:
 *    Issues: reported, in_progress, completed, no_issue; Activities: completed, in_progress).
 * Strictly zero fake stubs (no fake "open/clean" stubs).
 * Uses standard MUI breakpoints: Side by side on md+, stacking on xs and sm.
 */

import { memo, useMemo, useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { BarChart } from '@mui/x-charts/BarChart';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import MuiEmptyState from '../reusable/MuiEmptyState.jsx';

/**
 * Static frozen chart layout tokens and series/axis specifications.
 * Strictly adheres to MUI X Charts performance guidelines (MUI MCP):
 * 1. Module-level frozen constants guarantee 100% stable object and array references.
 * 2. Explicit unique 'id' attributes on all series and axes prevent selector regeneration.
 * 3. Uses official 'dataset' + 'dataKey' pattern to decouple series definitions from dynamic data.
 * @constant
 */
const CHART_MARGIN = Object.freeze({ top: 20, bottom: 30, left: 40, right: 20 });
const AXIS_TICK_STYLE = Object.freeze({ fontSize: 11 });
const MIN_CHART_WIDTH = 120; // Safe threshold ensuring drawingArea.width (width - 60) is always > 0

/**
 * Frozen slotProps configuring item-level tooltips.
 * Strictly adheres to MUI X Charts documentation (MUI MCP):
 * Bypasses default axis-level tooltip (ChartsAxisTooltipContent / useAxesTooltip),
 * completely eliminating the upstream Reselect runInputStabilityCheck warning.
 * @constant
 */
const CHART_SLOT_PROPS = Object.freeze({
  tooltip: Object.freeze({
    trigger: 'item',
  }),
});

/**
 * Frozen axisHighlight turning off axis-level tracking bands.
 * @constant
 */
const CHART_AXIS_HIGHLIGHT = Object.freeze({
  x: 'none',
  y: 'none',
});

/**
 * Stable frozen linear y-axis definition.
 * @constant
 */
const DEFAULT_Y_AXIS = Object.freeze([
  {
    id: 'default-y-axis',
    scaleType: 'linear',
  },
]);

// Static definitions for Chart 1: Audit Visit Volume Trend
const TREND_SERIES = Object.freeze([
  {
    type: 'bar',
    id: 'trend-audits-series',
    dataKey: 'count',
    label: 'Audits Logged',
    color: '#1976d2',
    valueFormatter: (value) => `${value ?? 0} visit${value === 1 ? '' : 's'}`,
  },
]);

const TREND_X_AXIS = Object.freeze([
  {
    id: 'trend-dates-axis',
    scaleType: 'band',
    dataKey: 'date',
    tickLabelStyle: AXIS_TICK_STYLE,
  },
]);

// Static definitions for Chart 2: Operational Status Distribution
const STATUS_SERIES = Object.freeze([
  {
    type: 'bar',
    id: 'status-activities-series',
    dataKey: 'activities',
    label: 'Activities',
    color: '#2e7d32',
    valueFormatter: (value) => `${value ?? 0} recorded`,
  },
  {
    type: 'bar',
    id: 'status-issues-series',
    dataKey: 'issues',
    label: 'Issues Flagged',
    color: '#d32f2f',
    valueFormatter: (value) => `${value ?? 0} flagged`,
  },
]);

const STATUS_X_AXIS = Object.freeze([
  {
    id: 'status-categories-axis',
    scaleType: 'band',
    dataKey: 'category',
    tickLabelStyle: AXIS_TICK_STYLE,
  },
]);

/**
 * Resilient chart container measuring its own settled DOM width via ResizeObserver.
 * Shields SVG elements from rendering during initial CSS flex layout settlements,
 * eliminating negative SVG attribute warnings (<rect width="-17">).
 *
 * @component ChartContainer
 * @param {object} props - Component properties.
 * @param {(measuredWidth: number) => import('react').ReactNode} props.children - Render function.
 * @returns {import('react').JSX.Element} Rendered container.
 */
const ChartContainer = memo(({ children }) => {
  const containerRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const initialRect = el.getBoundingClientRect();
    if (initialRect.width > 0) {
      setMeasuredWidth(initialRect.width);
    }

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) {
            setMeasuredWidth(w);
          }
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: 260,
        minWidth: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {measuredWidth >= MIN_CHART_WIDTH ? (
        children(measuredWidth)
      ) : (
        <Skeleton variant="rounded" width="100%" height={250} sx={{ borderRadius: 2 }} />
      )}
    </Box>
  );
});

ChartContainer.displayName = 'ChartContainer';
ChartContainer.propTypes = {
  children: PropTypes.func.isRequired,
};

/**
 * Branch analytical charts displaying visit trends and real status distributions.
 *
 * @component BranchAnalyticsCharts
 * @param {object} props - Component properties.
 * @param {object} [props.metrics] - Aggregation metrics from getBranchMetrics query.
 * @param {boolean} [props.isLoading=false] - Whether metrics data is loading.
 * @returns {import('react').JSX.Element} Rendered side-by-side analytical charts.
 */
export const BranchAnalyticsCharts = memo(({
  metrics,
  isLoading = false,
}) => {
  // 1. Process Audit Volume Trend Dataset (bound via dataKey)
  const trendDataset = useMemo(() => {
    const rawTrend = metrics?.auditVolumeTrend;
    if (!Array.isArray(rawTrend) || rawTrend.length === 0) return null;

    return rawTrend.map((item) => {
      const parts = String(item.date).split('-');
      const label = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : item.date;
      return {
        date: label,
        count: Number(item.count) || 0,
      };
    });
  }, [metrics?.auditVolumeTrend]);

  // 2. Process Operational Issues & Activities Dataset (bound via dataKey)
  const statusDataset = useMemo(() => {
    const rawIssues = metrics?.issuesByStatus;
    const rawActivities = metrics?.activitiesByStatus;

    // Normalize rawIssues whether backend returns an object or array
    const issuesObj = Array.isArray(rawIssues)
      ? Object.fromEntries(rawIssues.map((item) => [item.status, Number(item.count) || 0]))
      : typeof rawIssues === 'object' && rawIssues !== null
      ? rawIssues
      : {};

    // Normalize rawActivities whether backend returns an object or array
    const activitiesObj = Array.isArray(rawActivities)
      ? Object.fromEntries(rawActivities.map((item) => [item.status, Number(item.count) || 0]))
      : typeof rawActivities === 'object' && rawActivities !== null
      ? rawActivities
      : {};

    const totalIssues = Object.values(issuesObj).reduce((acc, val) => acc + (Number(val) || 0), 0);
    const totalActivities = Object.values(activitiesObj).reduce((acc, val) => acc + (Number(val) || 0), 0);

    if (totalIssues === 0 && totalActivities === 0) return null;

    return [
      {
        category: 'Completed',
        activities: Number(activitiesObj.completed) || 0,
        issues: Number(issuesObj.completed) || 0,
      },
      {
        category: 'In Progress',
        activities: Number(activitiesObj.in_progress) || 0,
        issues: Number(issuesObj.in_progress) || 0,
      },
      {
        category: 'Flagged',
        activities: 0,
        issues: Number(issuesObj.reported) || 0,
      },
      {
        category: 'No Issue',
        activities: 0,
        issues: Number(issuesObj.no_issue) || 0,
      },
    ];
  }, [metrics?.issuesByStatus, metrics?.activitiesByStatus]);

  if (isLoading) {
    return (
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }} sx={{ minWidth: 0 }}>
          <Skeleton variant="rounded" height={320} sx={{ borderRadius: 2.5 }} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }} sx={{ minWidth: 0 }}>
          <Skeleton variant="rounded" height={320} sx={{ borderRadius: 2.5 }} />
        </Grid>
      </Grid>
    );
  }

  return (
    <Grid container spacing={2.5}>
      {/* =========================================================================
          CHART 1: INSPECTION VISIT VOLUME TREND (Side-by-side on md+, stacked on xs/sm)
          ========================================================================= */}
      <Grid size={{ xs: 12, md: 6 }} sx={{ minWidth: 0 }}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 2.5,
            height: '100%',
            minWidth: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            bgcolor: 'background.paper',
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TimelineOutlinedIcon color="primary" sx={{ fontSize: 22 }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                Audit Visit Volume Trend
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Inspection visit frequency across recent audits
              </Typography>
            </Box>
          </Box>

          {/* Chart Content */}
          {trendDataset && trendDataset.length > 0 ? (
            <ChartContainer>
              {(measuredWidth) => (
                <BarChart
                  width={measuredWidth}
                  height={250}
                  dataset={trendDataset}
                  xAxis={TREND_X_AXIS}
                  yAxis={DEFAULT_Y_AXIS}
                  series={TREND_SERIES}
                  margin={CHART_MARGIN}
                  slotProps={CHART_SLOT_PROPS}
                  axisHighlight={CHART_AXIS_HIGHLIGHT}
                />
              )}
            </ChartContainer>
          ) : (
            <Box sx={{ py: 4, my: 'auto' }}>
              <MuiEmptyState
                icon={<TimelineOutlinedIcon sx={{ fontSize: 36, color: 'text.secondary' }} />}
                title="No Audit History Yet"
                subtitle="Inspection visits logged for this branch will chart here automatically."
              />
            </Box>
          )}
        </Paper>
      </Grid>

      {/* =========================================================================
          CHART 2: OPERATIONAL STATUS DISTRIBUTION (Side-by-side on md+, stacked on xs/sm)
          Actual schema statuses: Issues (reported, in_progress, completed, no_issue)
          Activities (completed, in_progress)
          ========================================================================= */}
      <Grid size={{ xs: 12, md: 6 }} sx={{ minWidth: 0 }}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 2.5,
            height: '100%',
            minWidth: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            bgcolor: 'background.paper',
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AssessmentOutlinedIcon color="primary" sx={{ fontSize: 22 }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                Operational Status Breakdown
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Real schema status distribution across recorded issues and activities
              </Typography>
            </Box>
          </Box>

          {/* Chart Content */}
          {statusDataset && statusDataset.length > 0 ? (
            <ChartContainer>
              {(measuredWidth) => (
                <BarChart
                  width={measuredWidth}
                  height={250}
                  dataset={statusDataset}
                  xAxis={STATUS_X_AXIS}
                  yAxis={DEFAULT_Y_AXIS}
                  series={STATUS_SERIES}
                  margin={CHART_MARGIN}
                  slotProps={CHART_SLOT_PROPS}
                  axisHighlight={CHART_AXIS_HIGHLIGHT}
                />
              )}
            </ChartContainer>
          ) : (
            <Box sx={{ py: 4, my: 'auto' }}>
              <MuiEmptyState
                icon={<AssessmentOutlinedIcon sx={{ fontSize: 36, color: 'text.secondary' }} />}
                title="No Operational Findings"
                subtitle="Tasks and checklist statuses recorded during inspections will chart here."
              />
            </Box>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
});

BranchAnalyticsCharts.displayName = 'BranchAnalyticsCharts';

BranchAnalyticsCharts.propTypes = {
  metrics: PropTypes.shape({
    totalAudits: PropTypes.number,
    auditVolumeTrend: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string,
        count: PropTypes.number,
      })
    ),
    issuesByStatus: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.arrayOf(
        PropTypes.shape({
          status: PropTypes.string,
          count: PropTypes.number,
        })
      ),
    ]),
    activitiesByStatus: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.arrayOf(
        PropTypes.shape({
          status: PropTypes.string,
          count: PropTypes.number,
        })
      ),
    ]),
  }),
  isLoading: PropTypes.bool,
};

export default BranchAnalyticsCharts;
