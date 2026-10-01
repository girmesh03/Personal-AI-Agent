/**
 * @module pages/Login
 * @description Supervisor login page with react-hook-form validation and RTK Query authentication.
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { useForm } from 'react-hook-form';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import MuiButton from '../components/reusable/MuiButton.jsx';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import GoogleIcon from '@mui/icons-material/Google';
import { toast } from 'react-toastify';
import { useLoginMutation } from '../redux/features/authSlice.js';
import MuiTextField from '../components/reusable/MuiTextField.jsx';
import {
  EMAIL_REGEX,
  ROUTES,
} from '../utils/constants.js';

/** Stable adornment icons preventing unnecessary sub-tree reconciliations */
const EMAIL_ADORNMENT = <EmailOutlinedIcon fontSize="small" color="action" />;
const PASSWORD_ADORNMENT = <LockOutlinedIcon fontSize="small" color="action" />;

/**
 * Supervisor login page presenting authentication form card with react-hook-form validation.
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

  const handleGoogleAuthStub = () => {
    toast.info('Google Sign-In will be available soon. Please use your corporate email and password.');
  };

  const onSubmit = async (data) => {
    setServerError('');
    try {
      await login(data).unwrap();
      navigate(from, { replace: true });
    } catch (err) {
      const message =
        err?.message ||
        err?.data?.message ||
        err?.error ||
        'Invalid credentials. Please verify your email and password.';
      setServerError(message);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 6, sm: 10 } }}>
      <Card
        variant="outlined"
        sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          textAlign: 'center',
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
          <LockOutlinedIcon />
        </Box>

        <Typography variant="h5" fontWeight={700} gutterBottom>
          Sign In
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Access your supervisor dashboard and operational shift reports.
        </Typography>

        {serverError && (
          <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
            {serverError}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ textAlign: 'left' }}>
          <Grid container spacing={1}>
            <Grid size={12}>
              <MuiTextField
                label="Email Address"
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

            <Grid size={12}>
              <MuiButton
                type="submit"
                fullWidth
                variant="contained"
                size="small"
                disabled={isLoading}
                sx={{ py: 1 }}
                startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </MuiButton>
            </Grid>

            <Grid size={12}>
              <Box sx={{ my: 1.5, display: 'flex', alignItems: 'center' }}>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                <Typography variant="caption" sx={{ px: 1.5, color: 'text.secondary', fontWeight: 500 }}>
                  OR
                </Typography>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              </Box>
            </Grid>

            <Grid size={12}>
              <MuiButton
                type="button"
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<GoogleIcon />}
                onClick={handleGoogleAuthStub}
                sx={{ py: 1 }}
              >
                Sign in with Google
              </MuiButton>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ textAlign: 'center', mt: 2.5 }}>
          <MuiButton
            component={Link}
            to={ROUTES.REGISTER}
            variant="text"
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Don't have an account? Register
          </MuiButton>
        </Box>
      </Card>
    </Container>
  );
};

export default Login;
