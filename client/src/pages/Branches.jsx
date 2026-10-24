/**
 * @module pages/Branches
 * @description Master operational branch directory and network management page.
 * Implements:
 * - Row 1: Breadcrumbs (Dashboard > Branches) on left + New Branch button on right (iconified on xs < 600px).
 * - Row 2: Single-row responsive BranchControlStrip (zero-lag search, active/archived toggle, grid/list switcher).
 * - Row 3: sm+ DataGrid view or responsive Card Grid view with conditional MuiPagination (totalPages > 1).
 * - Immediate modal dismissal with inline loading on row/card action buttons.
 * - MuiBranchDialog (create & edit with 409 collision highlighting and fullScreen on xs).
 * - MuiConfirmDialog (destructive actions confirmation with disableEnforceFocus & disableRestoreFocus).
 */

import { useState, useCallback, memo } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AddIcon from '@mui/icons-material/Add';
import { toast } from 'react-toastify';

import MuiButton from '../components/reusable/MuiButton.jsx';
import MuiConfirmDialog from '../components/reusable/MuiConfirmDialog.jsx';
import BranchControlStrip from '../components/branches/BranchControlStrip.jsx';
import BranchDataGrid from '../components/branches/BranchDataGrid.jsx';
import BranchCardGrid from '../components/branches/BranchCardGrid.jsx';
import MuiBranchDialog from '../components/branches/MuiBranchDialog.jsx';

import {
  useGetBranchesQuery,
  useArchiveBranchMutation,
  useRestoreBranchMutation,
  useDeleteBranchMutation,
} from '../redux/features/branchSlice.js';

/**
 * Branches directory page component.
 *
 * @component Branches
 * @returns {import('react').JSX.Element} Rendered branch directory page view.
 */
export const Branches = memo(() => {
  const navigate = useNavigate();

  // Control strip states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'archived'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [page, setPage] = useState(1);

  // Dialog and Action Lifecycle states
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // { id: string, action: 'archive' | 'restore' | 'delete' } | null

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: null, // 'archive' | 'restore' | 'delete'
    branch: null,
  });

  // RTK Query endpoints
  const { data: activeData, isLoading: isActiveLoading } = useGetBranchesQuery({
    page: statusFilter === 'active' ? page : 1,
    limit: 100,
    search: statusFilter === 'active' ? searchQuery : '',
    archived: false,
  });

  const { data: archivedData, isLoading: isArchivedLoading } = useGetBranchesQuery({
    page: statusFilter === 'archived' ? page : 1,
    limit: 100,
    search: statusFilter === 'archived' ? searchQuery : '',
    archived: true,
  });

  const [archiveBranch] = useArchiveBranchMutation();
  const [restoreBranch] = useRestoreBranchMutation();
  const [deleteBranch] = useDeleteBranchMutation();

  const activeBranches = activeData?.branches || [];
  const activeCount = activeData?.pagination?.total ?? activeBranches.length;

  const archivedBranches = archivedData?.branches || [];
  const archivedCount = archivedData?.pagination?.total ?? archivedBranches.length;

  const isCurrentLoading = statusFilter === 'active' ? isActiveLoading : isArchivedLoading;
  const currentBranches = statusFilter === 'active' ? activeBranches : archivedBranches;
  const currentPagination = statusFilter === 'active' ? activeData?.pagination : archivedData?.pagination;
  const totalPages = currentPagination?.totalPages || 1;

  // Search query updater from zero-lag control strip
  const handleSearchChange = useCallback((query) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

  // Status tab switcher
  const handleStatusFilterChange = useCallback((newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  }, []);

  // View mode switcher (grid vs list)
  const handleViewModeChange = useCallback((newMode) => {
    setViewMode(newMode);
  }, []);

  // Open Create Dialog
  const handleOpenCreate = useCallback(() => {
    setEditingBranch(null);
    setIsBranchDialogOpen(true);
  }, []);

  // Open Edit Dialog
  const handleOpenEdit = useCallback((branch) => {
    setEditingBranch(branch);
    setIsBranchDialogOpen(true);
  }, []);

  // Navigate to Branch Detail
  const handleView = useCallback((branch) => {
    if (branch?._id) {
      navigate(`/branches/${branch._id}/details`);
    }
  }, [navigate]);

  // Open Archive Confirm Modal
  const handleOpenArchive = useCallback((branch) => {
    setConfirmModal({
      open: true,
      type: 'archive',
      branch,
    });
  }, []);

  // Open Restore Confirm Modal
  const handleOpenRestore = useCallback((branch) => {
    setConfirmModal({
      open: true,
      type: 'restore',
      branch,
    });
  }, []);

  // Open Permanent Delete Confirm Modal
  const handleOpenDelete = useCallback((branch) => {
    setConfirmModal({
      open: true,
      type: 'delete',
      branch,
    });
  }, []);

  // Dismiss Confirm Modal
  const handleCloseConfirm = useCallback(() => {
    setConfirmModal({
      open: false,
      type: null,
      branch: null,
    });
  }, []);

  // Execute Confirmed Lifecycle Action with Immediate Dismissal & Inline Loading
  const handleExecuteConfirmedAction = useCallback(async () => {
    const { type, branch } = confirmModal;
    if (!branch?._id) return;

    const targetId = branch._id;
    const targetName = branch.name;

    // 1. Immediately close the modal to avoid modal locking
    handleCloseConfirm();

    // 2. Mark the target row/card with action-scoped loading
    setActionLoading({ id: targetId, action: type });

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
      }
    } catch (err) {
      toast.error(err?.data?.message || `Failed to ${type} branch. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  }, [confirmModal, handleCloseConfirm, archiveBranch, restoreBranch, deleteBranch]);

  return (
    <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* =========================================================================
          ROW 1: BREADCRUMBS & HEADER ACTION
          Left: Dashboard > Branches Breadcrumbs
          Right: + New Branch (Iconified on xs < 600px)
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
          aria-label="branch directory breadcrumbs"
        >
          <RouterLink
            to="/dashboard"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                '&:hover': { color: 'primary.main' },
              }}
            >
              Dashboard
            </Typography>
          </RouterLink>
          <Typography
            variant="body2"
            sx={{
              color: 'text.primary',
              fontWeight: 600,
            }}
          >
            Branches
          </Typography>
        </Breadcrumbs>

        {/* Right: + New Branch Button (Desktop/Tablet full button, Mobile icon-only) */}
        <Box sx={{ flexShrink: 0 }}>
          <MuiButton
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            New Branch
          </MuiButton>

          <Tooltip title="Add New Branch">
            <span>
              <IconButton
                color="primary"
                onClick={handleOpenCreate}
                aria-label="Add new branch"
                sx={{
                  display: { xs: 'inline-flex', sm: 'none' },
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  p: 1,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* =========================================================================
          ROW 2: SINGLE-ROW RESPONSIVE CONTROL STRIP
          Search (Zero-Lag) | Active/Archived Toggle | Grid/List View Switcher
          ========================================================================= */}
      <Box sx={{ mb: { xs: 2.5, sm: 3 } }}>
        <BranchControlStrip
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          activeCount={activeCount}
          archivedCount={archivedCount}
        />
      </Box>

      {/* =========================================================================
          ROW 3: BRANCHES DIRECTORY DISPLAY (DATAGRID vs CARD GRID)
          - sm+: DataGrid if viewMode === 'grid', CardGrid if viewMode === 'list'
          - xs: Always CardGrid (DataGrid hidden on mobile)
          ========================================================================= */}
      <Box sx={{ width: '100%' }}>
        {/* Desktop & Tablet DataGrid View (sm+ only, when grid mode selected) */}
        {viewMode === 'grid' && (
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <BranchDataGrid
              branches={currentBranches}
              isLoading={isCurrentLoading}
              onView={handleView}
              onEdit={handleOpenEdit}
              onArchive={handleOpenArchive}
              onRestore={handleOpenRestore}
              onDelete={handleOpenDelete}
              actionLoading={actionLoading}
              actionLoadingId={actionLoading?.id || null}
              emptyTitle={
                searchQuery
                  ? `No ${statusFilter} branches match "${searchQuery}"`
                  : `No ${statusFilter} branches found`
              }
              emptyDescription={
                searchQuery
                  ? 'Try clearing the search query to see all branches.'
                  : statusFilter === 'archived'
                  ? 'Archived store branches will appear here.'
                  : 'Register your first store branch to start logging audits.'
              }
            />
          </Box>
        )}

        {/* Card Grid View (Mobile xs always, or sm+ when list mode selected) */}
        <Box
          sx={{
            display: viewMode === 'list' ? 'block' : { xs: 'block', sm: 'none' },
          }}
        >
          <BranchCardGrid
            branches={currentBranches}
            isLoading={isCurrentLoading}
            onView={handleView}
            onEdit={handleOpenEdit}
            onArchive={handleOpenArchive}
            onRestore={handleOpenRestore}
            onDelete={handleOpenDelete}
            actionLoading={actionLoading}
            actionLoadingId={actionLoading?.id || null}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            emptyTitle={
              searchQuery
                ? `No ${statusFilter} branches match "${searchQuery}"`
                : `No ${statusFilter} branches found`
            }
            emptyDescription={
              searchQuery
                ? 'Try clearing the search query to see all branches.'
                : statusFilter === 'archived'
                ? 'Archived store branches will appear here.'
                : 'Register your first store branch to start logging audits.'
            }
          />
        </Box>
      </Box>

      {/* =========================================================================
          MODALS & DIALOGS
          ========================================================================= */}

      {/* Create & Edit Modal Dialog */}
      <MuiBranchDialog
        open={isBranchDialogOpen}
        onClose={() => setIsBranchDialogOpen(false)}
        branch={editingBranch}
      />

      {/* Action Confirmation Modal (Immediate Dismissal with Inline Spinner) */}
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
            ? `Are you sure you want to archive "${confirmModal.branch?.name}" (${confirmModal.branch?.code || 'N/A'})? It will be safely moved to the Archived tab.`
            : confirmModal.type === 'restore'
            ? `Are you sure you want to restore "${confirmModal.branch?.name}" (${confirmModal.branch?.code || 'N/A'})? It will become active and available for reports.`
            : `WARNING: You are about to permanently delete "${confirmModal.branch?.name}" (${confirmModal.branch?.code || 'N/A'}). This action CANNOT be undone and will permanently cascade to delete all associated audit reports and audio recordings.`
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

Branches.displayName = 'Branches';

export default Branches;
