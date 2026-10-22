/**
 * @module components/reusable/MuiAppbar
 * @description Top application bar supporting public and protected shell geometry variants.
 * Integrates global search trigger with Ctrl+K shortcut and xs: 375px iconification.
 */

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import SearchIcon from '@mui/icons-material/Search';
import PropTypes from 'prop-types';
import { APPBAR_MIN_HEIGHT } from '../../utils/constants.js';

/**
 * Standard application bar shell rendering leading branding/toggles, flexible spacer,
 * global search trigger, and right-aligned actions slot.
 *
 * @component MuiAppbar
 * @param {object} props - Component properties.
 * @param {'public'|'protected'} [props.variant='public'] - Geometry and positioning variant.
 * @param {import('react').ReactNode} [props.leading] - Leading content (branding, hamburger menu).
 * @param {import('react').ReactNode} [props.actions] - Right-aligned action controls or navigation links.
 * @param {Function} [props.onOpenSearch] - Handler opening the global search modal.
 * @param {object} [props.sx] - Material-UI sx style overrides.
 * @returns {JSX.Element} Configured AppBar element.
 */
export const MuiAppbar = ({ variant = 'public', leading, actions, onOpenSearch, sx }) => {
  const isPublic = variant === 'public';

  const searchAction = !isPublic && onOpenSearch ? (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {/* Desktop Search Trigger Bar (md+) */}
      <ButtonBase
        onClick={onOpenSearch}
        aria-label="Search workspace (Ctrl+K)"
        sx={{
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.6,
          bgcolor: 'action.hover',
          border: 1,
          borderColor: 'divider',
          borderRadius: '8px',
          color: 'text.secondary',
          minWidth: 220,
          textAlign: 'left',
          '&:hover': {
            bgcolor: 'action.selected',
            borderColor: 'primary.main',
            color: 'text.primary',
          },
        }}
      >
        <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="body2" sx={{ fontSize: '0.85rem', flexGrow: 1 }}>
          Search workspace...
        </Typography>
        <Chip
          label="Ctrl K"
          size="small"
          sx={{
            height: 18,
            fontSize: '0.65rem',
            fontWeight: 700,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
          }}
        />
      </ButtonBase>

      {/* Mobile Iconified Search Trigger (< md) */}
      <Tooltip title="Search workspace (Ctrl+K)">
        <IconButton
          size="small"
          aria-label="Search workspace"
          onClick={onOpenSearch}
          sx={{ display: { xs: 'flex', md: 'none' } }}
        >
          <SearchIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  ) : null;

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
        flexShrink: 0,
        ...sx,
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          px: { xs: 1.5, sm: 3 },
          minHeight: APPBAR_MIN_HEIGHT,
          gap: 1.5,
        }}
      >
        {leading}
        <Box sx={{ flexGrow: 1 }} />
        {searchAction}
        {actions}
      </Toolbar>
    </AppBar>
  );
};

MuiAppbar.propTypes = {
  variant: PropTypes.oneOf(['public', 'protected']),
  leading: PropTypes.node,
  actions: PropTypes.node,
  onOpenSearch: PropTypes.func,
  sx: PropTypes.object,
};

export default MuiAppbar;
