/**
 * @module components/reusable/MuiDataGridToolbar
 * @description Standardized custom Material-UI DataGrid toolbar integrating zero-lag search,
 * active/archived status tabs, add record action, and view switcher.
 * Responsive with mandatory xs: 375px iconification.
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
 * @param {Function} [props.onAdd] - Optional add new record callback.
 * @param {string} [props.addLabel='Add New'] - Text label for add button.
 * @param {'active'|'archived'} [props.activeTab] - Active status tab value.
 * @param {Function} [props.onTabChange] - Tab change callback.
 * @param {number} [props.activeCount] - Number of active records.
 * @param {number} [props.archivedCount] - Number of archived records.
 * @param {'table'|'grid'} [props.viewMode] - Current view mode.
 * @param {Function} [props.onViewModeChange] - View mode toggle callback.
 * @param {import('react').ReactNode} [props.customActions] - Custom action elements.
 * @returns {JSX.Element} Rendered Custom DataGrid Toolbar.
 */
export const MuiDataGridToolbar = memo(({
  onSearch,
  searchPlaceholder = 'Search records...',
  onAdd,
  addLabel = 'Add New',
  activeTab,
  onTabChange,
  activeCount,
  archivedCount,
  viewMode,
  onViewModeChange,
  customActions,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* Top Row: Search Input + Action Buttons */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        {/* Left: Zero-Lag Search Field */}
        {onSearch && (
          <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 260 }, maxWidth: { sm: 400 } }}>
            <MuiSearchInput
              onSearch={onSearch}
              placeholder={searchPlaceholder}
              size="small"
              fullWidth
            />
          </Box>
        )}

        {/* Right: Actions Deck (Iconified on xs: 375px) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
          {customActions}

          {/* View Mode Switcher */}
          {onViewModeChange && viewMode && (
            <Box
              sx={{
                display: 'flex',
                border: 1,
                borderColor: 'divider',
                borderRadius: '8px',
                p: 0.25,
              }}
            >
              <Tooltip title="Table View">
                <IconButton
                  size="small"
                  aria-label="Table View"
                  onClick={() => onViewModeChange('table')}
                  color={viewMode === 'table' ? 'primary' : 'default'}
                  sx={{ p: 0.75, borderRadius: '6px' }}
                >
                  <ViewListIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Card Grid View">
                <IconButton
                  size="small"
                  aria-label="Card Grid View"
                  onClick={() => onViewModeChange('grid')}
                  color={viewMode === 'grid' ? 'primary' : 'default'}
                  sx={{ p: 0.75, borderRadius: '6px' }}
                >
                  <ViewModuleIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* Add Record Button (Iconified on xs: 375px) */}
          {onAdd && (
            isMobile ? (
              <Tooltip title={addLabel}>
                <IconButton
                  color="primary"
                  aria-label={addLabel}
                  onClick={onAdd}
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                    width: 36,
                    height: 36,
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={onAdd}
                sx={{
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: '8px',
                  px: 2,
                  py: 0.75,
                  whiteSpace: 'nowrap',
                }}
              >
                {addLabel}
              </Button>
            )
          )}
        </Box>
      </Box>

      {/* Bottom Row: Optional Active vs Archived Tab Filter */}
      {onTabChange && activeTab !== undefined && (
        <Box sx={{ display: 'flex', alignItems: 'center', borderTop: 1, borderColor: 'divider', pt: 1 }}>
          <Tabs
            value={activeTab}
            onChange={(_e, val) => onTabChange(val)}
            sx={{
              minHeight: 36,
              '& .MuiTab-root': {
                minHeight: 36,
                py: 0.5,
                px: 1.5,
                fontWeight: 600,
                fontSize: '0.825rem',
                textTransform: 'none',
              },
            }}
          >
            <Tab
              value="active"
              label={activeCount !== undefined ? `Active (${activeCount})` : 'Active'}
            />
            <Tab
              value="archived"
              label={archivedCount !== undefined ? `Archived (${archivedCount})` : 'Archived'}
            />
          </Tabs>
        </Box>
      )}
    </Box>
  );
});

MuiDataGridToolbar.propTypes = {
  onSearch: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  onAdd: PropTypes.func,
  addLabel: PropTypes.string,
  activeTab: PropTypes.oneOf(['active', 'archived']),
  onTabChange: PropTypes.func,
  activeCount: PropTypes.number,
  archivedCount: PropTypes.number,
  viewMode: PropTypes.oneOf(['table', 'grid']),
  onViewModeChange: PropTypes.func,
  customActions: PropTypes.node,
};

export default MuiDataGridToolbar;
