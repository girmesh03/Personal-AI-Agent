/**
 * @module pages/ReportDetail
 * @description Master Inspection Report Detail Dossier & 5 Corporate Delivery Channels canvas.
 * Implements:
 * - Row 1: Breadcrumbs (Dashboard > Reports > Details) on left + Back button on right (iconified on xs < 600px).
 * - Row 2: ReportHero (Inspection date Gregorian + Ethiopian ዓ.ም, Shift hours, Supervisor author, status, Edit/Archive/Restore).
 * - Row 3: ReportDeliveryActionBar (The 5 delivery channels: Clipboard, UTF-8 BOM txt, Print/PDF, Drive, Telegram).
 * - Row 4: ReportAmharicDossier (Authoritative SSOT Amharic text with Ge'ez typography).
 * - Row 5: Subdocuments Deck (Visits Ledger, Activities Checklist, Issues Triage, Supervisory Comments).
 * - Row 6: ReportAudioPlayerDeck (Evidentiary voice notes with HTML5 player).
 * - Row 7: ReportDangerZone (Archive, Restore, Permanent Cascade Deletion).
 * - Dedicated @media print stylesheet for high-fidelity vector printing and clean page breaks.
 */

import { useState, useCallback, memo } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import { toast } from 'react-toastify';

import MuiButton from '../components/reusable/MuiButton.jsx';
import MuiConfirmDialog from '../components/reusable/MuiConfirmDialog.jsx';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';

import ReportHero from '../components/reports/ReportHero.jsx';
import ReportDeliveryActionBar from '../components/reports/ReportDeliveryActionBar.jsx';
import ReportAmharicDossier from '../components/reports/ReportAmharicDossier.jsx';
import ReportVisitsLedger from '../components/reports/ReportVisitsLedger.jsx';
import ReportActivitiesCard from '../components/reports/ReportActivitiesCard.jsx';
import ReportIssuesCard from '../components/reports/ReportIssuesCard.jsx';
import ReportCommentsCard from '../components/reports/ReportCommentsCard.jsx';
import ReportAudioPlayerDeck from '../components/reports/ReportAudioPlayerDeck.jsx';
import ReportDangerZone from '../components/reports/ReportDangerZone.jsx';

import {
  useGetReportByIdQuery,
  useUpdateReportMutation,
  useArchiveReportMutation,
  useRestoreReportMutation,
  useDeleteReportMutation,
} from '../redux/features/reportSlice.js';

/**
 * Report detail view orchestrator.
 *
 * @component ReportDetail
 * @returns {import('react').JSX.Element} Rendered report detail page view.
 */
export const ReportDetail = memo(() => {
  const { reportId } = useParams();
  const navigate = useNavigate();

  // Dialog and Action Lifecycle states
  const [actionLoading, setActionLoading] = useState(null); // { id: string, action: 'archive' | 'restore' | 'delete' } | null
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: null, // 'archive' | 'restore' | 'delete'
  });

  // Fetch report by ID
  const { data: reportData, isLoading, isError, error } = useGetReportByIdQuery(reportId);
  const report = reportData?.report || reportData?.doc || reportData;

  const [updateReport] = useUpdateReportMutation();
  const [archiveReport] = useArchiveReportMutation();
  const [restoreReport] = useRestoreReportMutation();
  const [deleteReport] = useDeleteReportMutation();

  // Item-level update handlers for in-place subdocument edits
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
        const res = await updateReport({ reportId, visits: updatedVisits }).unwrap();
        toast.success('Branch visit updated successfully.');
        return res;
      } catch (err) {
        toast.error(err?.data?.message || err?.message || 'Failed to update visit.');
        throw err;
      }
    },
    [reportId, updateReport]
  );

  // Navigation handlers
  const handleEdit = useCallback(() => {
    navigate(`/reports/${reportId}/edit`);
  }, [navigate, reportId]);

  // Confirmation triggers
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

  // Modal execution handler with immediate dismissal and action-scoped loading
  const handleConfirmAction = useCallback(async () => {
    const { type } = confirmModal;
    if (!reportId) return;

    handleCloseConfirm();
    setActionLoading({ id: reportId, action: type });

    try {
      if (type === 'archive') {
        await archiveReport(reportId).unwrap();
        toast.success('Operational report archived successfully.');
      } else if (type === 'restore') {
        await restoreReport(reportId).unwrap();
        toast.success('Operational report restored to active status.');
      } else if (type === 'delete') {
        await deleteReport(reportId).unwrap();
        toast.success('Operational report and all voice recordings permanently deleted.');
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
        <Skeleton variant="rounded" height={160} sx={{ borderRadius: 2.5 }} />
        <Skeleton variant="rounded" height={60} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 2 }} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Skeleton variant="rounded" height={200} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Skeleton variant="rounded" height={200} sx={{ borderRadius: 2 }} />
          </Grid>
        </Grid>
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
          subtitle={error?.data?.message || error?.message || 'The requested operational report could not be located or may have been permanently purged.'}
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
        // Dedicated Print Stylesheet Injection
        '@media print': {
          p: 0,
          m: 0,
          '& .MuiBreadcrumbs-root, & .report-back-btn, & .report-action-bar, & .report-danger-zone, & .report-audio-deck, & button': {
            display: 'none !important',
          },
          '& .MuiPaper-root': {
            border: 'none !important',
            boxShadow: 'none !important',
            p: 1,
          },
        },
      }}
    >
      {/* ROW 1: Breadcrumbs on Left + Back to Reports Button on Right */}
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
          aria-label="report details navigation breadcrumb"
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
            Details
          </Typography>
        </Breadcrumbs>

        {/* Back to Reports Action Button */}
        <Box className="report-back-btn">
          <MuiButton
            variant="outlined"
            color="inherit"
            startIcon={<ArrowBackIcon />}
            component={RouterLink}
            to="/reports"
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Back to Reports
          </MuiButton>

          {/* xs mobile icon button */}
          <Tooltip title="Back to Reports" arrow>
            <IconButton
              component={RouterLink}
              to="/reports"
              color="inherit"
              aria-label="Back to reports"
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

      {/* ROW 2: Report Hero Profile & Metadata Banner */}
      <ReportHero
        report={report}
        onEdit={!isArchived ? handleEdit : undefined}
        onArchive={!isArchived ? handleOpenArchiveConfirm : undefined}
        onRestore={isArchived ? handleOpenRestoreConfirm : undefined}
        actionLoading={actionLoading}
      />

      {/* ROW 3: The 5 Corporate Delivery Channels Action Bar */}
      <ReportDeliveryActionBar report={report} />

      {/* ROW 4: Synthesized Authoritative Corporate Amharic Dossier */}
      <ReportAmharicDossier transcription={report.transcription} />

      {/* ROW 5: Structured Subdocument Panels Deck with Item-Level Editing */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Branch Visits Ledger */}
        <ReportVisitsLedger
          visits={report.visits || []}
          onUpdateVisits={!isArchived ? handleUpdateVisits : undefined}
        />

        {/* Operational Activities & Issues Side-by-Side on md+ */}
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

      {/* ROW 6: Evidentiary Voice Notes & Audio Player Deck */}
      <ReportAudioPlayerDeck audios={report.audios || []} />

      {/* ROW 7: Danger Zone */}
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

ReportDetail.displayName = 'ReportDetail';

export default ReportDetail;
