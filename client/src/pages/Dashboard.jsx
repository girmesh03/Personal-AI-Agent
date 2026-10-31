/**
 * @module pages/Dashboard
 * @description Central executive operational intelligence canvas and supervisor dashboard.
 * Composes:
 * - Row 1: Header title, subtitle, and responsive quick action shortcuts (Chat inspection & add branch).
 * - Row 2: 4 KPI metric stat cards (Active Branches, Total Inspections, Audits This Week, Open Issues).
 * - Row 3: Side-by-side analytical charts (@mui/x-charts):
 *     Left: Top Visited Branches inspection frequency distribution (BarChart).
 *     Right: 14-day continuous audit volume trajectory (LineChart).
 * - Row 4: Recent operational inspections ledger (desktop high-density table and mobile card stack).
 */

import { memo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import RefreshIcon from '@mui/icons-material/Refresh';
import MuiButton from '../components/reusable/MuiButton.jsx';
import DashboardQuickActions from '../components/dashboard/DashboardQuickActions.jsx';
import DashboardKpiDeck from '../components/dashboard/DashboardKpiDeck.jsx';
import DashboardBranchVisitChart from '../components/dashboard/DashboardBranchVisitChart.jsx';
import DashboardAuditTrendChart from '../components/dashboard/DashboardAuditTrendChart.jsx';
import DashboardRecentAuditsLedger from '../components/dashboard/DashboardRecentAuditsLedger.jsx';
import MuiBranchDialog from '../components/branches/MuiBranchDialog.jsx';
import { useGetDashboardMetricsQuery } from '../redux/features/dashboardSlice.js';

/**
 * Executive operational intelligence dashboard canvas.
 *
 * @component Dashboard
 * @returns {JSX.Element} Rendered executive dashboard canvas.
 */
export const Dashboard = memo(() => {
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);

  const {
    data: metrics,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetDashboardMetricsQuery();

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: { xs: '100%', xl: 1600 },
        mx: 'auto',
        p: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
      }}
    >
      {/* =========================================================================
          ROW 1: HEADER & ACTIONS
          Left: Executive Title & Subtitle
          Right: Quick Action Shortcuts with In-Place Branch Add & Chat Inspection
          ========================================================================= */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1.5, sm: 2 },
          mb: { xs: 2, sm: 2.5, md: 3 },
        }}
      >
        <Box sx={{ minWidth: 0, flex: { sm: 1 }, mr: { sm: 2 } }}>
          <Typography
            variant="h5"
            component="h1"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.2rem', sm: '1.35rem', md: '1.5rem', lg: '1.65rem' },
              color: 'text.primary',
            }}
          >
            Operational Dashboard
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '0.78rem', sm: '0.82rem', md: '0.875rem' },
              mt: 0.25,
            }}
          >
            Platform-wide inspection intelligence and store network oversight
          </Typography>
        </Box>

        <DashboardQuickActions onAddBranch={() => setIsBranchDialogOpen(true)} />
      </Box>

      {/* Error Banner with Retry Interaction */}
      {isError && (
        <Alert
          severity="error"
          variant="outlined"
          sx={{ mb: 3, borderRadius: '8px', alignItems: 'center' }}
          action={
            <MuiButton
              color="inherit"
              size="small"
              onClick={refetch}
              startIcon={<RefreshIcon fontSize="small" />}
            >
              Retry
            </MuiButton>
          }
        >
          {error?.message || 'Failed to retrieve operational metrics. Please check your network connection.'}
        </Alert>
      )}

      {/* =========================================================================
          MAIN EXECUTIVE CANVAS CONTENT
          ========================================================================= */}
      <Stack spacing={{ xs: 2, sm: 2.5, md: 3 }}>
        {/* ROW 2: KPI DECK (4 Cards, 100% fullwidth on xs, 2x2 on sm, 1x4 on md+) */}
        <DashboardKpiDeck kpis={metrics?.kpis} isLoading={isLoading} />

        {/* ROW 3: ANALYTICS CHARTS (Side-by-Side on lg+, Stacked on xs/sm/md) */}
        <Grid container spacing={{ xs: 2, sm: 2.5 }}>
          <Grid size={{ xs: 12, sm: 12, md: 12, lg: 6, xl: 6 }}>
            <DashboardBranchVisitChart
              data={metrics?.branchVisitFrequency}
              isLoading={isLoading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 12, md: 12, lg: 6, xl: 6 }}>
            <DashboardAuditTrendChart
              data={metrics?.auditVolumeTrend}
              isLoading={isLoading}
            />
          </Grid>
        </Grid>

        {/* ROW 4: RECENT INSPECTIONS LEDGER (Mobile Card Deck & sm+ Table with Telegram Share) */}
        <DashboardRecentAuditsLedger
          reports={metrics?.recentReports}
          isLoading={isLoading}
        />
      </Stack>

      {/* Repurposed Modal Feature: In-Place Branch Creation */}
      <MuiBranchDialog
        open={isBranchDialogOpen}
        onClose={() => setIsBranchDialogOpen(false)}
        onSuccess={() => {
          refetch();
        }}
      />
    </Box>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;
