/**
 * @module components/common/GlobalErrorFallback
 * @description Global fallback screen rendered by react-error-boundary when an unhandled runtime error occurs.
 * Provides empathetic recovery guidance, boundary retry, full reload, and return to safety navigation.
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';
import ReplayIcon from '@mui/icons-material/Replay';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import PropTypes from 'prop-types';
import MuiButton from '../reusable/MuiButton.jsx';

/**
 * Global fallback screen rendered by react-error-boundary when an unhandled runtime exception occurs.
 *
 * @component GlobalErrorFallback
 * @param {object} props - Component properties.
 * @param {Error} [props.error] - Runtime error caught by boundary.
 * @param {() => void} [props.resetErrorBoundary] - Error boundary reset callback.
 * @returns {JSX.Element} Rendered fallback error presentation.
 */
export const GlobalErrorFallback = ({ error, resetErrorBoundary }) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const handleRetry = () => {
    if (typeof resetErrorBoundary === 'function') {
      resetErrorBoundary();
    } else {
      window.location.reload();
    }
  };

  const handleFullReload = () => {
    window.location.reload();
  };

  const handleNavigateHome = () => {
    window.location.href = '/';
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 },
        bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 520,
          width: '100%',
          p: { xs: 3, sm: 5 },
          textAlign: 'center',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: 'error.light',
            color: 'error.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1,
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 36 }} />
        </Box>

        <Typography variant="h5" fontWeight={700} color="text.primary">
          Something went wrong
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, lineHeight: 1.6 }}>
          We encountered an unexpected problem while displaying this view.
          Please try again, or reload the page to continue your operational session.
        </Typography>

        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            flexWrap: 'wrap',
            justifyContent: 'center',
            width: '100%',
            mt: 1,
          }}
        >
          {resetErrorBoundary && (
            <MuiButton
              size="small"
              variant="contained"
              color="primary"
              startIcon={<ReplayIcon />}
              onClick={handleRetry}
            >
              Try Again
            </MuiButton>
          )}

          <MuiButton
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={handleFullReload}
          >
            Reload Page
          </MuiButton>

          <MuiButton
            size="small"
            variant="text"
            startIcon={<HomeIcon />}
            onClick={handleNavigateHome}
          >
            Return to Home
          </MuiButton>
        </Box>

        {error?.message && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <MuiButton
              size="small"
              variant="text"
              color="inherit"
              onClick={() => setShowTechnicalDetails((prev) => !prev)}
              endIcon={showTechnicalDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ fontSize: '0.75rem', textTransform: 'none', color: 'text.secondary' }}
            >
              {showTechnicalDetails ? 'Hide Details' : 'View Technical Details'}
            </MuiButton>

            <Collapse in={showTechnicalDetails}>
              <Paper
                variant="outlined"
                sx={{
                  mt: 1,
                  p: 2,
                  bgcolor: 'action.hover',
                  borderColor: 'divider',
                  textAlign: 'left',
                  maxHeight: 180,
                  overflowY: 'auto',
                }}
              >
                <Typography
                  variant="caption"
                  fontFamily="monospace"
                  color="text.secondary"
                  component="pre"
                  sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.75rem' }}
                >
                  {error.message}
                </Typography>
              </Paper>
            </Collapse>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

GlobalErrorFallback.propTypes = {
  error: PropTypes.shape({
    message: PropTypes.string,
  }),
  resetErrorBoundary: PropTypes.func,
};

export default GlobalErrorFallback;
