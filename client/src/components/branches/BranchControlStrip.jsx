/**
 * @module components/branches/BranchControlStrip
 * @description Single-row responsive control strip for the Branches directory page (Row 2).
 * Integrates:
 * 1. Zero-lag keystroke search decoupled via React 19 useTransition (Invariant 43).
 * 2. Active vs Archived segmented toggle with dynamic counts.
 * 3. Grid vs List view switcher (DataGrid vs Cards) with responsive collapse and xs hiding.
 * Strictly maintains a single non-wrapping row across all standard MUI breakpoints (xs, sm, md, lg, xl).
 */

import { useState, useRef, useEffect, useCallback, useTransition, memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';

/**
 * Control strip for filtering and switching views on the branches directory.
 *
 * @component BranchControlStrip
 * @param {object} props - Component properties.
 * @param {string} props.searchQuery - Active search query value.
 * @param {(query: string) => void} props.onSearchChange - Search update callback.
 * @param {'active'|'archived'} props.statusFilter - Active status filter tab.
 * @param {(status: 'active'|'archived') => void} props.onStatusFilterChange - Status tab change callback.
 * @param {'grid'|'list'} props.viewMode - Current view mode.
 * @param {(mode: 'grid'|'list') => void} props.onViewModeChange - View mode change callback.
 * @param {number} [props.activeCount=0] - Number of active branches.
 * @param {number} [props.archivedCount=0] - Number of archived branches.
 * @param {boolean} [props.disabled=false] - Whether controls are disabled.
 * @returns {import('react').JSX.Element} Rendered control strip element.
 */
export const BranchControlStrip = memo(({
  searchQuery = '',
  onSearchChange,
  statusFilter = 'active',
  onStatusFilterChange,
  viewMode = 'grid',
  onViewModeChange,
  activeCount = 0,
  archivedCount = 0,
  disabled = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const inputRef = useRef(null);
  const [, startTransition] = useTransition();
  const [hasText, setHasText] = useState(Boolean(searchQuery));

  // Synchronize internal input value if external query changes
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== searchQuery) {
      inputRef.current.value = searchQuery || '';
      setHasText(Boolean(searchQuery));
    }
  }, [searchQuery]);

  // Handle native typing at hardware speed with zero React overhead
  const handleInput = useCallback((e) => {
    const nextVal = e.target.value;
    setHasText(Boolean(nextVal));
    startTransition(() => {
      onSearchChange(nextVal);
    });
  }, [onSearchChange]);

  // Clear search query immediately
  const handleClear = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
    setHasText(false);
    onSearchChange('');
  }, [onSearchChange]);

  // Handle status toggle change
  const handleStatusChange = useCallback((_, newStatus) => {
    if (newStatus !== null && newStatus !== statusFilter) {
      onStatusFilterChange(newStatus);
    }
  }, [statusFilter, onStatusFilterChange]);

  // Handle view layout switch
  const handleViewChange = useCallback((_, newView) => {
    if (newView !== null && newView !== viewMode) {
      onViewModeChange(newView);
    }
  }, [viewMode, onViewModeChange]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: { xs: 1, sm: 1.5, md: 2 },
        width: '100%',
        flexWrap: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {/* 1. Zero-lag Search Input */}
      <TextField
        inputRef={inputRef}
        defaultValue={searchQuery}
        onInput={handleInput}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            handleClear();
          }
        }}
        placeholder={
          isMobile
            ? 'Search...'
            : 'Search branches bilingually (e.g. Bole, ቦሌ, BOLE-01)...'
        }
        size="small"
        disabled={disabled}
        sx={{
          flex: { xs: 1, lg: 'none' },
          width: { lg: 380, xl: 420 },
          minWidth: 0,
          '& .MuiInputBase-root': {
            borderRadius: 1.5,
            bgcolor: 'background.paper',
          },
          '& .MuiInputBase-input': {
            py: 0.8,
            fontSize: { xs: '0.8125rem', sm: '0.875rem' },
          },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              </InputAdornment>
            ),
            endAdornment: hasText ? (
              <InputAdornment position="end">
                <Tooltip title="Clear search">
                  <IconButton
                    size="small"
                    aria-label="Clear search input"
                    onClick={handleClear}
                    edge="end"
                    sx={{ p: 0.5 }}
                  >
                    <ClearIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ) : null,
          },
        }}
      />

      {/* Trailing Controls Cluster (Always on same horizontal row) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, sm: 1.5 },
          flexShrink: 0,
        }}
      >
        {/* 2. Active vs Archived Segmented Toggle */}
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={handleStatusChange}
          size="small"
          aria-label="Filter operational status"
          sx={{
            flexShrink: 0,
            bgcolor: 'background.paper',
            borderRadius: 1.5,
            '& .MuiToggleButton-root': {
              px: { xs: 1, sm: 1.5, md: 2 },
              py: 0.6,
              fontSize: { xs: '0.75rem', sm: '0.8125rem' },
              fontWeight: 500,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              border: (t) => `1px solid ${t.palette.divider}`,
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
              },
            },
          }}
        >
          <ToggleButton value="active" aria-label="Active branches">
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Active ({activeCount})
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              {activeCount} Act
            </Box>
          </ToggleButton>
          <ToggleButton value="archived" aria-label="Archived branches">
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Archived ({archivedCount})
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              {archivedCount} Arc
            </Box>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* 3. Grid vs List View Switcher (Hidden on xs, icon-only on sm/md, icon+text on lg+) */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewChange}
          size="small"
          aria-label="Toggle view display mode"
          sx={{
            display: { xs: 'none', sm: 'inline-flex' },
            flexShrink: 0,
            bgcolor: 'background.paper',
            borderRadius: 1.5,
            '& .MuiToggleButton-root': {
              px: { sm: 1, md: 1.5 },
              py: 0.6,
              fontSize: '0.8125rem',
              fontWeight: 500,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              border: (t) => `1px solid ${t.palette.divider}`,
              '&.Mui-selected': {
                bgcolor: 'action.selected',
                color: 'primary.main',
                fontWeight: 600,
              },
            },
          }}
        >
          <ToggleButton value="grid" aria-label="DataGrid view">
            <Tooltip title="DataGrid view">
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <GridViewOutlinedIcon sx={{ fontSize: 18 }} />
                <Box component="span" sx={{ display: { sm: 'none', lg: 'inline' } }}>
                  Grid
                </Box>
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="list" aria-label="Card list view">
            <Tooltip title="Card list view">
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <ViewListOutlinedIcon sx={{ fontSize: 18 }} />
                <Box component="span" sx={{ display: { sm: 'none', lg: 'inline' } }}>
                  List
                </Box>
              </Box>
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
});

BranchControlStrip.displayName = 'BranchControlStrip';

BranchControlStrip.propTypes = {
  searchQuery: PropTypes.string,
  onSearchChange: PropTypes.func.isRequired,
  statusFilter: PropTypes.oneOf(['active', 'archived']),
  onStatusFilterChange: PropTypes.func.isRequired,
  viewMode: PropTypes.oneOf(['grid', 'list']),
  onViewModeChange: PropTypes.func.isRequired,
  activeCount: PropTypes.number,
  archivedCount: PropTypes.number,
  disabled: PropTypes.bool,
};

export default BranchControlStrip;
