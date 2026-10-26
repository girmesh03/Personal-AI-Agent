/**
 * @module components/reports/ReportCardGrid
 * @description Responsive card grid layout for operational reports.
 * Used on mobile viewports (< 600px) or when List view mode is selected on tablet/desktop.
 * Uses Material-UI Grid container and embeds conditional MuiPagination (only if totalPages > 1).
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ReportCard from './ReportCard.jsx';
import MuiPagination from '../reusable/MuiPagination.jsx';
import MuiEmptyState from '../reusable/MuiEmptyState.jsx';

/**
 * Grid of report cards with responsive columns and conditional pagination.
 *
 * @component ReportCardGrid
 * @param {object} props - Component properties.
 * @param {Array<object>} [props.reports=[]] - Report documents.
 * @param {boolean} [props.isLoading=false] - Whether data is loading.
 * @param {(report: object) => void} props.onView - Navigation to report details.
 * @param {(report: object) => void} [props.onEdit] - Open edit page.
 * @param {(report: object) => void} [props.onArchive] - Open archive confirmation.
 * @param {(report: object) => void} [props.onRestore] - Open restore confirmation.
 * @param {(report: object) => void} [props.onDelete] - Open permanent delete confirmation.
 * @param {object|null} [props.actionLoading=null] - Action-scoped loading state { id, action }.
 * @param {string|null} [props.actionLoadingId=null] - ID of report undergoing mutation.
 * @param {number} [props.page=1] - Active page number (1-based).
 * @param {number} [props.totalPages=1] - Total calculated pages.
 * @param {(page: number) => void} [props.onPageChange] - Page change handler.
 * @param {string} [props.emptyTitle='No inspection reports found'] - Custom empty title.
 * @param {string} [props.emptyDescription='There are no operational reports matching your current filter.'] - Custom empty subtitle.
 * @param {import('react').ReactNode} [props.emptyAction] - Action button element for empty state.
 * @returns {import('react').JSX.Element} Rendered report card grid.
 */
export const ReportCardGrid = memo(({
  reports = [],
  isLoading = false,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  actionLoading = null,
  actionLoadingId = null,
  page = 1,
  totalPages = 1,
  onPageChange,
  emptyTitle = 'No inspection reports found',
  emptyDescription = 'There are no operational reports matching your current filter.',
  emptyAction,
}) => {
  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
            <Skeleton
              variant="rounded"
              height={260}
              sx={{ borderRadius: 2, bgcolor: 'action.hover' }}
            />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (reports.length === 0) {
    return (
      <Box sx={{ py: 4 }}>
        <MuiEmptyState
          icon={<DescriptionOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary' }} />}
          title={emptyTitle}
          subtitle={emptyDescription}
          action={emptyAction}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={2}>
        {reports.map((report) => (
          <Grid key={report._id || report.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <ReportCard
              report={report}
              onView={onView}
              onEdit={onEdit}
              onArchive={onArchive}
              onRestore={onRestore}
              onDelete={onDelete}
              actionLoading={actionLoading}
              actionLoadingId={actionLoadingId}
            />
          </Grid>
        ))}
      </Grid>

      {totalPages > 1 && onPageChange && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 1 }}>
          <MuiPagination
            page={page}
            count={totalPages}
            onChange={onPageChange}
          />
        </Box>
      )}
    </Box>
  );
});

ReportCardGrid.displayName = 'ReportCardGrid';

ReportCardGrid.propTypes = {
  reports: PropTypes.arrayOf(PropTypes.object),
  isLoading: PropTypes.bool,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onArchive: PropTypes.func,
  onRestore: PropTypes.func,
  onDelete: PropTypes.func,
  actionLoading: PropTypes.shape({
    id: PropTypes.string,
    action: PropTypes.string,
  }),
  actionLoadingId: PropTypes.string,
  page: PropTypes.number,
  totalPages: PropTypes.number,
  onPageChange: PropTypes.func,
  emptyTitle: PropTypes.string,
  emptyDescription: PropTypes.string,
  emptyAction: PropTypes.node,
};

export default ReportCardGrid;
