/**
 * @module components/reports/ReportDataGrid
 * @description Operational inspection reports DataGrid view component.
 * Rendered on sm+ viewports. Wraps reusable MuiDataGrid with colocated report columns,
 * fluid proportional flex widths, and inline loading action buttons.
 */

import { useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import MuiDataGrid from '../reusable/MuiDataGrid.jsx';
import { getReportColumns } from '../columns/reportColumns.jsx';

/**
 * DataGrid table component for operational reports archive.
 *
 * @component ReportDataGrid
 * @param {object} props - Component properties.
 * @param {Array<object>} [props.reports=[]] - Array of report documents.
 * @param {boolean} [props.isLoading=false] - Data fetching state.
 * @param {(report: object) => void} props.onView - Navigation handler to report dossier.
 * @param {(report: object) => void} [props.onEdit] - Edit page trigger handler.
 * @param {(report: object) => void} [props.onArchive] - Archive confirmation trigger.
 * @param {(report: object) => void} [props.onRestore] - Restore confirmation trigger.
 * @param {(report: object) => void} [props.onDelete] - Permanent cascade delete trigger.
 * @param {object|null} [props.actionLoading=null] - Action-scoped loading state { id, action }.
 * @param {string|null} [props.actionLoadingId=null] - Legacy fallback ID of mutating report.
 * @param {boolean} [props.isArchived=false] - Whether displaying archived reports dataset.
 * @param {number} [props.rowCount] - Total server count of reports.
 * @param {object} [props.paginationModel] - Controlled pagination model ({ page, pageSize }).
 * @param {Function} [props.onPaginationModelChange] - Pagination change handler.
 * @param {'server'|'client'} [props.paginationMode='server'] - Pagination computation mode.
 * @param {string} [props.emptyTitle='No inspection reports found'] - Custom empty state title.
 * @param {string} [props.emptyDescription='There are no operational reports matching your current filter.'] - Custom empty subtitle.
 * @param {import('react').ReactNode} [props.emptyAction] - Action button element for empty state.
 * @returns {import('react').JSX.Element} Rendered Report DataGrid element.
 */
export const ReportDataGrid = memo(({
  reports = [],
  isLoading = false,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  actionLoading = null,
  actionLoadingId = null,
  isArchived = false,
  rowCount,
  paginationModel,
  onPaginationModelChange,
  paginationMode = 'server',
  emptyTitle = 'No inspection reports found',
  emptyDescription = 'There are no operational reports matching your current filter.',
  emptyAction,
}) => {
  // Construct memoized column definitions with handlers and action state
  const columns = useMemo(
    () =>
      getReportColumns({
        onView,
        onEdit,
        onArchive,
        onRestore,
        onDelete,
        actionLoading,
        actionLoadingId,
        isArchived,
      }),
    [onView, onEdit, onArchive, onRestore, onDelete, actionLoading, actionLoadingId, isArchived]
  );

  return (
    <Box sx={{ width: '100%', minWidth: 0, flexGrow: 1 }}>
      <MuiDataGrid
        rows={reports}
        columns={columns}
        loading={isLoading}
        rowCount={rowCount}
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
        paginationMode={paginationMode}
        getRowId={(row) => row?._id || row?.id}
        emptyIcon={<DescriptionOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary' }} />}
        emptyTitle={emptyTitle}
        emptySubtitle={emptyDescription}
        emptyAction={emptyAction}
        autoHeight
        showToolbar={false}
      />
    </Box>
  );
});

ReportDataGrid.displayName = 'ReportDataGrid';

ReportDataGrid.propTypes = {
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
  isArchived: PropTypes.bool,
  rowCount: PropTypes.number,
  paginationModel: PropTypes.shape({
    page: PropTypes.number,
    pageSize: PropTypes.number,
  }),
  onPaginationModelChange: PropTypes.func,
  paginationMode: PropTypes.oneOf(['server', 'client']),
  emptyTitle: PropTypes.string,
  emptyDescription: PropTypes.string,
  emptyAction: PropTypes.node,
};

export default ReportDataGrid;
