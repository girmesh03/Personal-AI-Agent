/**
 * @module components/dashboard/DashboardRecentAuditsLedger
 * @description Executive recent operational inspection reports ledger.
 * Features:
 * - Desktop & Tablet (sm+): High-density structured table with horizontal overflow protection.
 * - Mobile (xs, 375px): Stacked responsive card list with full-width primary navigation CTA.
 * - Bilingual date display (Gregorian ISO + Ethiopian calendar).
 * - Visited branch pills and issue status indicators.
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MuiButton from '../reusable/MuiButton.jsx';
import MuiEmptyState from '../reusable/MuiEmptyState.jsx';
import { toEthiopianDateString, computeShiftDuration } from '../../utils/ethiopianCalendar.js';

/**
 * Skeleton rows for recent inspections table during query latency.
 */
const TableSkeleton = () => (
  <TableBody>
    {[0, 1, 2].map((idx) => (
      <TableRow key={idx}>
        <TableCell sx={{ width: '18%', minWidth: 140 }}><Skeleton variant="text" width={110} height={24} /></TableCell>
        <TableCell sx={{ width: '32%', minWidth: 220 }}><Skeleton variant="rounded" width={140} height={28} /></TableCell>
        <TableCell sx={{ width: '20%', minWidth: 160 }}><Skeleton variant="text" width={90} height={24} /></TableCell>
        <TableCell sx={{ width: '15%', minWidth: 130 }}><Skeleton variant="rounded" width={80} height={24} /></TableCell>
        <TableCell align="right" sx={{ width: '15%', minWidth: 150 }}><Skeleton variant="rounded" width={100} height={32} sx={{ ml: 'auto' }} /></TableCell>
      </TableRow>
    ))}
  </TableBody>
);

/**
 * Skeleton cards for mobile view.
 */
const MobileSkeleton = () => (
  <Stack spacing={1.5}>
    {[0, 1, 2].map((idx) => (
      <Card key={idx} variant="outlined" sx={{ borderRadius: '10px' }}>
        <CardContent sx={{ p: 2 }}>
          <Skeleton variant="text" width="50%" height={24} sx={{ mb: 1 }} />
          <Skeleton variant="rounded" width="80%" height={26} sx={{ mb: 1 }} />
          <Skeleton variant="rounded" width="100%" height={36} />
        </CardContent>
      </Card>
    ))}
  </Stack>
);

/**
 * Formats report date into Gregorian ISO and Ethiopian calendar string.
 *
 * @param {string|Date} dateVal - Input date value.
 * @param {string} [ethiopianVal] - Optional backend Ethiopian date string.
 * @returns {{ gregorian: string, ethiopian: string }}
 */
const formatDatePair = (dateVal, ethiopianVal) => {
  if (!dateVal) return { gregorian: '—', ethiopian: '—' };
  const d = new Date(dateVal);
  const gregorian = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : String(dateVal);
  const ethiopian = ethiopianVal || toEthiopianDateString(dateVal);
  return { gregorian, ethiopian };
};

/**
 * Counts open issues in a report document.
 *
 * @param {Array<object>} issues - Report issues list.
 * @returns {number} Count of open issues.
 */
const countOpenIssues = (issues = []) => {
  if (!Array.isArray(issues)) return 0;
  return issues.filter((iss) => iss.status === 'reported' || iss.status === 'in_progress').length;
};

/**
 * Recent operational inspections ledger component.
 *
 * @component DashboardRecentAuditsLedger
 * @param {object} props - Component properties.
 * @param {Array<object>} [props.reports=[]] - List of recent 5 reports.
 * @param {boolean} [props.isLoading=false] - Whether query is loading.
 * @returns {JSX.Element} Rendered table or card list.
 */
export const DashboardRecentAuditsLedger = memo(({ reports = [], isLoading = false }) => {
  const hasReports = reports && reports.length > 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: '10px',
        bgcolor: 'background.paper',
        borderColor: 'divider',
      }}
    >
      {/* Header with Title and "View All Reports" Link */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 2.5,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <AssignmentOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Recent Operational Inspections
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Latest supervisor audit reports and store assessments
          </Typography>
        </Box>

        <MuiButton
          variant="text"
          size="small"
          component={Link}
          to="/reports"
          endIcon={<ArrowForwardIcon fontSize="small" />}
          sx={{ fontWeight: 700, fontSize: '0.82rem' }}
        >
          View All Reports
        </MuiButton>
      </Box>

      {/* Content Rendering */}
      {isLoading ? (
        <>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <TableContainer sx={{ overflowX: 'auto', width: '100%' }}>
              <Table sx={{ minWidth: 800, width: '100%' }} size="medium">
                <TableSkeleton />
              </Table>
            </TableContainer>
          </Box>
          <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
            <MobileSkeleton />
          </Box>
        </>
      ) : !hasReports ? (
        <MuiEmptyState
          title="No Recent Inspections Logged"
          subtitle="Start an inspection in Chat to record your store visits and generate operational dossiers."
          action={
            <MuiButton
              variant="contained"
              size="small"
              component={Link}
              to="/chat"
              sx={{ mt: 1 }}
            >
              Start Inspection
            </MuiButton>
          }
          sx={{ py: 4 }}
        />
      ) : (
        <>
          {/* Desktop & Tablet Table (sm+) */}
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <TableContainer sx={{ overflowX: 'auto', width: '100%' }}>
              <Table sx={{ minWidth: 800, width: '100%' }} size="medium">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' } }}>
                    <TableCell sx={{ width: '18%', minWidth: 140 }}>Date</TableCell>
                    <TableCell sx={{ width: '32%', minWidth: 220 }}>Visited Branches</TableCell>
                    <TableCell sx={{ width: '20%', minWidth: 160 }}>Shift Schedule</TableCell>
                    <TableCell sx={{ width: '15%', minWidth: 130 }}>Issues Status</TableCell>
                    <TableCell align="right" sx={{ width: '15%', minWidth: 150 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.map((report) => {
                    const { gregorian, ethiopian } = formatDatePair(report.date, report.ethiopianDate);
                    const openIssues = countOpenIssues(report.issues);
                    const duration = computeShiftDuration(report.clockIn, report.clockOut);
                    const visits = report.visits || [];

                    return (
                      <TableRow
                        key={report._id}
                        hover
                        sx={{
                          '&:last-child td, &:last-child th': { border: 0 },
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        {/* 1. Date */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                            {gregorian}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                            {ethiopian}
                          </Typography>
                        </TableCell>

                        {/* 2. Visited Branches */}
                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {visits.length === 0 ? (
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                None recorded
                              </Typography>
                            ) : (
                              visits.slice(0, 3).map((v, vIdx) => {
                                const b = v.branch;
                                const code = b?.code || (typeof b === 'string' ? b.slice(-4) : 'BR');
                                const name = b?.name || 'Branch';
                                return (
                                  <Chip
                                    key={v._id || vIdx}
                                    label={`${code} • ${name}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      fontSize: '0.74rem',
                                      height: 24,
                                      fontWeight: 600,
                                      borderColor: 'divider',
                                      bgcolor: 'action.hover',
                                      whiteSpace: 'nowrap',
                                    }}
                                  />
                                );
                              })
                            )}
                            {visits.length > 3 && (
                              <Chip
                                label={`+${visits.length - 3} more`}
                                size="small"
                                sx={{ fontSize: '0.72rem', height: 24, whiteSpace: 'nowrap' }}
                              />
                            )}
                          </Box>
                        </TableCell>

                        {/* 3. Shift Schedule */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" sx={{ fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
                            {report.clockIn && report.clockOut
                              ? `${report.clockIn} - ${report.clockOut}`
                              : 'Schedule not set'}
                          </Typography>
                          {duration && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {duration}
                            </Typography>
                          )}
                        </TableCell>

                        {/* 4. Issues Status */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {openIssues > 0 ? (
                            <Chip
                              icon={<WarningAmberIcon fontSize="small" />}
                              label={`${openIssues} Open Issue${openIssues === 1 ? '' : 's'}`}
                              size="small"
                              color="warning"
                              variant="outlined"
                              sx={{ fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            />
                          ) : (
                            <Chip
                              icon={<CheckCircleOutlineIcon fontSize="small" />}
                              label="All Clear"
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            />
                          )}
                        </TableCell>

                        {/* 5. Actions */}
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <MuiButton
                            variant="outlined"
                            size="small"
                            component={Link}
                            to={`/reports/${report._id}`}
                            endIcon={<OpenInNewIcon fontSize="small" />}
                            sx={{ fontSize: '0.78rem', py: 0.5, px: 1.5, whiteSpace: 'nowrap', minWidth: 130 }}
                          >
                            View Dossier
                          </MuiButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Mobile Stacked Cards (xs: <600px, 375px) */}
          <Stack spacing={1.5} sx={{ display: { xs: 'flex', sm: 'none' } }}>
            {reports.map((report) => {
              const { gregorian, ethiopian } = formatDatePair(report.date, report.ethiopianDate);
              const openIssues = countOpenIssues(report.issues);
              const duration = computeShiftDuration(report.clockIn, report.clockOut);
              const visits = report.visits || [];

              return (
                <Card
                  key={report._id}
                  variant="outlined"
                  sx={{
                    borderRadius: '10px',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    {/* Date and Status Badge */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.92rem' }}>
                          {gregorian}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                          {ethiopian}
                        </Typography>
                      </Box>

                      {openIssues > 0 ? (
                        <Chip
                          icon={<WarningAmberIcon fontSize="small" />}
                          label={`${openIssues} Open`}
                          size="small"
                          color="warning"
                          sx={{ fontWeight: 700, fontSize: '0.72rem', height: 22 }}
                        />
                      ) : (
                        <Chip
                          icon={<CheckCircleOutlineIcon fontSize="small" />}
                          label="Clean"
                          size="small"
                          color="success"
                          sx={{ fontWeight: 700, fontSize: '0.72rem', height: 22 }}
                        />
                      )}
                    </Box>

                    {/* Visited Branches Chips */}
                    {visits.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                        {visits.map((v, vIdx) => {
                          const b = v.branch;
                          const code = b?.code || (typeof b === 'string' ? b.slice(-4) : 'BR');
                          const name = b?.name || 'Branch';
                          return (
                            <Chip
                              key={v._id || vIdx}
                              label={`${code} • ${name}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.72rem', height: 22, fontWeight: 600 }}
                            />
                          );
                        })}
                      </Box>
                    )}

                    {/* Shift Duration */}
                    {(report.clockIn || report.clockOut) && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1.5 }}>
                        Shift: {report.clockIn || '—'} - {report.clockOut || '—'}
                        {duration ? ` (${duration})` : ''}
                      </Typography>
                    )}

                    {/* Fullwidth Action CTA */}
                    <MuiButton
                      variant="contained"
                      fullWidth
                      size="small"
                      component={Link}
                      to={`/reports/${report._id}`}
                      endIcon={<OpenInNewIcon fontSize="small" />}
                      sx={{ fontSize: '0.82rem', py: 0.75 }}
                    >
                      View Dossier
                    </MuiButton>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </>
      )}
    </Paper>
  );
});

DashboardRecentAuditsLedger.displayName = 'DashboardRecentAuditsLedger';

DashboardRecentAuditsLedger.propTypes = {
  reports: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      date: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      ethiopianDate: PropTypes.string,
      clockIn: PropTypes.string,
      clockOut: PropTypes.string,
      visits: PropTypes.array,
      issues: PropTypes.array,
      activities: PropTypes.array,
    })
  ),
  isLoading: PropTypes.bool,
};

export default DashboardRecentAuditsLedger;
