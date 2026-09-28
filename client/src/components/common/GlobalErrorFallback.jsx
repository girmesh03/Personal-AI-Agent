/**
 * @module components/common/GlobalErrorFallback
 * @description Global fallback screen rendered by react-error-boundary when an unhandled runtime error occurs.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import RefreshIcon from '@mui/icons-material/Refresh';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import PropTypes from 'prop-types';

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
  const handleReload = () => {
    if (resetErrorBoundary) {
      resetErrorBoundary();
    }
    window.location.reload();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 480,
          width: '100%',
          p: 4,
          textAlign: 'center',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            bgcolor: 'error.light',
            color: 'error.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1,
          }}
        >
          <ErrorOutlinedIcon sx={{ fontSize: 32 }} />
        </Box>

        <Typography variant="h5" fontWeight={600} color="text.primary">
          Something went wrong
        </Typography>

        <Typography variant="body2" color="text.secondary">
          An unexpected error occurred while rendering the application. Please try reloading the page.
        </Typography>

        {error?.message && (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              width: '100%',
              bgcolor: 'action.hover',
              borderColor: 'divider',
              textAlign: 'left',
              overflowX: 'auto',
            }}
          >
            <Typography
              variant="caption"
              fontFamily="monospace"
              color="text.secondary"
              component="pre"
              sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {error.message}
            </Typography>
          </Paper>
        )}

        <Button
          variant="contained"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={handleReload}
          sx={{ mt: 1 }}
        >
          Reload Application
        </Button>
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
