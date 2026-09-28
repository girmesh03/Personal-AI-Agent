/**
 * @module routes/PublicRoute
 * @description Route guard redirecting authenticated supervisors away from public auth pages.
 */

import { Navigate, Outlet } from 'react-router';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../redux/features/authSlice.js';

/**
 * Route guard component redirecting authenticated supervisors away from public auth pages.
 * Ensures signed-in users cannot access login or registration screens.
 *
 * @component PublicRoute
 * @returns {JSX.Element} Public route outlet or dashboard redirect.
 */
export const PublicRoute = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default PublicRoute;
