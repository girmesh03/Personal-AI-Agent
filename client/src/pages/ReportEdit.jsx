/**
 * @module pages/ReportEdit
 * @description Supervised Operational Report Editor Page.
 * Directly re-purposes production-grade modular subdocument cards:
 * - Row 1: Breadcrumbs (Dashboard > Reports > Edit) on left + Discard & Return button on right.
 * - Row 2: Shift Schedule & Inspection Date Card with MuiDatePicker and circular MuiTimePicker.
 * - Row 3: Authoritative Amharic Dossier Card (ReportAmharicDossier) with in-place text editing.
 * - Row 4: Branch Visits Ledger (ReportVisitsLedger) with in-place arrival/departure timing updates.
 * - Row 5: Operational Activities (ReportActivitiesCard) & Issues (ReportIssuesCard) side-by-side.
 * - Row 6: Supervisory Observations (ReportCommentsCard) with in-place adding and editing.
 * - Row 7: Danger Zone (ReportDangerZone) with soft-archive, restore, and cascade permanent deletion.
 * - Destructive action confirmation via MuiConfirmDialog.
 */

import { useState, useCallback, useEffect, memo } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { toast } from 'react-toastify';

import MuiButton from '../components/reusable/MuiButton.jsx';
import MuiDatePicker from '../components/reusable/MuiDatePicker.jsx';
import MuiTimePicker from '../components/reusable/MuiTimePicker.jsx';
import MuiConfirmDialog from '../components/reusable/MuiConfirmDialog.jsx';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';

import ReportAmharicDossier from '../components/reports/ReportAmharicDossier.jsx';
import ReportVisitsLedger from '../components/reports/ReportVisitsLedger.jsx';
import ReportActivitiesCard from '../components/reports/ReportActivitiesCard.jsx';
import ReportIssuesCard from '../components/reports/ReportIssuesCard.jsx';
import ReportCommentsCard from '../components/reports/ReportCommentsCard.jsx';
import ReportDangerZone from '../components/reports/ReportDangerZone.jsx';

import {
  useGetReportByIdQuery,
  useUpdateReportMutation,
  useArchiveReportMutation,
  useRestoreReportMutation,
  useDeleteReportMutation,
} from '../redux/features/reportSlice.js';
import { computeShiftDuration } from '../utils/ethiopianCalendar.js';

/**
 * Supervised operational report editor page component.
 *
 * @component ReportEdit
 * @returns {import('react').JSX.Element} Rendered report editor page view.
 */
export const ReportEdit = memo(() => {
  const { reportId } = useParams();
  const navigate = useNavigate();

  // RTK Query hooks
  const { data: reportData, isLoading, isError, error } = useGetReportByIdQuery(reportId);
  const report = reportData?.report || reportData?.doc || reportData;

  const [updateReport] = useUpdateReportMutation();
  const [archiveReport] = useArchiveReportMutation();
  const [restoreReport] = useRestoreReportMutation();
  const [deleteReport] = useDeleteReportMutation();

  // Shift schedule and inspection date local state
  const [selectedDate, setSelectedDate] = useState('');
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [isShiftSaving, setIsShiftSaving] = useState(false);

  // Sync initial shift data when report loads
  useEffect(() => {
    if (report) {
      if (report.date) {
        setSelectedDate(new Date(report.date).toISOString().split('T')[0]);
      }
      if (report.clockIn) {
        setClockIn(report.clockIn);
      }
      if (report.clockOut) {
        setClockOut(report.clockOut);
      }
    }
  }, [report]);

  // Modal and Action Loading lifecycle states
  const [actionLoading, setActionLoading] = useState(null); // { id, action }
  const [confirmModal, setConfirmModal] = useState({ open: false, type: null });

  // Navigation handlers
  const handleReturn = useCallback(() => {
    navigate(`/reports/${reportId}/details`);
  }, [navigate, reportId]);

  // Resilient change handlers extracting primitive string values
  const handleDateChange = useCallback((val) => {
    const str = typeof val === 'object' && val !== null ? (val.gregorian ?? val.value ?? val.target?.value ?? '') : (val || '');
    setSelectedDate(str);
  }, []);

  const handleClockInChange = useCallback((val) => {
    const str = typeof val === 'object' && val !== null ? (val.value ?? val.target?.value ?? '') : (val || '');
    setClockIn(str);
  }, []);

  const handleClockOutChange = useCallback((val) => {
    const str = typeof val === 'object' && val !== null ? (val.value ?? val.target?.value ?? '') : (val || '');
    setClockOut(str);
  }, []);

  // Shift schedule update handler
  const handleUpdateShift = useCallback(async () => {
    if (!selectedDate) {
      toast.error('Please select an inspection date.');
      return;
    }
    const cleanIn = typeof clockIn === 'string' ? clockIn.trim() : (clockIn?.value ?? '');
    const cleanOut = typeof clockOut === 'string' ? clockOut.trim() : (clockOut?.value ?? '');
    if (!cleanIn) {
      toast.error('Clock-in time is required.');
      return;
    }
    if (!cleanOut) {
      toast.error('Clock-out time is required.');
      return;
    }
    try {
      setIsShiftSaving(true);
      await updateReport({
        reportId,
        date: selectedDate,
        clockIn: cleanIn,
        clockOut: cleanOut,
      }).unwrap();
      toast.success('Shift schedule and inspection date updated.');
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to update shift schedule.');
    } finally {
      setIsShiftSaving(false);
    }
  }, [reportId, selectedDate, clockIn, clockOut, updateReport]);

  // Item-level mutation handlers for subdocuments
  const handleUpdateActivities = useCallback(
    async (updatedActivities) => {
      try {
        const res = await updateReport({ reportId, activities: updatedActivities }).unwrap();
        toast.success('Activity updated successfully.');
        return res;
      } catch (err) {
        toast.error(err?.data?.message || err?.message || 'Failed to update activity.');
        throw err;
      }
    },
    [reportId, updateReport]
  );

  const handleUpdateIssues = useCallback(
    async (updatedIssues) => {
      try {
        const res = await updateReport({ reportId, issues: updatedIssues }).unwrap();
        toast.success('Issue updated successfully.');
        return res;
      } catch (err) {
        toast.error(err?.data?.message || err?.message || 'Failed to update issue.');
        throw err;
      }
    },
    [reportId, updateReport]
  );

  const handleUpdateComments = useCallback(
    async (updatedComments) => {
      try {
        const res = await updateReport({ reportId, comments: updatedComments }).unwrap();
        toast.success('Observation updated successfully.');
        return res;
      } catch (err) {
        toast.error(err?.data?.message || err?.message || 'Failed to update observation.');
        throw err;
      }
    },
    [reportId, updateReport]
  );

  const handleUpdateVisits = useCallback(
    async (updatedVisits) => {
      try {
        const payloadVisits = updatedVisits.map((v) => ({
          branch: typeof v.branch === 'object' ? v.branch?._id || v.branch : v.branch,
          clockIn: v.clockIn,
          clockOut: v.clockOut,
        }));
        const res = await updateReport({ reportId, visits: payloadVisits }).unwrap();
        toast.success('Branch visit updated successfully.');
        return res;
      } catch (err) {
        toast.error(err?.data?.message || err?.message || 'Failed to update visit.');
        throw err;
      }
    },
    [reportId, updateReport]
  );

  const handleUpdateTranscription = useCallback(
    async (newTranscription) => {
      try {
        const res = await updateReport({ reportId, transcription: newTranscription }).unwrap();
        toast.success('Amharic dossier transcription updated.');
        return res;
      } catch (err) {
        toast.error(err?.data?.message || err?.message || 'Failed to update transcription.');
        throw err;
      }
    },
    [reportId, updateReport]
  );

  // Danger Zone confirmation triggers
  const handleOpenArchiveConfirm = useCallback(() => {
    setConfirmModal({ open: true, type: 'archive' });
  }, []);

  const handleOpenRestoreConfirm = useCallback(() => {
    setConfirmModal({ open: true, type: 'restore' });
  }, []);

  const handleOpenDeleteConfirm = useCallback(() => {
    setConfirmModal({ open: true, type: 'delete' });
  }, []);

  const handleCloseConfirm = useCallback(() => {
    setConfirmModal({ open: false, type: null });
  }, []);

  const handleConfirmAction = useCallback(async () => {
    const { type } = confirmModal;
    if (!reportId) return;

    handleCloseConfirm();
    setActionLoading({ id: reportId, action: type });

    try {
      if (type === 'archive') {
        await archiveReport(reportId).unwrap();
        toast.success('Operational report archived successfully.');
        navigate('/reports');
      } else if (type === 'restore') {
        await restoreReport(reportId).unwrap();
        toast.success('Operational report restored to active status.');
      } else if (type === 'delete') {
        await deleteReport(reportId).unwrap();
        toast.success('Operational report permanently deleted.');
        navigate('/reports');
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.message || `Failed to ${type} report.`);
    } finally {
      setActionLoading(null);
    }
  }, [confirmModal, handleCloseConfirm, reportId, archiveReport, restoreReport, deleteReport, navigate]);

  // Loading skeleton representation
  if (isLoading) {
    return (
      <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', p: { xs: 1.5, sm: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Skeleton variant="rounded" height={40} sx={{ borderRadius: 1.5 }} />
        <Skeleton variant="rounded" height={160} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  // Error or Not Found state
  if (isError || !report) {
    return (
      <Box sx={{ p: 4, width: '100%', maxWidth: 800, mx: 'auto' }}>
        <MuiEmptyState
          icon={<ErrorOutlineIcon sx={{ fontSize: 56, color: 'error.main' }} />}
          title="Operational Report Not Found"
          subtitle={error?.data?.message || error?.message || 'The requested operational report could not be located.'}
          action={
            <MuiButton variant="contained" component={RouterLink} to="/reports" startIcon={<ArrowBackIcon />}>
              Back to Reports
            </MuiButton>
          }
        />
      </Box>
    );
  }

  const isArchived = Boolean(report.isArchived);
  const shiftDuration = computeShiftDuration(clockIn, clockOut);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1400,
        mx: 'auto',
        p: { xs: 1.5, sm: 2.5, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2, sm: 2.5 },
      }}
    >
      {/* ROW 1: Breadcrumbs on Left + Discard & Return Button on Right */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
          aria-label="report edit navigation breadcrumb"
          sx={{
            '& .MuiBreadcrumbs-ol': { alignItems: 'center' },
            '& .MuiTypography-root': { fontSize: { xs: '0.8125rem', sm: '0.875rem' } },
          }}
        >
          <Typography
            component={RouterLink}
            to="/dashboard"
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              fontWeight: 500,
              '&:hover': { color: 'primary.main', textDecoration: 'underline' },
            }}
          >
            Dashboard
          </Typography>
          <Typography
            component={RouterLink}
            to="/reports"
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              fontWeight: 500,
              '&:hover': { color: 'primary.main', textDecoration: 'underline' },
            }}
          >
            Reports
          </Typography>
          <Typography color="text.primary" sx={{ fontWeight: 600 }}>
            Edit
          </Typography>
        </Breadcrumbs>

        {/* Discard & Return Action */}
        <Box>
          <MuiButton
            variant="outlined"
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={handleReturn}
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Discard & Return
          </MuiButton>

          {/* xs mobile icon button */}
          <Tooltip title="Discard & Return" arrow>
            <IconButton
              onClick={handleReturn}
              color="inherit"
              aria-label="Discard and return"
              sx={{
                display: { xs: 'inline-flex', sm: 'none' },
                border: (t) => `1px solid ${t.palette.divider}`,
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ROW 2: Shift Schedule & Inspection Date Card */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 2.5, md: 3 },
          borderRadius: 2,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1.5, sm: 2 },
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            pb: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleOutlinedIcon color="primary" sx={{ fontSize: 22 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
                Shift Schedule & Inspection Date
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                Manage the operational inspection date and supervisor working hours.
              </Typography>
            </Box>
          </Box>

          {/* Executive Header Controls: Duration Badge + Save Schedule Action */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              width: { xs: '100%', sm: 'auto' },
              justifyContent: { xs: 'space-between', sm: 'flex-end' },
            }}
          >
            {shiftDuration ? (
              <Chip
                label={`Duration: ${shiftDuration}`}
                color="primary"
                variant="outlined"
                size="small"
                sx={{ fontWeight: 600 }}
              />
            ) : null}
            <MuiButton
              variant="contained"
              color="primary"
              size="small"
              startIcon={isShiftSaving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlinedIcon fontSize="small" />}
              onClick={handleUpdateShift}
              disabled={isShiftSaving || isArchived}
              sx={{ fontWeight: 600, textTransform: 'none' }}
            >
              {isShiftSaving ? 'Saving...' : 'Save Schedule'}
            </MuiButton>
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <MuiDatePicker
              label="Inspection Date"
              value={selectedDate}
              onChange={handleDateChange}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <MuiTimePicker
              label="Work Clock-In"
              value={clockIn}
              onChange={handleClockInChange}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <MuiTimePicker
              label="Work Clock-Out"
              value={clockOut}
              onChange={handleClockOutChange}
              fullWidth
              size="small"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* ROW 3: Synthesized Authoritative Corporate Amharic Dossier */}
      <ReportAmharicDossier
        transcription={report.transcription}
        onUpdateTranscription={!isArchived ? handleUpdateTranscription : undefined}
      />

      {/* ROW 4: Structured Subdocument Panels Deck with Item-Level Editing */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Branch Visits Ledger */}
        <ReportVisitsLedger
          visits={report.visits || []}
          onUpdateVisits={!isArchived ? handleUpdateVisits : undefined}
        />

        {/* Operational Activities & Issues Side-by-Side on lg+ */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ReportActivitiesCard
              activities={report.activities || []}
              onUpdateActivities={!isArchived ? handleUpdateActivities : undefined}
            />
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ReportIssuesCard
              issues={report.issues || []}
              onUpdateIssues={!isArchived ? handleUpdateIssues : undefined}
            />
          </Grid>
        </Grid>

        {/* Supervisory Observations */}
        <ReportCommentsCard
          comments={report.comments || []}
          onUpdateComments={!isArchived ? handleUpdateComments : undefined}
        />
      </Box>

      {/* ROW 5: Danger Zone */}
      <ReportDangerZone
        isArchived={isArchived}
        onArchive={handleOpenArchiveConfirm}
        onRestore={handleOpenRestoreConfirm}
        onDelete={handleOpenDeleteConfirm}
        actionLoading={actionLoading}
      />

      {/* Confirmation Modal for Destructive Operations */}
      <MuiConfirmDialog
        open={confirmModal.open}
        title={
          confirmModal.type === 'archive'
            ? 'Archive Operational Report?'
            : confirmModal.type === 'restore'
              ? 'Restore Operational Report?'
              : 'Permanently Delete Report (Cascade)?'
        }
        message={
          confirmModal.type === 'archive'
            ? 'This report will be archived and hidden from active listings. It can be restored at any time within 30 days.'
            : confirmModal.type === 'restore'
              ? 'This report will be restored back to the active operational registry.'
              : 'This will permanently delete the report and unlink all physical voice recordings from the server. This action cannot be undone.'
        }
        confirmText={
          confirmModal.type === 'archive'
            ? 'Archive Report'
            : confirmModal.type === 'restore'
              ? 'Restore Report'
              : 'Delete Permanently'
        }
        confirmColor={
          confirmModal.type === 'archive'
            ? 'warning'
            : confirmModal.type === 'restore'
              ? 'success'
              : 'error'
        }
        onConfirm={handleConfirmAction}
        onClose={handleCloseConfirm}
      />
    </Box>
  );
});

ReportEdit.displayName = 'ReportEdit';

export default ReportEdit;
