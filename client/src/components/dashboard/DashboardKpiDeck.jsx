/**
 * @module components/dashboard/DashboardKpiDeck
 * @description Executive operational KPI metric cards row.
 * Displays 4 core metrics: Active Branches, Total Inspections, Audits This Week, and Open Issues.
 * Adheres to responsive multi-breakpoint layout:
 * - Desktop (md+: 1440px): 4 cards in single row.
 * - Tablet (sm: 600px - 899px): 2x2 grid.
 * - Mobile (xs: <600px, 375px): 4 stacked cards (100% fullwidth).
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import DateRangeIcon from '@mui/icons-material/DateRange';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MuiStatCard from '../reusable/MuiStatCard.jsx';

/**
 * Skeleton placeholder for individual KPI cards during metric query latency.
 */
const KpiCardSkeleton = () => (
  <Card
    variant="outlined"
    sx={{
      borderRadius: '10px',
      bgcolor: 'background.paper',
      borderColor: 'divider',
      height: '100%',
    }}
  >
    <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Skeleton variant="text" width="60%" height={16} />
        <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: '8px' }} />
      </Box>
      <Skeleton variant="text" width="40%" height={38} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="80%" height={14} />
    </CardContent>
  </Card>
);

/**
 * Executive KPI cards deck for supervisor operational intelligence.
 *
 * @component DashboardKpiDeck
 * @param {object} props - Component properties.
 * @param {object} [props.kpis={}] - Aggregated KPI metrics object.
 * @param {boolean} [props.isLoading=false] - Whether metrics query is loading.
 * @returns {JSX.Element} Rendered KPI deck.
 */
export const DashboardKpiDeck = memo(({ kpis = {}, isLoading = false }) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {[0, 1, 2, 3].map((idx) => (
          <Grid key={idx} size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCardSkeleton />
          </Grid>
        ))}
      </Grid>
    );
  }

  const activeBranches = kpis.activeBranches ?? 0;
  const totalReports = kpis.totalReports ?? 0;
  const auditsThisWeek = kpis.auditsThisWeek ?? 0;
  const openIssues = kpis.openIssues ?? 0;
  const totalVisits = kpis.totalVisits ?? 0;

  return (
    <Grid container spacing={{ xs: 1.5, sm: 2 }}>
      {/* 1. Active Branches */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MuiStatCard
          title="Active Branches"
          value={activeBranches}
          subtitle="Operational Store Network"
          icon={<StorefrontIcon fontSize="small" />}
          accentColor="primary.main"
          onClick={() => navigate('/branches')}
          sx={{ cursor: 'pointer' }}
        />
      </Grid>

      {/* 2. Total Inspections */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MuiStatCard
          title="Total Inspections"
          value={totalReports}
          subtitle={`${totalVisits} Total Branch Visits`}
          icon={<AssessmentOutlinedIcon fontSize="small" />}
          accentColor="#0288d1"
          onClick={() => navigate('/reports')}
          sx={{ cursor: 'pointer' }}
        />
      </Grid>

      {/* 3. Audits This Week */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MuiStatCard
          title="Audits This Week"
          value={auditsThisWeek}
          subtitle="Trailing 7 Days Activity"
          icon={<DateRangeIcon fontSize="small" />}
          accentColor="#2e7d32"
          onClick={() => navigate('/reports')}
          sx={{ cursor: 'pointer' }}
        />
      </Grid>

      {/* 4. Open Issues */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MuiStatCard
          title="Open Issues"
          value={openIssues}
          subtitle={openIssues > 0 ? 'Requires Supervisory Action' : 'All Systems Nominal'}
          icon={<WarningAmberIcon fontSize="small" />}
          accentColor={openIssues > 0 ? '#ed6c02' : '#757575'}
          onClick={() => navigate('/reports')}
          sx={{ cursor: 'pointer' }}
        />
      </Grid>
    </Grid>
  );
});

DashboardKpiDeck.displayName = 'DashboardKpiDeck';

DashboardKpiDeck.propTypes = {
  kpis: PropTypes.shape({
    activeBranches: PropTypes.number,
    totalReports: PropTypes.number,
    auditsThisWeek: PropTypes.number,
    openIssues: PropTypes.number,
    totalVisits: PropTypes.number,
  }),
  isLoading: PropTypes.bool,
};

export default DashboardKpiDeck;
