/**
 * @module App
 * @description Root application layout component mounted at path '/' by the router.
 * Silently validates the persisted supervisor session in the background on cold mount.
 */

import { Outlet } from 'react-router';
import { useSelector } from 'react-redux';
import { useGetProfileQuery } from './redux/features/userSlice.js';
import { selectIsAuthenticated } from './redux/features/authSlice.js';

/**
 * Root application component rendering active route outlet and managing silent session validation.
 * Uses redux-persist for instant synchronous rehydration from localStorage while silently revalidating
 * with the server once on cold boot mount. Skips query for unauthenticated visitors to prevent 401 errors.
 *
 * @component App
 * @returns {JSX.Element} React Router Outlet wrapper.
 */
export const App = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // Silently revalidate active session with server once on mount (stale-while-revalidate).
  // Skips entirely for public visitors to prevent unauthenticated 401 errors and re-fetch loops.
  useGetProfileQuery(undefined, {
    skip: !isAuthenticated,
    refetchOnMountOrArgChange: false,
  });

  return <Outlet />;
};

export default App;
