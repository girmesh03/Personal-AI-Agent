/**
 * @module main
 * @description Client application root entry point and provider hierarchy.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router';
import { PersistGate } from 'redux-persist/integration/react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ErrorBoundary } from 'react-error-boundary';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/noto-sans-ethiopic/400.css';
import '@fontsource/noto-sans-ethiopic/700.css';

import { persistor, store } from './redux/app/store.js';
import { AppTheme } from './theme/AppTheme.jsx';
import GlobalErrorFallback from './components/common/GlobalErrorFallback.jsx';
import LoadingSpinner from './components/reusable/LoadingSpinner.jsx';
import { router } from './router.jsx';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={<LoadingSpinner message="Initializing session..." />} persistor={persistor}>
        <AppTheme>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <ErrorBoundary FallbackComponent={GlobalErrorFallback}>
              <ToastContainer
                position="top-right"
                autoClose={4000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="colored"
              />
              <RouterProvider router={router} />
            </ErrorBoundary>
          </LocalizationProvider>
        </AppTheme>
      </PersistGate>
    </Provider>
  </StrictMode>
);
