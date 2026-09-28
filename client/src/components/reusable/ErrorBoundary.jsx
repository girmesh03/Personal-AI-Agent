/**
 * @module components/reusable/ErrorBoundary
 * @description Standard React error boundary displaying user-friendly recovery interface on crash.
 */
import { Component } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

/**
 * React Error Boundary capturing unhandled runtime render exceptions in child trees.
 *
 * @component ErrorBoundary
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error, _errorInfo) {
    // Unhandled UI Exception captured by ErrorBoundary
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            p: 3,
            backgroundColor: 'background.default',
          }}
        >
          <Paper
            elevation={2}
            sx={{
              p: 4,
              maxWidth: 480,
              width: '100%',
              textAlign: 'center',
              borderRadius: 3,
            }}
          >
            <ErrorOutlineIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Something Went Wrong
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              An unexpected error occurred in the application. Please try reloading the page.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="contained" color="primary" onClick={this.handleReload}>
                Reload Page
              </Button>
              <Button variant="outlined" color="inherit" onClick={this.handleReset}>
                Try Again
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
