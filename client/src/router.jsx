/**
 * @module router
 * @description Flat React Router configuration with route guards, layout shells, and dynamic lazy code-splitting.
 * Strictly uses Component (never element) per architectural invariants.
 */

import { createBrowserRouter } from 'react-router';

import App from './App.jsx';
import AppShell from './layouts/AppShell.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import PublicRoute from './routes/PublicRoute.jsx';
import NotFound from './pages/NotFound.jsx';
import GlobalErrorFallback from './components/common/GlobalErrorFallback.jsx';
import RootHydrateFallback from './components/common/RootHydrateFallback.jsx';

/**
 * Application browser router configuration with nested layouts, guards, and lazy-loaded routes.
 * Strictly uses Component (never element) per architectural invariants.
 *
 * @constant
 * @type {import('react-router').Router}
 */
export const router = createBrowserRouter([
  {
    path: '/',
    Component: App,
    HydrateFallback: RootHydrateFallback,
    ErrorBoundary: GlobalErrorFallback,
    children: [
      // 1. PUBLIC ROUTES (Guarded by PublicRoute)
      {
        Component: PublicRoute,
        children: [
          {
            Component: PublicLayout,
            children: [
              { index: true, lazy: async () => ({ Component: (await import('./pages/Landing.jsx')).default }) },
              { path: 'login', lazy: async () => ({ Component: (await import('./pages/Login.jsx')).default }) },
              { path: 'register', lazy: async () => ({ Component: (await import('./pages/Register.jsx')).default }) },
            ],
          },
        ],
      },
      // 2. PROTECTED ROUTES (Guarded by ProtectedRoute)
      {
        Component: ProtectedRoute,
        children: [
          {
            Component: AppShell,
            children: [
              { path: 'dashboard', lazy: async () => ({ Component: (await import('./pages/Dashboard.jsx')).default }) },
              { path: 'chat', lazy: async () => ({ Component: (await import('./pages/Chat.jsx')).default }) },
              { path: 'chat/:chatId', lazy: async () => ({ Component: (await import('./pages/Chat.jsx')).default }) },
              { path: 'reports', lazy: async () => ({ Component: (await import('./pages/Reports.jsx')).default }) },
              { path: 'reports/:reportId/details', lazy: async () => ({ Component: (await import('./pages/ReportDetail.jsx')).default }) },
              { path: 'reports/:reportId/edit', lazy: async () => ({ Component: (await import('./pages/ReportEdit.jsx')).default }) },
              { path: 'branches', lazy: async () => ({ Component: (await import('./pages/Branches.jsx')).default }) },
              { path: 'branches/:branchId/details', lazy: async () => ({ Component: (await import('./pages/BranchDetail.jsx')).default }) },
              { path: 'profile', lazy: async () => ({ Component: (await import('./pages/Profile.jsx')).default }) },
            ],
          },
        ],
      },
      // 3. WILDCARD CATCH-ALL
      { path: '*', Component: NotFound },
    ],
  },
]);

export default router;
