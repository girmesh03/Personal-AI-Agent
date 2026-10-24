/**
 * @module components/branches/BranchDataGrid
 * @description Operational store branches DataGrid view component.
 * Rendered on sm+ viewports. Wraps reusable MuiDataGrid with colocated branch columns,
 * fluid proportional flex widths, and inline loading action buttons.
 */

import { useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import MuiDataGrid from '../reusable/MuiDataGrid.jsx';
import { getBranchColumns } from '../columns/branchColumns.jsx';

/**
 * DataGrid table component for operational branches.
 *
 * @component BranchDataGrid
 * @param {object} props - Component properties.
 * @param {Array<object>} [props.branches=[]] - Array of branch documents.
 * @param {boolean} [props.isLoading=false] - Data fetching state.
 * @param {(branch: object) => void} props.onView - Navigation handler to branch details.
 * @param {(branch: object) => void} props.onEdit - Edit modal trigger handler.
 * @param {(branch: object) => void} props.onArchive - Archive confirmation trigger.
 * @param {(branch: object) => void} props.onRestore - Restore confirmation trigger.
 * @param {(branch: object) => void} props.onDelete - Permanent cascade delete trigger.
 * @param {string|null} [props.actionLoadingId=null] - ID of branch undergoing an active mutation.
 * @param {string} [props.emptyTitle='No branches found'] - Custom empty state title.
 * @param {string} [props.emptyDescription='No branches match your current filter.'] - Custom empty subtitle.
 * @returns {import('react').JSX.Element} Rendered Branch DataGrid element.
 */
export const BranchDataGrid = memo(({
  branches = [],
  isLoading = false,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  actionLoading = null,
  actionLoadingId = null,
  emptyTitle = 'No operational branches found',
  emptyDescription = 'There are no store branches registered matching your current criteria.',
}) => {
  // Construct memoized column definitions with handlers and action state
  const columns = useMemo(
    () =>
      getBranchColumns({
        onView,
        onEdit,
        onArchive,
        onRestore,
        onDelete,
        actionLoading,
        actionLoadingId,
      }),
    [onView, onEdit, onArchive, onRestore, onDelete, actionLoading, actionLoadingId]
  );

  return (
    <Box sx={{ width: '100%' }}>
      <MuiDataGrid
        rows={branches}
        columns={columns}
        loading={isLoading}
        getRowId={(row) => row._id}
        emptyIcon={<StorefrontOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary' }} />}
        emptyTitle={emptyTitle}
        emptySubtitle={emptyDescription}
        autoHeight
      />
    </Box>
  );
});

BranchDataGrid.displayName = 'BranchDataGrid';

BranchDataGrid.propTypes = {
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
  emptyTitle: PropTypes.string,
  emptyDescription: PropTypes.string,
};

export default BranchDataGrid;
