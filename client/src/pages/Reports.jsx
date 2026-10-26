/**
 * @module pages/Reports
 * @description Master operational reports archive and inspection dossier directory.
 * Implements:
 * - Row 1: Breadcrumbs (Dashboard > Reports) on left + Start Inspection button on right (iconified on xs < 600px).
 * - Row 2: Single-row responsive ReportControlStrip (zero-lag search, branch selector, date filter, active/archived toggle, grid/list switcher).
 * - Row 3: sm+ DataGrid view or responsive Card Grid view with conditional MuiPagination (totalPages > 1).
 * - Immediate modal dismissal with inline loading on row/card action buttons.
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
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';

import MuiButton from '../components/reusable/MuiButton.jsx';
import MuiConfirmDialog from '../components/reusable/MuiConfirmDialog.jsx';
import ReportControlStrip from '../components/reports/ReportControlStrip.jsx';
import ReportDataGrid from '../components/reports/ReportDataGrid.jsx';
import ReportCardGrid from '../components/reports/ReportCardGrid.jsx';

import {
  useGetReportsQuery,
  useArchiveReportMutation,
  useRestoreReportMutation,
  useDeleteReportMutation,
} from '../redux/features/reportSlice.js';
import { useGetBranchesQuery } from '../redux/features/branchSlice.js';

/**
 * Operational reports archive page component.
 *
 * @component Reports
 * @returns {import('react').JSX.Element} Rendered reports archive page view.
 */
export const Reports = memo(() => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // vw < 600px

  // Control strip filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'archived'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  // Action Lifecycle & Confirmation states
  const [actionLoading, setActionLoading] = useState(null); // { id: string, action: 'archive' | 'restore' | 'delete' } | null
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: null, // 'archive' | 'restore' | 'delete'
    report: null,
  });

  // Fetch branches dataset for dropdown filter
  const { data: branchesData } = useGetBranchesQuery({ limit: 100, archived: false });
  const branches = branchesData?.branches || [];

  // Active reports query
  const { data: activeData, isLoading: isActiveLoading } = useGetReportsQuery({
    page: statusFilter === 'active' ? paginationModel.page + 1 : 1,
    limit: paginationModel.pageSize,
    search: statusFilter === 'active' ? searchQuery : '',
    branch: statusFilter === 'active' ? branchFilter : undefined,
    date: statusFilter === 'active' ? dateFilter : undefined,
    archived: false,
  });

  // Archived reports query
  const { data: archivedData, isLoading: isArchivedLoading } = useGetReportsQuery({
    page: statusFilter === 'archived' ? paginationModel.page + 1 : 1,
    limit: paginationModel.pageSize,
    search: statusFilter === 'archived' ? searchQuery : '',
    branch: statusFilter === 'archived' ? branchFilter : undefined,
    date: statusFilter === 'archived' ? dateFilter : undefined,
    archived: true,
  });

  // Mutations
  const [archiveReport] = useArchiveReportMutation();
  const [restoreReport] = useRestoreReportMutation();
  const [deleteReport] = useDeleteReportMutation();

  const activeReports = activeData?.reports || activeData?.docs || [];
  const activeCount = activeData?.totalDocs ?? activeReports.length;

  const archivedReports = archivedData?.reports || archivedData?.docs || [];
  const archivedCount = archivedData?.totalDocs ?? archivedReports.length;

  const isCurrentLoading = statusFilter === 'active' ? isActiveLoading : isArchivedLoading;
  const currentReports = statusFilter === 'active' ? activeReports : archivedReports;
  const currentTotalDocs = statusFilter === 'active' ? (activeData?.totalDocs || 0) : (archivedData?.totalDocs || 0);
  const currentTotalPages = statusFilter === 'active' ? (activeData?.totalPages || 1) : (archivedData?.totalPages || 1);

  // Search updater from zero-lag control strip
  const handleSearchChange = useCallback((query) => {
    setSearchQuery(query);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, []);

  // Branch filter change
  const handleBranchChange = useCallback((branchId) => {
    setBranchFilter(branchId);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, []);

  // Date filter change
  const handleDateChange = useCallback((date) => {
    setDateFilter(date);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, []);

  // Status tab switcher
  const handleStatusFilterChange = useCallback((newStatus) => {
    setStatusFilter(newStatus);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, []);

  // View mode switcher (grid vs list)
  const handleViewModeChange = useCallback((newMode) => {
    setViewMode(newMode);
  }, []);

  // Navigation handlers
  const handleView = useCallback((report) => {
    navigate(`/reports/${report._id}/details`);
  }, [navigate]);

  const handleEdit = useCallback((report) => {
    navigate(`/reports/${report._id}/edit`);
  }, [navigate]);

  // Confirmation triggers
  const handleOpenArchiveConfirm = useCallback((report) => {
    setConfirmModal({
      open: true,
      type: 'archive',
      report,
    });
  }, []);

  const handleOpenRestoreConfirm = useCallback((report) => {
    setConfirmModal({
      open: true,
      type: 'restore',
      report,
    });
  }, []);

  const handleOpenDeleteConfirm = useCallback((report) => {
    setConfirmModal({
      open: true,
      type: 'delete',
      report,
    });
  }, []);

  const handleCloseConfirm = useCallback(() => {
    setConfirmModal({ open: false, type: null, report: null });
  }, []);

  // Modal execution handler with immediate dismissal and action-scoped loading
  const handleConfirmAction = useCallback(async () => {
    const { type, report } = confirmModal;
    if (!report?._id) return;

    // Dismiss modal instantly
    handleCloseConfirm();
    setActionLoading({ id: report._id, action: type });

    try {
      if (type === 'archive') {
        await archiveReport(report._id).unwrap();
        toast.success('Operational report archived successfully.');
      } else if (type === 'restore') {
        await restoreReport(report._id).unwrap();
        toast.success('Operational report restored to active status.');
      } else if (type === 'delete') {
        await deleteReport(report._id).unwrap();
        toast.success('Operational report and all voice recordings permanently deleted.');
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.message || `Failed to ${type} report.`);
    } finally {
      setActionLoading(null);
    }
  }, [confirmModal, handleCloseConfirm, archiveReport, restoreReport, deleteReport]);

  // Mobile card pagination page change
  const handleCardPageChange = useCallback((newPage) => {
    setPaginationModel((prev) => ({ ...prev, page: newPage - 1 }));
  }, []);

  // DataGrid pagination model change
  const handlePaginationModelChange = useCallback((newModel) => {
    setPaginationModel(newModel);
  }, []);

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
      {/* ROW 1: Breadcrumbs on Left + Call-to-Action on Right */}
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
          aria-label="reports navigation breadcrumb"
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
          <Typography color="text.primary" sx={{ fontWeight: 600 }}>
            Reports
          </Typography>
        </Breadcrumbs>

        {/* Action Button: Start Inspection in Chat */}
        <Box>
          <MuiButton
            variant="contained"
            color="primary"
            startIcon={<ChatOutlinedIcon />}
            component={RouterLink}
            to="/chat"
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Start Inspection in Chat
          </MuiButton>

          {/* xs mobile icon button */}
          <Tooltip title="Start Inspection in Chat" arrow>
            <IconButton
              component={RouterLink}
              to="/chat"
              color="primary"
              aria-label="Start inspection in chat"
              sx={{
                display: { xs: 'inline-flex', sm: 'none' },
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <ChatOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ROW 2: Single-Row Responsive Control Strip */}
      <ReportControlStrip
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        branchFilter={branchFilter}
        onBranchChange={handleBranchChange}
        branches={branches}
        dateFilter={dateFilter}
        onDateChange={handleDateChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        activeCount={activeCount}
        archivedCount={archivedCount}
        disabled={isCurrentLoading && !currentReports.length}
      />

      {/* ROW 3: Main Data Display (DataGrid vs Cards) */}
      <Box sx={{ width: '100%', minWidth: 0, flexGrow: 1 }}>
        {isMobile || viewMode === 'cards' || viewMode === 'list' ? (
          <ReportCardGrid
            reports={currentReports}
            isLoading={isCurrentLoading}
            onView={handleView}
            onEdit={handleEdit}
            onArchive={handleOpenArchiveConfirm}
            onRestore={handleOpenRestoreConfirm}
            onDelete={handleOpenDeleteConfirm}
            actionLoading={actionLoading}
            page={paginationModel.page + 1}
            totalPages={currentTotalPages}
            onPageChange={handleCardPageChange}
            emptyTitle={
              statusFilter === 'archived'
                ? 'No archived reports'
                : searchQuery || branchFilter || dateFilter
                  ? 'No matching reports found'
                  : 'No inspection reports recorded'
            }
            emptyDescription={
              statusFilter === 'archived'
                ? 'Archived inspection reports will appear here.'
                : searchQuery || branchFilter || dateFilter
                  ? 'Try adjusting your search query, branch filter, or date.'
                  : 'Start a voice inspection in Chat to generate your first corporate report.'
            }
            emptyAction={
              statusFilter === 'active' && !searchQuery && !branchFilter && !dateFilter ? (
                <MuiButton
                  variant="contained"
                  component={RouterLink}
                  to="/chat"
                  startIcon={<ChatOutlinedIcon />}
                >
                  Start Inspection in Chat
                </MuiButton>
              ) : null
            }
          />
        ) : (
          <ReportDataGrid
            reports={currentReports}
            isLoading={isCurrentLoading}
            onView={handleView}
            onEdit={handleEdit}
            onArchive={handleOpenArchiveConfirm}
            onRestore={handleOpenRestoreConfirm}
            onDelete={handleOpenDeleteConfirm}
            actionLoading={actionLoading}
            isArchived={statusFilter === 'archived'}
            rowCount={currentTotalDocs}
            paginationModel={paginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            paginationMode="server"
            emptyTitle={
              statusFilter === 'archived'
                ? 'No archived reports'
                : searchQuery || branchFilter || dateFilter
                  ? 'No matching reports found'
                  : 'No inspection reports recorded'
            }
            emptyDescription={
              statusFilter === 'archived'
                ? 'Archived operational reports will appear here.'
                : searchQuery || branchFilter || dateFilter
                  ? 'Try adjusting your search query, branch filter, or date.'
                  : 'Start a voice inspection in Chat to generate your first corporate report.'
            }
            emptyAction={
              statusFilter === 'active' && !searchQuery && !branchFilter && !dateFilter ? (
                <MuiButton
                  variant="contained"
                  component={RouterLink}
                  to="/chat"
                  startIcon={<ChatOutlinedIcon />}
                >
                  Start Inspection in Chat
                </MuiButton>
              ) : null
            }
          />
        )}
      </Box>

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

Reports.displayName = 'Reports';

export default Reports;
