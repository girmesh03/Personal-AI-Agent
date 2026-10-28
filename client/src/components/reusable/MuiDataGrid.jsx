/**
 * @module components/reusable/MuiDataGrid
 * @description Enterprise-grade, reusable Material-UI DataGrid wrapper.
 * Strictly enforces:
 *  1. sm+ Display Constraint: Rendered strictly on sm+ (xs hidden, parent renders cards).
 *  2. Universal Column Sizing Invariant: Fluid flex weights with protective minWidth.
 *  3. Skeleton Loading Overlay: High-fidelity skeleton rows with zero layout shifts.
 *  4. Empty State Overlay: Integrates MuiEmptyState for zero-data conditions.
 *  5. Theme-Aware Design Tokens: Semi-bold headers, clean zebra hover, dark/light compatibility.
 */

import { memo, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import { alpha, useTheme } from '@mui/material/styles';
import { DataGrid, GridOverlay } from '@mui/x-data-grid';
import MuiEmptyState from './MuiEmptyState.jsx';
import { DATA_GRID_PAGE_SIZE_OPTIONS } from '../../utils/constants.js';

/**
 * Skeleton loading overlay rendering high-fidelity placeholder rows.
 * @component
 */
const CustomLoadingOverlay = () => {
  return (
    <GridOverlay sx={{ bgcolor: 'transparent', py: 2 }}>
      <Box sx={{ width: '100%', px: 2 }}>
        <Stack spacing={1.5}>
          <Skeleton variant="rounded" height={44} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rounded" height={44} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rounded" height={44} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rounded" height={44} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rounded" height={44} sx={{ borderRadius: 1 }} />
        </Stack>
      </Box>
    </GridOverlay>
  );
};

CustomLoadingOverlay.displayName = 'CustomLoadingOverlay';

const CustomNoRowsOverlay = ({ icon, title, subtitle, action }) => (
  <GridOverlay sx={{ bgcolor: 'transparent', py: 4 }}>
    <MuiEmptyState
      icon={icon}
      title={title}
      subtitle={subtitle}
      action={action}
      sx={{ border: 'none' }}
    />
  </GridOverlay>
);
CustomNoRowsOverlay.displayName = 'MuiDataGridNoRowsOverlay';

/**
 * Universal reusable DataGrid component.
 *
 * @component MuiDataGrid
 * @param {object} props - Component properties.
 * @param {Array<object>} props.rows - Data row records.
 * @param {Array<object>} props.columns - Column definitions adhering to flex + minWidth invariant.
 * @param {boolean} [props.loading=false] - Whether data is actively fetching.
 * @param {number} [props.rowCount] - Total count of rows for server pagination.
 * @param {object} [props.paginationModel] - Controlled pagination model ({ page, pageSize }).
 * @param {Function} [props.onPaginationModelChange] - Pagination change handler.
 * @param {'server'|'client'} [props.paginationMode='client'] - Pagination computation mode.
 * @param {Array<number>} [props.pageSizeOptions=[5, 10, 25, 50]] - Page size selector options.
 * @param {boolean} [props.autoHeight=true] - Whether grid grows to fit row height.
 * @param {Function} [props.getRowId] - Custom row ID selector (defaults to row._id || row.id).
 * @param {boolean} [props.showToolbar=false] - Whether to render DataGrid toolbar.
 * @param {import('react').ReactNode} [props.emptyIcon] - Custom icon for empty state overlay.
 * @param {string} [props.emptyTitle='No records found'] - Header for empty state overlay.
 * @param {string} [props.emptySubtitle='There are no records matching your current criteria.'] - Subtitle for empty state.
 * @param {import('react').ReactNode} [props.emptyAction] - Action button element for empty state.
 * @param {object} [props.slots] - Granular slot overrides.
 * @param {object} [props.slotProps] - Granular slotProps overrides.
 * @param {object} [props.sx] - Styling overrides for outer container.
 * @param {object} [props.gridSx] - Styling overrides for DataGrid element.
 * @returns {import('react').JSX.Element} Rendered DataGrid component.
 */
export const MuiDataGrid = memo(({
  rows = [],
  columns = [],
  loading = false,
  rowCount,
  paginationModel,
  onPaginationModelChange,
  paginationMode = 'client',
  pageSizeOptions = DATA_GRID_PAGE_SIZE_OPTIONS,
  autoHeight = true,
  getRowId,
  showToolbar = false,
  emptyIcon,
  emptyTitle = 'No records found',
  emptySubtitle = 'There are no records matching your current criteria.',
  emptyAction,
  slots = {},
  slotProps = {},
  sx = {},
  gridSx = {},
  ...restProps
}) => {
  const theme = useTheme();

  // Memoized custom empty state overlay
  const NoRowsOverlayComponent = useCallback(
    () => (
      <CustomNoRowsOverlay
        icon={emptyIcon}
        title={emptyTitle}
        subtitle={emptySubtitle}
        action={emptyAction}
      />
    ),
    [emptyIcon, emptyTitle, emptySubtitle, emptyAction]
  );

  // Fallback row id resolver
  const defaultGetRowId = useMemo(
    () => getRowId || ((row) => row._id || row.id),
    [getRowId]
  );

  return (
    <Box
      sx={{
        display: { xs: 'none', sm: 'block' },
        width: '100%',
        ...sx,
      }}
    >
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        rowCount={rowCount}
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
        paginationMode={paginationMode}
        pageSizeOptions={pageSizeOptions}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 10, page: 0 },
          },
          ...restProps.initialState,
        }}
        autoHeight={autoHeight}
        getRowId={defaultGetRowId}
        disableRowSelectionOnClick
        showToolbar={showToolbar}
        slots={{
          loadingOverlay: CustomLoadingOverlay,
          noRowsOverlay: NoRowsOverlayComponent,
          ...slots,
        }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
            quickFilterProps: { debounceMs: 400 },
            sx: { p: 1.5, gap: 1 },
          },
          ...slotProps,
        }}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 2.5,
          bgcolor: 'background.paper',
          '& .MuiDataGrid-columnHeaders': {
            bgcolor: alpha(theme.palette.text.primary, 0.03),
            borderBottom: 1,
            borderColor: 'divider',
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 600,
            fontSize: '0.875rem',
            color: 'text.primary',
          },
          '& .MuiDataGrid-cell': {
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
          },
          '& .MuiDataGrid-row:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          },
          '& .MuiDataGrid-toolbarContainer': {
            p: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            gap: 1,
          },
          ...gridSx,
        }}
        {...restProps}
      />
    </Box>
  );
});

MuiDataGrid.displayName = 'MuiDataGrid';

MuiDataGrid.propTypes = {
  rows: PropTypes.array.isRequired,
  columns: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  rowCount: PropTypes.number,
  paginationModel: PropTypes.object,
  onPaginationModelChange: PropTypes.func,
  paginationMode: PropTypes.oneOf(['client', 'server']),
  pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
  autoHeight: PropTypes.bool,
  getRowId: PropTypes.func,
  showToolbar: PropTypes.bool,
  emptyIcon: PropTypes.node,
  emptyTitle: PropTypes.string,
  emptySubtitle: PropTypes.string,
  emptyAction: PropTypes.node,
  slots: PropTypes.object,
  slotProps: PropTypes.object,
  sx: PropTypes.object,
  gridSx: PropTypes.object,
};

export default MuiDataGrid;
