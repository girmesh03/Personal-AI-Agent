/**
 * @module components/dashboard/DashboardAuditTrendChart
 * @description Executive continuous 14-day audit volume trend line chart.
 * Visualizes daily supervisor inspection activity over the trailing two weeks.
 * Adheres strictly to MUI X Charts performance invariants:
 * - Module-level frozen constants for layout, axis styling, and item-level tooltips.
 * - Point-scale x-axis ensuring clean temporal line interpolation.
 * - Container measurement ensuring safe non-negative SVG viewport width.
 */

import { memo, useMemo, useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { LineChart } from '@mui/x-charts/LineChart';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import MuiEmptyState from '../reusable/MuiEmptyState.jsx';

/**
 * Frozen chart layout constants.
 */
const CHART_MARGIN = Object.freeze({ top: 20, bottom: 45, left: 45, right: 20 });
const AXIS_TICK_STYLE = Object.freeze({ fontSize: 10, angle: 0 });
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
    id: 'trend-y-axis',
    scaleType: 'linear',
    min: 0,
  },
]);

const TREND_SERIES = Object.freeze([
  {
    type: 'line',
    id: 'audit-volume-series',
    dataKey: 'count',
    label: 'Audits',
    color: '#059669',
    area: true,
    showMark: true,
    curve: 'monotoneX',
    valueFormatter: (val) => `${val ?? 0} report${val === 1 ? '' : 's'}`,
  },
]);

/**
 * 14-day continuous audit volume trajectory chart component.
 *
 * @component DashboardAuditTrendChart
 * @param {object} props - Component properties.
 * @param {Array<object>} [props.data=[]] - Trailing 14-day audit trend [{ date, label, count }].
 * @param {boolean} [props.isLoading=false] - Whether query is loading.
 * @returns {JSX.Element} Rendered chart container.
 */
export const DashboardAuditTrendChart = memo(({ data = [], isLoading = false }) => {
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
    if (!data || data.length === 0) return [];
    return data.map((item) => ({
      label: item.label || item.date?.slice(5) || '',
      count: item.count || 0,
    }));
  }, [data]);

  const xAxis = useMemo(() => [
    {
      id: 'trend-timeline-axis',
      scaleType: 'point',
      dataKey: 'label',
      tickLabelStyle: AXIS_TICK_STYLE,
    },
  ], []);

  const hasData = chartData.length > 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: '10px',
        bgcolor: 'background.paper',
        borderColor: 'divider',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <TimelineOutlinedIcon fontSize="small" sx={{ color: '#059669' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            14-Day Audit Volume Trend
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Continuous daily operational inspection activity
        </Typography>
      </Box>

      <Box
        ref={containerRef}
        sx={{
          flexGrow: 1,
          width: '100%',
          minHeight: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isLoading ? (
          <Skeleton variant="rounded" width="100%" height={280} sx={{ borderRadius: '8px' }} />
        ) : !hasData ? (
          <MuiEmptyState
            title="No Activity Logged"
            subtitle="Inspection reports filed in the last 14 days will appear here."
            sx={{ py: 4 }}
          />
        ) : containerWidth >= MIN_CHART_WIDTH ? (
          <LineChart
            dataset={chartData}
            xAxis={xAxis}
            yAxis={DEFAULT_Y_AXIS}
            series={TREND_SERIES}
            width={containerWidth}
            height={280}
            margin={CHART_MARGIN}
            slotProps={CHART_SLOT_PROPS}
            axisHighlight={CHART_AXIS_HIGHLIGHT}
          />
        ) : (
          <Skeleton variant="rounded" width="100%" height={280} sx={{ borderRadius: '8px' }} />
        )}
      </Box>
    </Paper>
  );
});

DashboardAuditTrendChart.displayName = 'DashboardAuditTrendChart';

DashboardAuditTrendChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string,
      label: PropTypes.string,
      count: PropTypes.number,
    })
  ),
  isLoading: PropTypes.bool,
};

export default DashboardAuditTrendChart;
