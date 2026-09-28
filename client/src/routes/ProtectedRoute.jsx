/**
 * @module routes/ProtectedRoute
 * @description Route guard ensuring only authenticated supervisors can access protected views.
 */

import { Navigate, Outlet, useLocation } from 'react-router';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectAuthLoading } from '../redux/features/authSlice.js';
import LoadingSpinner from '../components/reusable/LoadingSpinner.jsx';

/**
 * Route guard component restricting child route access to authenticated supervisors.
 * Redirects unauthenticated requests to login while preserving target route in location state.
 *
 * @component ProtectedRoute
 * @returns {JSX.Element} Protected route outlet or navigation redirect.
 */
export const ProtectedRoute = () => {
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectAuthLoading);

  if (isLoading) {
    return <LoadingSpinner message="Verifying session..." height="100vh" size="large" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
