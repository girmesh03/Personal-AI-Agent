/**
 * @module App
 * @description Root application layout component mounted at path '/' by the router.
 * Silently validates the persisted supervisor session in the background on cold mount,
 * and handles clean URL query parameter sanitization following Google SSO callbacks.
 */

import { useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router';
import { useSelector } from 'react-redux';
import { useGetProfileQuery } from './redux/features/userSlice.js';
import { selectIsAuthenticated } from './redux/features/authSlice.js';
import useViewportHeight from './hooks/useViewportHeight.js';

/**
 * Root application component rendering active route outlet and managing silent session validation.
 * Uses redux-persist for instant synchronous rehydration from localStorage while silently revalidating
 * with the server once on cold boot mount. Also detects SSO callback query params (?auth=sso)
 * to force session hydration before cleaning the URL bar.
 *
 * @component App
 * @returns {JSX.Element} React Router Outlet wrapper.
 */
export const App = () => {
  useViewportHeight();
  const [searchParams] = useSearchParams();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSsoAuth = searchParams.get('auth') === 'sso';

  // Validate active session: runs if user is authenticated OR returning from an SSO flow
  const { isSuccess } = useGetProfileQuery(undefined, {
    skip: !isAuthenticated && !isSsoAuth,
    refetchOnMountOrArgChange: false,
  });

  // Clean URL search parameter once SSO profile hydration succeeds
  useEffect(() => {
    if (isSsoAuth && (isAuthenticated || isSuccess)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('auth');
      const cleanSearch = nextParams.toString();
      const newUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, [isSsoAuth, isAuthenticated, isSuccess, searchParams]);

  return <Outlet />;
};

export default App;
