/**
 * @module layouts/AppShell
 * @description Protected application shell layout integrating sidebar drawer, app-bar, and outlet.
 */

import { useCallback, useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigation } from 'react-router';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import MuiAppbar from '../components/reusable/MuiAppbar.jsx';
import LoadingSpinner from '../components/reusable/LoadingSpinner.jsx';
import GlobalSearchModal from '../components/search/GlobalSearchModal.jsx';
import MuiSidebar from './MuiSidebar.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import AvatarMenu from './AvatarMenu.jsx';

/**
 * Primary authenticated application shell layout.
 * Manages responsive sidebar state, top app-bar integration, global search modal,
 * and navigation loading transitions.
 *
 * @component AppShell
 * @returns {JSX.Element} Rendered protected application shell.
 */
export const AppShell = () => {
  const location = useLocation();
  const navigation = useNavigation();
  const isChatRoute = location.pathname.startsWith('/chat');
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('operon_sidebar_mode') || 'full';
    } catch {
      return 'full';
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'mini' ? 'full' : 'mini';
      try {
        localStorage.setItem('operon_sidebar_mode', next);
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        height: 'var(--app-height, 100dvh)',
        minHeight: 'var(--app-height, 100dvh)',
        maxHeight: 'var(--app-height, 100dvh)',
        '@supports not (height: 100dvh)': {
          height: 'var(--app-height, 100vh)',
        },
        width: '100vw',
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      <MuiSidebar
        mode={mode}
        onToggleMode={toggleMode}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
      />
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <MuiAppbar
          variant="protected"
          onOpenSearch={openSearch}
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
          component="main"
          id="protected-outlet-container"
          sx={{
            flex: '1 1 0%',
            minHeight: 0,
            overflowY: isChatRoute ? 'hidden' : 'auto',
            overflowX: 'hidden',
            display: isChatRoute ? 'flex' : 'block',
            flexDirection: isChatRoute ? 'column' : undefined,
          }}
        >
          {navigation.state === 'loading' ? (
            <LoadingSpinner message="Navigating..." height="100%" />
          ) : (
            <Outlet />
          )}
        </Box>
      </Box>

      {/* Decoupled Command-Palette Global Search Modal */}
      <GlobalSearchModal open={searchOpen} onClose={closeSearch} />
    </Box>
  );
};

export default AppShell;
