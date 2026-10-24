/**
 * @module pages/BranchDetail
 * @description Master operational branch inspection details and analytics canvas.
 * Implements:
 * - Row 1: Breadcrumbs (Dashboard > Branches > Details) on left + Back to Branches button on right (iconified on xs < 600px).
 * - Row 2: BranchHero (code badge, bilingual name, aliases, status chip, location, manager, phone dial link).
 * - Row 3: BranchAnalyticsCharts (minimum 2 responsive charts side-by-side on md+, stacked on xs/sm: Visit Trend & Real Status Distribution).
 * - Row 4: BranchAuditHistory (historical ledger below charts, spanning full width xs: 12, DataGrid on sm+, Card list on xs, conditional pagination).
 * - Row 5: BranchDangerZone (Archive, Restore, and Permanent Cascade Deletion).
 * - Immediate modal dismissal with inline loading on action triggers.
 */

import { useState, useCallback, memo } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { toast } from 'react-toastify';

import MuiButton from '../components/reusable/MuiButton.jsx';
import MuiConfirmDialog from '../components/reusable/MuiConfirmDialog.jsx';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';
import MuiBranchDialog from '../components/branches/MuiBranchDialog.jsx';
import BranchHero from '../components/branches/BranchHero.jsx';
import BranchAnalyticsCharts from '../components/branches/BranchAnalyticsCharts.jsx';
import BranchAuditHistory from '../components/branches/BranchAuditHistory.jsx';
import BranchDangerZone from '../components/branches/BranchDangerZone.jsx';

import {
  useGetBranchByIdQuery,
  useGetBranchMetricsQuery,
  useArchiveBranchMutation,
  useRestoreBranchMutation,
  useDeleteBranchMutation,
} from '../redux/features/branchSlice.js';

/**
 * Branch details and operational analytics canvas view.
 *
 * @component BranchDetail
 * @returns {import('react').JSX.Element} Rendered branch detail page.
 */
export const BranchDetail = memo(() => {
  const { branchId } = useParams();
  const navigate = useNavigate();

  // Dialog and Action Lifecycle states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // 'archive' | 'restore' | 'delete' | null

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: null, // 'archive' | 'restore' | 'delete'
  });

  // RTK Query endpoints
  const {
    data: branchData,
    isLoading: isBranchLoading,
    error: branchError,
  } = useGetBranchByIdQuery(branchId, { skip: !branchId });

  const {
    data: metricsData,
    isLoading: isMetricsLoading,
  } = useGetBranchMetricsQuery(branchId, { skip: !branchId });

  const [archiveBranch] = useArchiveBranchMutation();
  const [restoreBranch] = useRestoreBranchMutation();
  const [deleteBranch] = useDeleteBranchMutation();

  const branch = branchData?.branch || branchData;
  const metrics = metricsData?.metrics || metricsData;

  // Open Edit Dialog
  const handleOpenEdit = useCallback(() => {
    setIsEditDialogOpen(true);
  }, []);

  // Open Confirm Modals
  const handleOpenArchive = useCallback(() => {
    setConfirmModal({ open: true, type: 'archive' });
  }, []);

  const handleOpenRestore = useCallback(() => {
    setConfirmModal({ open: true, type: 'restore' });
  }, []);

  const handleOpenDelete = useCallback(() => {
    setConfirmModal({ open: true, type: 'delete' });
  }, []);

  const handleCloseConfirm = useCallback(() => {
    setConfirmModal({ open: false, type: null });
  }, []);

  // Execute Confirmed Lifecycle Action with Immediate Dismissal & Inline Loading
  const handleExecuteConfirmedAction = useCallback(async () => {
    const { type } = confirmModal;
    if (!branch?._id) return;

    const targetId = branch._id;
    const targetName = branch.name;

    // 1. Immediately close the modal
    handleCloseConfirm();

    // 2. Set action-scoped loading state
    setActionLoading(type);

    try {
      if (type === 'archive') {
        await archiveBranch(targetId).unwrap();
        toast.success(`Branch "${targetName}" archived successfully.`);
      } else if (type === 'restore') {
        await restoreBranch(targetId).unwrap();
        toast.success(`Branch "${targetName}" restored successfully.`);
      } else if (type === 'delete') {
        await deleteBranch(targetId).unwrap();
        toast.success(`Branch "${targetName}" and associated data permanently deleted.`);
        navigate('/branches');
      }
    } catch (err) {
      toast.error(err?.data?.message || `Failed to ${type} branch. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  }, [confirmModal, branch, handleCloseConfirm, archiveBranch, restoreBranch, deleteBranch, navigate]);

  // Handle branch not found or load errors
  if (branchError) {
    return (
      <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
        <MuiEmptyState
          icon={<StorefrontOutlinedIcon sx={{ fontSize: 64, color: 'text.secondary' }} />}
          title="Branch Not Found"
          subtitle="The requested operational store branch could not be found or has been deleted."
          action={
            <MuiButton variant="contained" component={RouterLink} to="/branches">
              Back to Branches Directory
            </MuiButton>
          }
        />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* =========================================================================
          ROW 1: BREADCRUMBS & NAVIGATION RETURN
          Left: Dashboard > Branches > Details
          Right: ← Back to Branches (Iconified on xs < 600px)
          ========================================================================= */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: { xs: 2, sm: 2.5 },
          gap: 1,
        }}
      >
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
          aria-label="branch detail breadcrumbs"
        >
          <RouterLink
            to="/dashboard"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', fontWeight: 500, '&:hover': { color: 'primary.main' } }}
            >
              Dashboard
            </Typography>
          </RouterLink>
          <RouterLink
            to="/branches"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', fontWeight: 500, '&:hover': { color: 'primary.main' } }}
            >
              Branches
            </Typography>
          </RouterLink>
          <Typography
            variant="body2"
            sx={{ color: 'text.primary', fontWeight: 600 }}
          >
            Details
          </Typography>
        </Breadcrumbs>

        {/* Right: Back to Branches Action */}
        <Box sx={{ flexShrink: 0 }}>
          <MuiButton
            variant="outlined"
            color="inherit"
            startIcon={<ArrowBackIcon />}
            component={RouterLink}
            to="/branches"
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              textTransform: 'none',
              fontWeight: 500,
            }}
          >
            Back to Branches
          </MuiButton>

          <Tooltip title="Back to Branches">
            <span>
              <IconButton
                component={RouterLink}
                to="/branches"
                aria-label="Back to branches directory"
                sx={{
                  display: { xs: 'inline-flex', sm: 'none' },
                  border: (t) => `1px solid ${t.palette.divider}`,
                  p: 1,
                }}
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* =========================================================================
          ROW 2: BRANCH HERO PROFILE BANNER
          ========================================================================= */}
      <Box sx={{ mb: { xs: 2.5, sm: 3 } }}>
        {isBranchLoading ? (
          <Skeleton variant="rounded" height={200} sx={{ borderRadius: 2.5 }} />
        ) : (
          <BranchHero
            branch={branch}
            onEdit={handleOpenEdit}
            onArchive={handleOpenArchive}
            onRestore={handleOpenRestore}
            actionLoading={actionLoading}
            isActionLoading={Boolean(actionLoading)}
          />
        )}
      </Box>

      {/* =========================================================================
          ROW 3: BRANCH ANALYTICS CHARTS (Minimum 2 charts side-by-side on md+, stacked on xs/sm)
          Chart 1: Audit Visit Frequency Trend
          Chart 2: Operational Status Distribution (Real Schema Statuses)
          ========================================================================= */}
      <Box sx={{ mb: { xs: 2.5, sm: 3 } }}>
        <BranchAnalyticsCharts
          metrics={metrics}
          isLoading={isMetricsLoading}
        />
      </Box>

      {/* =========================================================================
          ROW 4: HISTORICAL AUDIT VISITS LEDGER (Full width xs: 12 below charts)
          ========================================================================= */}
      <Box sx={{ mb: { xs: 2.5, sm: 3 } }}>
        <BranchAuditHistory
          branchId={branchId}
          branchName={branch?.name}
        />
      </Box>

      {/* =========================================================================
          ROW 5: DANGER ZONE (Archive, Restore, Permanent Cascade Delete)
          ========================================================================= */}
      <Box sx={{ width: '100%' }}>
        <BranchDangerZone
          branch={branch}
          onArchive={handleOpenArchive}
          onRestore={handleOpenRestore}
          onDelete={handleOpenDelete}
          actionLoading={actionLoading}
          isActionLoading={Boolean(actionLoading)}
        />
      </Box>

      {/* =========================================================================
          MODALS & DIALOGS
          ========================================================================= */}

      {/* Edit Branch Dialog */}
      <MuiBranchDialog
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        branch={branch}
      />

      {/* Lifecycle Confirmation Modal */}
      <MuiConfirmDialog
        open={confirmModal.open}
        onClose={handleCloseConfirm}
        onConfirm={handleExecuteConfirmedAction}
        title={
          confirmModal.type === 'archive'
            ? 'Archive Operational Branch'
            : confirmModal.type === 'restore'
            ? 'Restore Operational Branch'
            : 'Permanently Delete Branch'
        }
        message={
          confirmModal.type === 'archive'
            ? `Are you sure you want to archive "${branch?.name}" (${branch?.code || 'N/A'})? It will be safely moved to the Archived tab.`
            : confirmModal.type === 'restore'
            ? `Are you sure you want to restore "${branch?.name}" (${branch?.code || 'N/A'})? It will become active and available for reports.`
            : `WARNING: You are about to permanently delete "${branch?.name}" (${branch?.code || 'N/A'}). This action CANNOT be undone and will permanently cascade to delete all associated audit reports and audio recordings.`
        }
        confirmText={
          confirmModal.type === 'archive'
            ? 'Archive Branch'
            : confirmModal.type === 'restore'
            ? 'Restore Branch'
            : 'Permanently Delete'
        }
        confirmColor={
          confirmModal.type === 'archive'
            ? 'warning'
            : confirmModal.type === 'restore'
            ? 'primary'
            : 'error'
        }
      />
    </Box>
  );
});

BranchDetail.displayName = 'BranchDetail';

export default BranchDetail;
