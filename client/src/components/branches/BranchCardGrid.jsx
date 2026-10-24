/**
 * @module components/branches/BranchCardGrid
 * @description Responsive card grid layout for operational branches.
 * Used on mobile viewports (< 600px) or when List view mode is selected on tablet/desktop.
 * Uses Material-UI Grid container and embeds conditional MuiPagination (only if totalPages > 1).
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import BranchCard from './BranchCard.jsx';
import MuiPagination from '../reusable/MuiPagination.jsx';
import MuiEmptyState from '../reusable/MuiEmptyState.jsx';

/**
 * Grid of branch cards with responsive columns and conditional pagination.
 *
 * @component BranchCardGrid
 * @param {object} props - Component properties.
 * @param {Array<object>} [props.branches=[]] - Branch documents.
 * @param {boolean} [props.isLoading=false] - Whether data is loading.
 * @param {(branch: object) => void} props.onView - Navigation to branch details.
 * @param {(branch: object) => void} props.onEdit - Open edit modal.
 * @param {(branch: object) => void} props.onArchive - Open archive confirmation.
 * @param {(branch: object) => void} props.onRestore - Open restore confirmation.
 * @param {(branch: object) => void} props.onDelete - Open permanent delete confirmation.
 * @param {string|null} [props.actionLoadingId=null] - ID of branch undergoing mutation.
 * @param {number} [props.page=1] - Active page number (1-based).
 * @param {number} [props.totalPages=1] - Total calculated pages.
 * @param {(page: number) => void} [props.onPageChange] - Page change handler.
 * @param {string} [props.emptyTitle='No operational branches found'] - Custom empty title.
 * @param {string} [props.emptyDescription='No branches match your current criteria.'] - Custom empty subtitle.
 * @returns {import('react').JSX.Element} Rendered branch card grid.
 */
export const BranchCardGrid = memo(({
  branches = [],
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
  emptyTitle = 'No operational branches found',
  emptyDescription = 'There are no store branches registered matching your current criteria.',
}) => {
  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
            <Skeleton
              variant="rounded"
              height={220}
              sx={{ borderRadius: 2, bgcolor: 'action.hover' }}
            />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (branches.length === 0) {
    return (
      <Box sx={{ py: 4 }}>
        <MuiEmptyState
          icon={<StorefrontOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary' }} />}
          title={emptyTitle}
          subtitle={emptyDescription}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={2}>
        {branches.map((branch) => (
          <Grid key={branch._id} size={{ xs: 12, sm: 6, md: 4 }}>
            <BranchCard
              branch={branch}
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

      {/* Conditional Pagination: Only renders if totalPages > 1 */}
      {totalPages > 1 && onPageChange && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <MuiPagination
            page={page}
            totalPages={totalPages}
            onChange={onPageChange}
          />
        </Box>
      )}
    </Box>
  );
});

BranchCardGrid.displayName = 'BranchCardGrid';

BranchCardGrid.propTypes = {
  branches: PropTypes.arrayOf(PropTypes.object),
  isLoading: PropTypes.bool,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onArchive: PropTypes.func.isRequired,
  onRestore: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
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
};

export default BranchCardGrid;
