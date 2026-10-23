/**
 * @module routes/ProtectedRoute
 * @description Route guard ensuring only authenticated supervisors can access protected views.
 * Defensively verifies session cookies against the server before redirecting to login.
 */

import { Navigate, Outlet, useLocation } from 'react-router';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectAuthLoading } from '../redux/features/authSlice.js';
import { useGetProfileQuery } from '../redux/features/userSlice.js';
import LoadingSpinner from '../components/reusable/LoadingSpinner.jsx';
import { ROUTES } from '../utils/constants.js';

/**
 * Route guard component restricting child route access to authenticated supervisors.
 * Defensively checks server-side HttpOnly cookie session if client memory has not yet hydrated
 * (e.g. cold boot following Google SSO), preventing unwanted bounces to the login screen.
 *
 * @component ProtectedRoute
 * @returns {JSX.Element} Protected route outlet, verification spinner, or navigation redirect.
 */
export const ProtectedRoute = () => {
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectAuthLoading);

  // If Redux has not yet authenticated the user (e.g. following Google SSO redirect,
  // cold boot, or localStorage purge), verify whether an active cookie session exists on the server.
  const { isFetching } = useGetProfileQuery(undefined, {
    skip: isAuthenticated,
    refetchOnMountOrArgChange: false,
  });

  // Display smooth verification spinner while session is being verified with the backend
  if (isLoading || (!isAuthenticated && isFetching)) {
    return <LoadingSpinner message="Verifying session..." height="100vh" size="large" />;
  }

  // If user is definitively unauthenticated (or profile retrieval failed with 401), redirect to login
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
