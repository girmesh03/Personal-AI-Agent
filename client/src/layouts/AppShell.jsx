/**
 * @module layouts/AppShell
 * @description Protected application shell layout integrating sidebar drawer, app-bar, and outlet.
 */

import { useCallback, useState } from 'react';
import { Outlet, useNavigation } from 'react-router';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import MuiAppbar from '../components/reusable/MuiAppbar.jsx';
import LoadingSpinner from '../components/reusable/LoadingSpinner.jsx';
import MuiSidebar from './MuiSidebar.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import AvatarMenu from './AvatarMenu.jsx';

/**
 * Primary authenticated application shell layout.
 * Manages responsive sidebar state, top app-bar integration, and navigation loading transitions.
 *
 * @component AppShell
 * @returns {JSX.Element} Rendered protected application shell.
 */
export const AppShell = () => {
  const navigation = useNavigation();
  const [mode, setMode] = useState('mini');
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMode = useCallback(
    () => setMode((m) => (m === 'mini' ? 'full' : 'mini')),
    [],
  );
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <MuiSidebar
        mode={mode}
        onToggleMode={toggleMode}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <MuiAppbar
          variant="protected"
          leading={
            /* Hamburger only below md — the permanent sidebar md+
               carries the brand in its own header. */
            <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
              <IconButton
                size="small"
                aria-label="Open navigation"
                onClick={() => setMobileOpen(true)}
              >
                <MenuIcon fontSize="small" />
              </IconButton>
            </Box>
          }
          actions={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ThemeToggle />
              <AvatarMenu />
            </Box>
          }
        />
        <Box
          sx={{
            flexGrow: 1,
            overflowY: 'auto',
          }}
        >
          {navigation.state === 'loading' ? (
            <LoadingSpinner message="Navigating..." height="100%" />
          ) : (
            <Outlet />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default AppShell;
