/**
 * @module routes/PublicRoute
 * @description Route guard redirecting authenticated supervisors away from public auth pages.
 * Displays smooth hydration spinner while verifying session, strictly preventing flicker of public views.
 */

import { Navigate, Outlet } from 'react-router';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectAuthLoading } from '../redux/features/authSlice.js';
import LoadingSpinner from '../components/reusable/LoadingSpinner.jsx';
import { ROUTES } from '../utils/constants.js';

/**
 * Route guard component redirecting authenticated supervisors away from public auth pages.
 * Ensures signed-in users cannot access landing, login, or registration screens.
 * Displays a full-screen loader while session check is in-flight to prevent UI flicker.
 *
 * @component PublicRoute
 * @returns {JSX.Element} Public route outlet, hydration spinner, or dashboard redirect.
 */
export const PublicRoute = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectAuthLoading);

  if (isLoading) {
    return <LoadingSpinner message="Checking session..." height="100vh" size="large" />;
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
};

export default PublicRoute;
