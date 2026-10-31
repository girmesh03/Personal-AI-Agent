/**
 * @module components/dashboard/DashboardBranchVisitChart
 * @description Executive bar chart illustrating inspection visit frequency across operational branches.
 * Adheres strictly to MUI X Charts performance invariants:
 * - Module-level frozen constants for margin, axis tick styles, and slotProps.
 * - item-level tooltip triggers bypassing upstream Reselect warnings.
 * - Container measurement ensuring safe non-negative SVG viewport width.
 */

import { memo, useMemo, useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { BarChart } from '@mui/x-charts/BarChart';
import StorefrontIcon from '@mui/icons-material/Storefront';
import MuiEmptyState from '../reusable/MuiEmptyState.jsx';

/**
 * Frozen chart layout constants.
 */
const CHART_MARGIN = Object.freeze({ top: 15, bottom: 48, left: 35, right: 15 });
const AXIS_TICK_STYLE = Object.freeze({
  fontSize: 10,
  angle: -28,
  textAnchor: 'end',
  dominantBaseline: 'central',
});
const MIN_CHART_WIDTH = 120;

const CHART_SLOT_PROPS = Object.freeze({
  tooltip: Object.freeze({
    trigger: 'item',
  }),
});

const CHART_AXIS_HIGHLIGHT = Object.freeze({
  x: 'none',
  y: 'none',
});

const DEFAULT_Y_AXIS = Object.freeze([
  {
    id: 'branch-visit-y-axis',
    scaleType: 'linear',
  },
]);

const VISIT_SERIES = Object.freeze([
  {
    type: 'bar',
    id: 'branch-visit-series',
    dataKey: 'visitCount',
    label: 'Visits',
    color: '#1976d2',
    valueFormatter: (val) => `${val ?? 0} visit${val === 1 ? '' : 's'}`,
  },
]);

/**
 * Inspection frequency distribution bar chart component.
 *
 * @component DashboardBranchVisitChart
 * @param {object} props - Component properties.
 * @param {Array<object>} [props.data=[]] - Branch visit frequency list [{ branchId, branchName, branchCode, visitCount }].
 * @param {boolean} [props.isLoading=false] - Whether query is loading.
 * @returns {JSX.Element} Rendered chart container.
 */
export const DashboardBranchVisitChart = memo(({ data = [], isLoading = false }) => {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const measureWidth = () => {
      if (containerRef.current) {
        const clientWidth = containerRef.current.clientWidth;
        if (clientWidth > 0) {
          setContainerWidth(clientWidth);
        }
      }
    };

    measureWidth();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const measured = Math.floor(entry.contentRect.width);
        if (measured > 0) {
          setContainerWidth(measured);
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const chartData = useMemo(() => {
    return (data || []).slice(0, 8).map((item) => ({
      branch: item.branchCode || item.branchName || 'Branch',
      fullName: item.branchName || item.branchCode || 'Store',
      visitCount: item.visitCount || 0,
    }));
  }, [data]);

  const xAxis = useMemo(() => [
    {
      id: 'branch-names-axis',
      scaleType: 'band',
      dataKey: 'branch',
      tickLabelStyle: AXIS_TICK_STYLE,
      tickLabelInterval: () => true,
    },
  ], []);

  const hasData = chartData.length > 0 && chartData.some((d) => d.visitCount > 0);
  const chartHeight = containerWidth < 450 ? 260 : (containerWidth > 750 ? 300 : 280);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.5, sm: 2, md: 2.5 },
        borderRadius: '10px',
        bgcolor: 'background.paper',
        borderColor: 'divider',
        height: { xs: 'auto', md: '100%' },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <StorefrontIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            Top Visited Branches
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Inspection frequency distribution across store network
        </Typography>
      </Box>

      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: chartHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isLoading ? (
          <Skeleton variant="rounded" width="100%" height={chartHeight} sx={{ borderRadius: '8px' }} />
        ) : !hasData ? (
          <MuiEmptyState
            title="No Branch Visits Logged"
            subtitle="Start inspecting branches to view audit frequency distributions."
            sx={{ py: 4 }}
          />
        ) : containerWidth >= MIN_CHART_WIDTH ? (
          <BarChart
            dataset={chartData}
            xAxis={xAxis}
            yAxis={DEFAULT_Y_AXIS}
            series={VISIT_SERIES}
            width={containerWidth}
            height={chartHeight}
            margin={CHART_MARGIN}
            slotProps={CHART_SLOT_PROPS}
            axisHighlight={CHART_AXIS_HIGHLIGHT}
          />
        ) : (
          <Skeleton variant="rounded" width="100%" height={chartHeight} sx={{ borderRadius: '8px' }} />
        )}
      </Box>
    </Paper>
  );
});

DashboardBranchVisitChart.displayName = 'DashboardBranchVisitChart';

DashboardBranchVisitChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      branchId: PropTypes.string,
      branchName: PropTypes.string,
      branchCode: PropTypes.string,
      visitCount: PropTypes.number,
    })
  ),
  isLoading: PropTypes.bool,
};

export default DashboardBranchVisitChart;
