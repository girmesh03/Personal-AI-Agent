/**
 * @module App
 * @description Root application component mounted at path '/' by the router, handling session hydration.
 */

import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { useDispatch } from 'react-redux';
import { useGetProfileQuery } from './redux/features/userApiSlice.js';
import { setLoading } from './redux/features/authSlice.js';

/**
 * Root application component handling session initialization and rendering active route outlet.
 *
 * @component App
 * @returns {JSX.Element} React Router Outlet wrapper.
 */
export const App = () => {
  const dispatch = useDispatch();
  const { isLoading } = useGetProfileQuery();

  useEffect(() => {
    if (!isLoading) {
      dispatch(setLoading(false));
    }
  }, [isLoading, dispatch]);

  return <Outlet />;
};

export default App;
