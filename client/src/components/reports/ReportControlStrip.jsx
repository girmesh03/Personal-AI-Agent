/**
 * @module components/reports/ReportControlStrip
 * @description Standardized domain-specific control strip for the Operational Reports Directory.
 * Composes reusable MuiDataGridToolbar with Branch filter and Ethiopian Date Picker actions.
 * Enforces:
 * 1. Desktop (md+: >= 900px): Clean single/dual-row layout with wide flex search input.
 * 2. Tablet (sm: 600px - 899px): Predictable 2-row layout with 50/50 domain filters, zero collapsible accordions.
 * 3. Mobile (xs: < 600px): 100% fullwidth stacked inputs (Search, Branch, Ethiopian Date with zero right void, Fullwidth Tabs).
 * 4. Zero-lag uncontrolled search with explicit triggers via MuiSearchInput.
 */

import { useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme, alpha } from '@mui/material/styles';

import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';

import MuiDataGridToolbar from '../reusable/MuiDataGridToolbar.jsx';
import MuiDatePicker from '../reusable/MuiDatePicker.jsx';

/**
 * Control strip for filtering and switching views on the reports directory.
 *
 * @component ReportControlStrip
 * @param {object} props - Component properties.
 * @param {string} props.searchQuery - Active search query value.
 * @param {(query: string) => void} props.onSearchChange - Search update callback.
 * @param {string} [props.branchFilter=''] - Currently selected branch ID filter.
 * @param {(branchId: string) => void} props.onBranchChange - Branch filter change callback.
 * @param {Array<object>} [props.branches=[]] - Array of branch objects for dropdown options.
 * @param {string} [props.dateFilter=''] - Currently selected date filter (YYYY-MM-DD).
 * @param {(date: string) => void} props.onDateChange - Date filter change callback.
 * @param {'active'|'archived'} props.statusFilter - Active status filter tab.
 * @param {(status: 'active'|'archived') => void} props.onStatusFilterChange - Status tab change callback.
 * @param {'table'|'cards'|'grid'|'list'} props.viewMode - Current view mode.
 * @param {(mode: string) => void} props.onViewModeChange - View mode change callback.
 * @param {number} [props.activeCount=0] - Number of active reports.
 * @param {number} [props.archivedCount=0] - Number of archived reports.
 * @param {boolean} [props.disabled=false] - Whether controls are disabled.
 * @returns {import('react').JSX.Element} Rendered control strip element.
 */
export const ReportControlStrip = memo(({
  searchQuery = '',
  onSearchChange,
  branchFilter = '',
  onBranchChange,
  branches = [],
  dateFilter = '',
  onDateChange,
  statusFilter = 'active',
  onStatusFilterChange,
  viewMode = 'table',
  onViewModeChange,
  activeCount = 0,
  archivedCount = 0,
  disabled = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // vw < 600px

  // Compute if any secondary filters are active
  const hasActiveFilters = Boolean(
    (branchFilter && branchFilter !== '') ||
    (dateFilter && dateFilter !== '') ||
    statusFilter === 'archived'
  );

  // 1-Click Reset Filters Action
  const handleResetFilters = useCallback(() => {
    if (branchFilter) onBranchChange('');
    if (dateFilter) onDateChange('');
    if (statusFilter !== 'active') onStatusFilterChange('active');
  }, [branchFilter, dateFilter, statusFilter, onBranchChange, onDateChange, onStatusFilterChange]);

  // Branch selector element
  const branchSelector = (
    <FormControl
      size="small"
      sx={{
        width: { xs: '100%', sm: 180, md: 190 },
        flex: { sm: 1, md: 'none' },
        flexShrink: 0,
        bgcolor: 'background.paper',
        borderRadius: 1.5,
      }}
    >
      <Select
        value={branchFilter}
        onChange={(e) => onBranchChange(e.target.value)}
        displayEmpty
        disabled={disabled}
        MenuProps={{
          disableEnforceFocus: true,
          disableRestoreFocus: true,
        }}
        sx={{
          borderRadius: 1.5,
          fontSize: { xs: '0.8125rem', sm: '0.85rem' },
          '& .MuiSelect-select': { py: 0.8 },
        }}
        startAdornment={
          <InputAdornment position="start" sx={{ ml: 0.5 }}>
            <StoreOutlinedIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
          </InputAdornment>
        }
      >
        <MenuItem value="">
          <em>All Branches</em>
        </MenuItem>
        {branches.map((b) => (
          <MenuItem key={b._id} value={b._id} sx={{ fontSize: '0.85rem' }}>
            {b.name} ({b.code})
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  // Date filter element using standard MuiDatePicker with fullWidth
  const datePicker = (
    <Box
      sx={{
        width: { xs: '100%', sm: 170, md: 180 },
        flex: { sm: 1, md: 'none' },
        flexShrink: 0,
      }}
    >
      <MuiDatePicker
        value={dateFilter}
        onChange={(val) => onDateChange(val ? val.gregorian : '')}
        disabled={disabled}
        allowClear={true}
        fullWidth
        placeholder="Eth Date"
        startAdornment={
          <EventOutlinedIcon
            sx={{
              fontSize: 18,
              color: dateFilter ? 'primary.main' : 'text.secondary',
            }}
          />
        }
        sx={{
          height: 38,
          borderRadius: 1.5,
          fontSize: { xs: '0.8125rem', sm: '0.825rem' },
          fontWeight: dateFilter ? 700 : 500,
          bgcolor: dateFilter ? (t) => alpha(t.palette.primary.main, 0.08) : 'background.paper',
          borderColor: dateFilter ? 'primary.main' : 'divider',
          color: dateFilter ? 'primary.main' : 'text.primary',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
          },
        }}
      />
    </Box>
  );

  return (
    <MuiDataGridToolbar
      onSearch={onSearchChange}
      searchPlaceholder={isMobile ? 'Search reports...' : 'Search reports, findings, branches...'}
      searchValue={searchQuery}
      activeTab={statusFilter}
      onTabChange={onStatusFilterChange}
      activeCount={activeCount}
      archivedCount={archivedCount}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      disabled={disabled}
      customActions={
        <>
          {branchSelector}
          {datePicker}
        </>
      }
    />
  );
});

ReportControlStrip.displayName = 'ReportControlStrip';

ReportControlStrip.propTypes = {
  searchQuery: PropTypes.string,
  onSearchChange: PropTypes.func.isRequired,
  branchFilter: PropTypes.string,
  onBranchChange: PropTypes.func.isRequired,
  branches: PropTypes.arrayOf(PropTypes.object),
  dateFilter: PropTypes.string,
  onDateChange: PropTypes.func.isRequired,
  statusFilter: PropTypes.oneOf(['active', 'archived']).isRequired,
  onStatusFilterChange: PropTypes.func.isRequired,
  viewMode: PropTypes.oneOf(['table', 'cards', 'grid', 'list']).isRequired,
  onViewModeChange: PropTypes.func.isRequired,
  activeCount: PropTypes.number,
  archivedCount: PropTypes.number,
  disabled: PropTypes.bool,
};

export default ReportControlStrip;
