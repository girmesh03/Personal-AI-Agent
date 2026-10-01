/**
 * @module components/common/RootHydrateFallback
 * @description Global fallback UI displayed during root route hydration.
 */

import LoadingSpinner from '../reusable/LoadingSpinner.jsx';

/**
 * Global fallback UI displayed during root route hydration.
 *
 * @component RootHydrateFallback
 * @returns {JSX.Element} Full-screen loading indicator.
 */
export const RootHydrateFallback = () => (
  <LoadingSpinner message="Initializing application..." height="100vh" size="large" />
);

export default RootHydrateFallback;
