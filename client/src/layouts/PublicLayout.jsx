/**
 * @module layouts/PublicLayout
 * @description Public layout shell providing public app-bar, authentication actions, and outlet container.
 */

import { Link as RouterLink, Outlet, useNavigation } from 'react-router';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PropTypes from 'prop-types';
import MuiAppbar from '../components/reusable/MuiAppbar.jsx';
import MuiButton from '../components/reusable/MuiButton.jsx';
import LoadingSpinner from '../components/reusable/LoadingSpinner.jsx';
import Logo from './Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { selectAuthStatus } from '../redux/features/authSlice.js';
import useLogout from '../hooks/useLogout.js';
import {
  AUTH_STATUSES,
  LOGIN_ROUTE,
  LOGIN_REDIRECT_ROUTE,
  LANDING_ROUTE,
} from '../utils/constants.js';

/**
 * Public layout wrapper wrapping unauthenticated routes (Landing, Login, Register).
 * Provides the fixed public AppBar with authentication shortcuts and theme toggles.
 *
 * @component PublicLayout
 * @param {object} props - Component properties.
 * @param {import('react').ReactNode} [props.children] - Optional custom child content overriding default outlet.
 * @returns {JSX.Element} Rendered public layout shell.
 */
export const PublicLayout = ({ children }) => {
  const navigation = useNavigation();
  const status = useSelector(selectAuthStatus);
  const logout = useLogout();
  const isAuthenticated = status === AUTH_STATUSES.AUTHENTICATED;

  const actions = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <ThemeToggle />
      {isAuthenticated ? (
        <Tooltip title="Logout">
          <IconButton
            size="small"
            aria-label="Logout"
            onClick={() => void logout()}
            sx={{ color: 'text.secondary' }}
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <>
          <Button
            component={RouterLink}
            to={LOGIN_ROUTE}
            size="small"
            startIcon={<LoginIcon fontSize="small" />}
            sx={{ display: { xs: 'none', sm: 'inline-flex' }, flexShrink: 0 }}
          >
            Log in
          </Button>
          <IconButton
            component={RouterLink}
            to={LOGIN_ROUTE}
            size="small"
            aria-label="Log in"
            sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
          >
            <LoginIcon fontSize="small" />
          </IconButton>
          <MuiButton
            component={RouterLink}
            to="/register"
            variant="contained"
            startIcon={<PersonAddIcon fontSize="small" />}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Sign up
          </MuiButton>
          <IconButton
            component={RouterLink}
            to="/register"
            size="small"
            aria-label="Sign up"
            sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
          >
            <PersonAddIcon fontSize="small" />
          </IconButton>
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <MuiAppbar
        variant="public"
        leading={
          <Logo
            showName
            to={isAuthenticated ? LOGIN_REDIRECT_ROUTE : LANDING_ROUTE}
          />
        }
        actions={actions}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
        }}
      >
        {navigation.state === 'loading' ? (
          <LoadingSpinner message="Loading..." height="100%" />
        ) : (
          children ?? <Outlet />
        )}
      </Box>
    </Box>
  );
};

PublicLayout.propTypes = {
  children: PropTypes.node,
};

export default PublicLayout;
