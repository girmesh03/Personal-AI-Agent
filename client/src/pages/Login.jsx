/**
 * @module pages/Login
 * @description Enterprise authentication login page for Personal AI Agent.
 * Zero-lag form responsiveness with mode: 'onBlur', zero debounces, and zero watch calls.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { useForm } from 'react-hook-form';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';

import MuiButton from '../components/reusable/MuiButton.jsx';
import MuiTextField from '../components/reusable/MuiTextField.jsx';
import GoogleSsoButton from '../components/auth/GoogleSsoButton.jsx';
import { useLoginMutation } from '../redux/features/authSlice.js';
import {
  EMAIL_REGEX,
  ROUTES,
  API_BASE_URL,
} from '../utils/constants.js';

/** Stable adornment icons preventing unnecessary sub-tree reconciliations */
const EMAIL_ADORNMENT = <EmailOutlinedIcon fontSize="small" color="action" />;
const PASSWORD_ADORNMENT = <LockOutlinedIcon fontSize="small" color="action" />;

/**
 * Enterprise login page presenting authentication form card with react-hook-form validation.
 * Strictly adheres to single-user architecture with zero "Remember Me" logic.
 *
 * @component Login
 * @returns {JSX.Element} Rendered login page presentation.
 */
export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [login, { isLoading }] = useLoginMutation();
  const [serverError, setServerError] = useState('');
  const [ssoPrompt, setSsoPrompt] = useState(false);

  const from = location.state?.from?.pathname || ROUTES.DASHBOARD;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Check URL query parameters for SSO errors
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const err = params.get('error');
    if (err) {
      if (err === 'GOOGLE_SSO_NOT_CONFIGURED') {
        setServerError('Google SSO is not configured on this server. Please sign in with email and password.');
      } else {
        setServerError(`Sign in error: ${err}`);
      }
    }
  }, [location.search]);

  const handleGoogleSso = () => {
    window.location.href = `${API_BASE_URL}/auth/google/sso`;
  };

  const onSubmit = async (data) => {
    setServerError('');
    setSsoPrompt(false);
    try {
      await login(data).unwrap();
      navigate(from, { replace: true });
    } catch (err) {
      if (err?.data?.errorCode === 'SSO_PASSWORD_NOT_SET') {
        setSsoPrompt(true);
        setServerError(
          err?.data?.message ||
          "This account was registered using Google Sign-In and does not have an email password yet. Please click 'Sign in with Google' below, or set a password in your Profile."
        );
      } else {
        const message =
          err?.data?.message ||
          err?.message ||
          err?.error ||
          'Invalid credentials. Please verify your email and password.';
        setServerError(message);
      }
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 4, sm: 8 } }}>
      <Card
        variant="outlined"
        sx={{
          p: { xs: 2.5, sm: 4 },
          borderRadius: 3,
          textAlign: 'center',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 4px 20px rgba(0,0,0,0.5)'
              : '0 4px 20px rgba(0,0,0,0.06)',
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            p: 1.5,
            borderRadius: '50%',
            bgcolor: 'primary.light',
            color: 'primary.dark',
            mb: 2,
          }}
        >
          <LockOutlinedIcon fontSize="medium" />
        </Box>

        <Typography variant="h5" fontWeight={700} gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          Welcome Back
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.5 }}>
          Sign in to access your Personal AI Agent dashboard and field records.
        </Typography>

        {serverError && (
          <Alert
            severity={ssoPrompt ? 'info' : 'error'}
            sx={{
              mb: 2.5,
              textAlign: 'left',
              '& .MuiAlert-message': { width: '100%' },
            }}
          >
            <Typography variant="body2" sx={{ mb: ssoPrompt ? 1.5 : 0 }}>
              {serverError}
            </Typography>
            {ssoPrompt && (
              <Box sx={{ mt: 1 }}>
                <MuiButton
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={handleGoogleSso}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Sign in with Google
                </MuiButton>
              </Box>
            )}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ textAlign: 'left' }}>
          <Grid container spacing={1.5}>
            <Grid size={12}>
              <MuiTextField
                label="Email Address"
                placeholder="name@company.com"
                autoComplete="email"
                autoFocus
                startAdornment={EMAIL_ADORNMENT}
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
                disabled={isLoading}
                {...register('email', {
                  required: 'Email address is required',
                  pattern: {
                    value: EMAIL_REGEX,
                    message: 'Please enter a valid email address',
                  },
                })}
              />
            </Grid>

            <Grid size={12}>
              <MuiTextField
                label="Password"
                type="password"
                autoComplete="current-password"
                startAdornment={PASSWORD_ADORNMENT}
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                disabled={isLoading}
                {...register('password', {
                  required: 'Password is required',
                })}
              />
            </Grid>

            <Grid size={12} >
              <MuiButton
                type="submit"
                fullWidth
                variant="contained"
                size="medium"
                disabled={isLoading}
                sx={{ fontWeight: 600 }}
                startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </MuiButton>
            </Grid>

            <Grid size={12}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                <Typography variant="caption" sx={{ px: 2, color: 'text.secondary', fontWeight: 600 }}>
                  OR
                </Typography>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              </Box>
            </Grid>

            <Grid size={12}>
              <GoogleSsoButton
                label="Sign in with Google"
                onClick={handleGoogleSso}
              />
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <MuiButton
            component={Link}
            to={ROUTES.REGISTER}
            variant="text"
            size="small"
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            Don't have an account? Register
          </MuiButton>
        </Box>
      </Card>
    </Container>
  );
};

export default Login;
