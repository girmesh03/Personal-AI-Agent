/**
 * @module components/branches/BranchAuditHistory
 * @description Historical inspections ledger component (Row 4).
 * Spans full width (xs: 12) placed below the analytics charts.
 * Features:
 * - Fluid flex columns with minWidth (Zero static widths) via getAuditHistoryColumns.
 * - Displays actual schema statuses (Activities: completed, in_progress; Issues: reported, in_progress, completed, no_issue).
 * - sm+ DataGrid table view / xs responsive card list.
 * - Reusable MuiPagination (conditional: renders only if totalPages > 1).
 */

import { useState, useMemo, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import MuiDataGrid from '../reusable/MuiDataGrid.jsx';
import MuiPagination from '../reusable/MuiPagination.jsx';
import MuiEmptyState from '../reusable/MuiEmptyState.jsx';
import { getAuditHistoryColumns } from '../columns/auditHistoryColumns.jsx';
import { useGetReportsQuery } from '../../redux/features/reportSlice.js';

/**
 * Historical inspections visits ledger component.
 *
 * @component BranchAuditHistory
 * @param {object} props - Component properties.
 * @param {string} props.branchId - Active operational branch identifier.
 * @param {string} [props.branchName=''] - Active branch name.
 * @returns {import('react').JSX.Element} Rendered audit history ledger.
 */
export const BranchAuditHistory = memo(({
  branchId,
  branchName = '',
}) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  // Query reports scoped to this branch
  const { data, isLoading } = useGetReportsQuery({
    branch: branchId,
    page,
    limit: 10,
  });

  const reports = data?.reports || [];
  const pagination = data?.pagination;
  const totalReports = pagination?.total ?? reports.length;
  const totalPages = pagination?.totalPages || 1;

  // Navigate to report dossier
  const handleViewReport = useCallback((report) => {
    if (report?._id) {
      navigate(`/reports/${report._id}/details`);
    }
  }, [navigate]);

  // Memoized column configurations with fluid flex weights
  const columns = useMemo(
    () =>
      getAuditHistoryColumns({
        branchId,
        onViewReport: handleViewReport,
      }),
    [branchId, handleViewReport]
  );

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2.5,
        bgcolor: 'background.paper',
        width: '100%',
      }}
    >
      {/* Header Strip */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2.5,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryEduOutlinedIcon color="primary" sx={{ fontSize: 24 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
              Historical Audit Visits Ledger
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Full chronological inspection records and status audits for {branchName || 'this branch'}
            </Typography>
          </Box>
        </Box>

        <Chip
          label={`${totalReports} Audit${totalReports === 1 ? '' : 's'} Total`}
          size="small"
          variant="outlined"
          color="primary"
          sx={{ fontWeight: 600 }}
        />
      </Box>

      {/* =========================================================================
          DESKTOP & TABLET VIEW: sm+ Reusable MuiDataGrid with Fluid Flex Columns
          ========================================================================= */}
      <Box sx={{ display: { xs: 'none', sm: 'block' }, width: '100%' }}>
        <MuiDataGrid
          rows={reports}
          columns={columns}
          loading={isLoading}
          getRowId={(row) => row._id}
          emptyIcon={<HistoryEduOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary' }} />}
          emptyTitle="No Inspection Visits Found"
          emptySubtitle="Audits logged for this branch through chat or the report editor will appear here."
          autoHeight
        />
      </Box>

      {/* =========================================================================
          MOBILE VIEW: xs Responsive Cards List
          ========================================================================= */}
      <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 1.5 }}>
        {reports.length === 0 && !isLoading ? (
          <Box sx={{ py: 3 }}>
            <MuiEmptyState
              icon={<HistoryEduOutlinedIcon sx={{ fontSize: 36, color: 'text.secondary' }} />}
              title="No Audits Found"
              subtitle="Inspection visits logged for this branch will appear here."
            />
          </Box>
        ) : (
          reports.map((report) => {
            const dateStr = report?.date ? new Date(report.date).toISOString().split('T')[0] : 'N/A';
            const visit = (report?.visits || []).find(
              (v) => String(v.branch?._id || v.branch) === String(branchId)
            ) || report?.visits?.[0];
            const shiftHours = visit?.clockIn && visit?.clockOut
              ? `${visit.clockIn} - ${visit.clockOut}`
              : report?.clockIn && report?.clockOut
              ? `${report.clockIn} - ${report.clockOut}`
              : '08:30 - 17:00';

            const activities = report?.activities || [];
            const completedActivities = activities.filter((a) => a.status === 'completed').length;
            const inProgressActivities = activities.filter((a) => a.status === 'in_progress').length;

            const issues = report?.issues || [];
            const reportedIssues = issues.filter((i) => i.status === 'reported').length;
            const inProgressIssues = issues.filter((i) => i.status === 'in_progress').length;
            const completedIssues = issues.filter((i) => i.status === 'completed').length;

            return (
              <Card
                key={report._id}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  {/* Date and Action */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <EventOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {dateStr}
                      </Typography>
                      {report?.ethiopianDate && (
                        <Chip
                          label={report.ethiopianDate}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                    <Tooltip title="View Report Dossier">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewReport(report)}
                        aria-label="View report"
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Shift Timing */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <AccessTimeOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Shift: {shiftHours}
                    </Typography>
                  </Box>

                  {/* Real Status Badges */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                    {completedActivities > 0 && (
                      <Chip
                        label={`${completedActivities} act. done`}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                    {inProgressActivities > 0 && (
                      <Chip
                        label={`${inProgressActivities} act. pending`}
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                    {reportedIssues > 0 && (
                      <Chip
                        label={`${reportedIssues} issues flagged`}
                        size="small"
                        color="error"
                        sx={{ fontSize: '0.7rem', fontWeight: 600 }}
                      />
                    )}
                    {inProgressIssues > 0 && (
                      <Chip
                        label={`${inProgressIssues} issues in progress`}
                        size="small"
                        color="warning"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                    {completedIssues > 0 && (
                      <Chip
                        label={`${completedIssues} issues resolved`}
                        size="small"
                        color="success"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })
        )}
      </Box>

      {/* =========================================================================
          CONDITIONAL PAGINATION: Only rendered if totalPages > 1
          ========================================================================= */}
      {totalPages > 1 && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <MuiPagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
          />
        </Box>
      )}
    </Paper>
  );
});

BranchAuditHistory.displayName = 'BranchAuditHistory';

BranchAuditHistory.propTypes = {
  branchId: PropTypes.string.isRequired,
  branchName: PropTypes.string,
};

export default BranchAuditHistory;
