/**
 * @module hooks/useLogout
 * @description Hook providing logout handler to terminate backend session and clear client state.
 */

import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import { useLogoutApiMutation } from '../redux/features/authApiSlice.js';
import { logout } from '../redux/features/authSlice.js';
import { LOGIN_ROUTE } from '../utils/constants.js';

/**
 * Custom React hook providing a memoized supervisor logout action handler.
 * Dispatches server-side session revocation, clears client Redux state,
 * and navigates to the login screen.
 *
 * @function useLogout
 * @returns {() => Promise<void>} Asynchronous logout trigger handler.
 */
export const useLogout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [logoutApi] = useLogoutApiMutation();

  return useCallback(async () => {
    try {
      await logoutApi().unwrap();
    } catch {
      // Ignore network errors during logout
    } finally {
      dispatch(logout());
      navigate(LOGIN_ROUTE || '/login', { replace: true });
    }
  }, [dispatch, navigate, logoutApi]);
};

export default useLogout;
