/**
 * @module components/reusable/MuiDataGridToolbar
 * @description Standardized custom Material-UI DataGrid toolbar integrating zero-lag search,
 * domain-specific custom action filters, active/archived status tabs, add record action,
 * and view mode switcher. Responsive with mandatory xs: 375px fullwidth ergonomics.
 */

import { memo } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import PropTypes from 'prop-types';
import MuiSearchInput from './MuiSearchInput.jsx';

/**
 * Standardized custom DataGrid toolbar component.
 *
 * @component MuiDataGridToolbar
 * @param {object} props - Component properties.
 * @param {Function} [props.onSearch] - Search callback invoked on Enter / Search click / Clear.
 * @param {string} [props.searchPlaceholder='Search records...'] - Search field placeholder.
 * @param {string} [props.searchValue=''] - Controlled / initial search query value.
 * @param {Function} [props.onAdd] - Optional add new record callback.
 * @param {string} [props.addLabel='Add New'] - Text label for add button.
 * @param {'active'|'archived'} [props.activeTab] - Active status tab value.
 * @param {Function} [props.onTabChange] - Tab change callback.
 * @param {number} [props.activeCount] - Number of active records.
 * @param {number} [props.archivedCount] - Number of archived records.
 * @param {'table'|'cards'|'grid'|'list'} [props.viewMode] - Current view mode.
 * @param {Function} [props.onViewModeChange] - View mode toggle callback.
 * @param {import('react').ReactNode} [props.customActions] - Custom filter / action elements.
 * @param {boolean} [props.hasActiveFilters=false] - Whether secondary filters are currently applied.
 * @param {Function} [props.onResetFilters] - 1-click filter reset callback.
 * @param {string} [props.resetFiltersLabel='Reset Filters'] - Text label for reset button.
 * @param {boolean} [props.disabled=false] - Whether controls are disabled during loading.
 * @param {object} [props.sx={}] - Container sx overrides.
 * @returns {JSX.Element} Rendered Custom DataGrid Toolbar.
 */
export const MuiDataGridToolbar = memo(({
  onSearch,
  searchPlaceholder = 'Search records...',
  searchValue = '',
  onAdd,
  addLabel = 'Add New',
  activeTab,
  onTabChange,
  activeCount,
  archivedCount,
  viewMode,
  onViewModeChange,
  customActions,
  hasActiveFilters = false,
  onResetFilters,
  resetFiltersLabel = 'Reset Filters',
  disabled = false,
  sx = {},
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // xs: < 600px

  const isTableView = viewMode === 'table' || viewMode === 'grid';
  const isCardView = viewMode === 'cards' || viewMode === 'list';

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 1.25, sm: 1.5 },
        p: { xs: 1.25, sm: 1.5 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        boxShadow: (t) =>
          t.palette.mode === 'dark'
            ? '0 1px 3px rgba(0, 0, 0, 0.3)'
            : '0 1px 3px rgba(0, 0, 0, 0.05)',
        ...sx,
      }}
    >
      {/* Top Controls Row: Search Input + Action Elements (customActions, viewSwitcher, onAdd) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          gap: { xs: 1.25, sm: 1.5 },
          width: '100%',
        }}
      >
        {/* Zero-Lag Search Field: full width on mobile/tablet, flex: 1 on desktop */}
        {onSearch && (
          <Box
            sx={{
              width: { xs: '100%', md: 'auto' },
              flex: { md: 1 },
              minWidth: { md: 240, lg: 320 },
            }}
          >
            <MuiSearchInput
              onSearch={onSearch}
              placeholder={searchPlaceholder}
              initialValue={searchValue}
              size="small"
              fullWidth
              disabled={disabled}
            />
          </Box>
        )}

        {/* Action Controls Deck */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: { xs: 'stretch', sm: 'flex-end' },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.25,
            width: { xs: '100%', md: 'auto' },
            flexShrink: 0,
          }}
        >
          {/* Custom Domain Actions (Branch Filter, Date Picker) */}
          {customActions && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: 'center',
                gap: 1.25,
                width: { xs: '100%', sm: 'auto' },
                flex: { sm: 1, md: 'none' },
              }}
            >
              {customActions}
            </Box>
          )}

          {/* View Mode Switcher (Visible on Tablet and Desktop, strictly hidden on mobile xs) */}
          {onViewModeChange && viewMode && (
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                p: 0.25,
                bgcolor: 'background.paper',
                flexShrink: 0,
                height: 38,
                boxSizing: 'border-box',
              }}
            >
              <Tooltip title="DataGrid Table View">
                <IconButton
                  size="small"
                  aria-label="Table View"
                  onClick={() => onViewModeChange('table')}
                  color={isTableView ? 'primary' : 'default'}
                  disabled={disabled}
                  sx={{
                    p: 0.75,
                    borderRadius: 1,
                    bgcolor: isTableView ? 'action.selected' : 'transparent',
                  }}
                >
                  <ViewListIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Card Grid View">
                <IconButton
                  size="small"
                  aria-label="Card Grid View"
                  onClick={() => onViewModeChange('cards')}
                  color={isCardView ? 'primary' : 'default'}
                  disabled={disabled}
                  sx={{
                    p: 0.75,
                    borderRadius: 1,
                    bgcolor: isCardView ? 'action.selected' : 'transparent',
                  }}
                >
                  <ViewModuleIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* Add Record Action Button */}
          {onAdd && (
            <>
              {/* Tablet & Desktop: Outlined/Contained Button */}
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={onAdd}
                  disabled={disabled}
                  sx={{
                    fontWeight: 600,
                    textTransform: 'none',
                    borderRadius: 1.5,
                    px: 2,
                    height: 38,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {addLabel}
                </Button>
              </Box>
              {/* Mobile: 100% full width button */}
              <Box sx={{ display: { xs: 'block', sm: 'none' }, width: '100%' }}>
                <Button
                  variant="contained"
                  size="small"
                  fullWidth
                  startIcon={<AddIcon />}
                  onClick={onAdd}
                  disabled={disabled}
                  sx={{
                    fontWeight: 600,
                    textTransform: 'none',
                    borderRadius: 1.5,
                    height: 38,
                  }}
                >
                  {addLabel}
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* Mobile xs Reset Filters Row: Sits cleanly above fullwidth tabs */}
      {hasActiveFilters && onResetFilters && (
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, justifyContent: 'flex-end', width: '100%' }}>
          <Button
            size="small"
            variant="text"
            color="inherit"
            onClick={onResetFilters}
            disabled={disabled}
            startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              color: 'text.secondary',
              '&:hover': { color: 'primary.main' },
            }}
          >
            {resetFiltersLabel}
          </Button>
        </Box>
      )}

      {/* Bottom Row: Active vs Archived Tabs + Reset Filters (Tablet & Desktop) */}
      {onTabChange && activeTab !== undefined && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: 1,
            borderColor: 'divider',
            pt: 1,
            width: '100%',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_e, val) => onTabChange(val)}
            variant={isMobile ? 'fullWidth' : 'standard'}
            sx={{
              minHeight: 36,
              width: { xs: '100%', sm: 'auto' },
              '& .MuiTab-root': {
                minHeight: 36,
                py: 0.5,
                px: { xs: 1.5, sm: 2 },
                fontWeight: 600,
                fontSize: { xs: '0.8rem', sm: '0.85rem' },
                textTransform: 'none',
              },
            }}
          >
            <Tab
              value="active"
              label={activeCount !== undefined ? `Active (${activeCount})` : 'Active'}
              disabled={disabled}
            />
            <Tab
              value="archived"
              label={archivedCount !== undefined ? `Archived (${archivedCount})` : 'Archived'}
              disabled={disabled}
            />
          </Tabs>

          {/* Reset Filters on Tablet & Desktop */}
          {hasActiveFilters && onResetFilters && (
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Button
                size="small"
                variant="text"
                color="inherit"
                onClick={onResetFilters}
                disabled={disabled}
                startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                {resetFiltersLabel}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
});

MuiDataGridToolbar.displayName = 'MuiDataGridToolbar';

MuiDataGridToolbar.propTypes = {
  onSearch: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  searchValue: PropTypes.string,
  onAdd: PropTypes.func,
  addLabel: PropTypes.string,
  activeTab: PropTypes.oneOf(['active', 'archived']),
  onTabChange: PropTypes.func,
  activeCount: PropTypes.number,
  archivedCount: PropTypes.number,
  viewMode: PropTypes.oneOf(['table', 'cards', 'grid', 'list']),
  onViewModeChange: PropTypes.func,
  customActions: PropTypes.node,
  hasActiveFilters: PropTypes.bool,
  onResetFilters: PropTypes.func,
  resetFiltersLabel: PropTypes.string,
  disabled: PropTypes.bool,
  sx: PropTypes.object,
};

export default MuiDataGridToolbar;
