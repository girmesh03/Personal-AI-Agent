/**
 * @module layouts/Logo
 * @description Branding logo component linking to landing or dashboard.
 */

import { Link as RouterLink } from 'react-router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PropTypes from 'prop-types';
import { APP_NAME, DASHBOARD_ROUTE } from '../utils/constants.js';

/**
 * Standard product mark and title header motif linking to dashboard or home.
 *
 * @component Logo
 * @param {object} props - Component properties.
 * @param {boolean} [props.showName=true] - Render the application title beside the mark.
 * @param {string} [props.to=DASHBOARD_ROUTE] - Router destination path.
 * @param {object} [props.sx] - Material-UI sx style overrides.
 * @returns {JSX.Element} Rendered branding link element.
 */
export const Logo = ({ showName = true, to = DASHBOARD_ROUTE, sx }) => (
  <Box
    component={RouterLink}
    to={to}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 1.25,
      textDecoration: 'none',
      color: 'inherit',
      minWidth: 0,
      ...sx,
    }}
  >
    <Box
      aria-hidden
      sx={{
        width: 26,
        height: 26,
        flexShrink: 0,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        display: 'grid',
        gridTemplateRows: 'repeat(3, 1fr)',
        alignItems: 'center',
        px: 0.5,
        '& span': {
          display: 'block',
          height: 0,
          borderTop: 1,
          borderColor: 'text.disabled',
        },
        '& span:last-of-type': {
          borderTopWidth: 2,
          borderColor: 'primary.main',
          width: '62%',
        },
      }}
    >
      <span />
      <span />
      <span />
    </Box>
    {showName ? (
      <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
        {APP_NAME}
      </Typography>
    ) : null}
  </Box>
);

Logo.propTypes = {
  showName: PropTypes.bool,
  to: PropTypes.string,
  sx: PropTypes.object,
};

export default Logo;
