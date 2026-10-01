/**
 * @module components/reusable/MuiAppbar
 * @description Top application bar supporting public and protected shell geometry variants.
 */

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import PropTypes from 'prop-types';
import { APPBAR_MIN_HEIGHT } from '../../utils/constants.js';

/**
 * Standard application bar shell rendering leading branding/toggles, flexible spacer,
 * optional global search placeholder, and right-aligned actions slot.
 *
 * @component MuiAppbar
 * @param {object} props - Component properties.
 * @param {'public'|'protected'} [props.variant='public'] - Geometry and positioning variant.
 * @param {import('react').ReactNode} [props.leading] - Leading content (branding, hamburger menu).
 * @param {import('react').ReactNode} [props.actions] - Right-aligned action controls or navigation links.
 * @param {object} [props.sx] - Material-UI sx style overrides.
 * @returns {JSX.Element} Configured AppBar element.
 */
export const MuiAppbar = ({ variant = 'public', leading, actions, sx }) => {
  const isPublic = variant === 'public';

  const searchAction = !isPublic ? (
    <Tooltip title="Global search (coming soon)">
      <IconButton
        size="small"
        aria-label="Global search"
        onClick={() => {}}
      >
        <SearchIcon fontSize="small" />
      </IconButton>
    </Tooltip>
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
  sx: PropTypes.object,
};

export default MuiAppbar;
