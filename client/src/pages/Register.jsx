/**
 * @module pages/Register
 * @description Enterprise onboarding registration page for Personal AI Agent.
 * Zero-lag form responsiveness with mode: 'onBlur', zero debounces, and zero watch calls.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

import MuiButton from '../components/reusable/MuiButton.jsx';
import MuiTextField from '../components/reusable/MuiTextField.jsx';
import GoogleSsoButton from '../components/auth/GoogleSsoButton.jsx';
import { useRegisterMutation } from '../redux/features/authSlice.js';
import {
  EMAIL_REGEX,
  PASSWORD_REGEX,
  ROUTES,
  API_BASE_URL,
} from '../utils/constants.js';

/** Stable adornment icons preventing unnecessary sub-tree reconciliations */
const EMAIL_ADORNMENT = <EmailOutlinedIcon fontSize="small" color="action" />;
const PASSWORD_ADORNMENT = <LockOutlinedIcon fontSize="small" color="action" />;

/**
 * Enterprise registration page for Personal AI Agent platform.
 * Streamlined 3-field layout (Email, Password, Confirm Password).
 * First and last names are auto-derived seamlessly and fully manageable in /profile.
 *
 * @component Register
 * @returns {JSX.Element} Rendered registration page presentation.
 */
export const Register = () => {
  const navigate = useNavigate();
  const [registerUser, { isLoading }] = useRegisterMutation();
  const [serverError, setServerError] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const handleGoogleSso = () => {
    setIsGoogleLoading(true);
    window.location.href = `${API_BASE_URL}/auth/google/sso`;
  };

  const onSubmit = async (data) => {
    setServerError('');
    try {
      await registerUser({
        email: data.email,
        password: data.password,
      }).unwrap();

      toast.success('Account created successfully! Please sign in with your credentials.');
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (err) {
      const message =
        err?.message ||
        err?.data?.message ||
        err?.error ||
        'Registration failed. Please check your information and try again.';
      setServerError(message);
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
          <PersonAddOutlinedIcon fontSize="medium" />
        </Box>

        <Typography variant="h5" fontWeight={700} gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          Create Your Account
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.5 }}>
          Set up your Personal AI Agent for autonomous field operations and daily workflows.
        </Typography>

        {serverError && (
          <Alert
            severity={serverError.includes('Google Sign-In') ? 'info' : 'error'}
            sx={{ mb: 2.5, textAlign: 'left', '& .MuiAlert-message': { width: '100%' } }}
          >
            <Typography variant="body2">{serverError}</Typography>
            {serverError.includes('Google Sign-In') && (
              <Box sx={{ mt: 1 }}>
                <MuiButton
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={handleGoogleSso}
                  disabled={isGoogleLoading}
                  startIcon={isGoogleLoading ? <CircularProgress size={16} color="inherit" /> : null}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  {isGoogleLoading ? 'Connecting to Google...' : 'Sign in with Google'}
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
                autoComplete="new-password"
                startAdornment={PASSWORD_ADORNMENT}
                error={Boolean(errors.password)}
                helperText={
                  errors.password?.message ||
                  'Min 8 characters with upper, lower, number & symbol.'
                }
                disabled={isLoading}
                {...register('password', {
                  required: 'Password is required',
                  pattern: {
                    value: PASSWORD_REGEX,
                    message:
                      'Must include at least 1 uppercase, 1 lowercase, 1 number, and 1 special symbol (@$!%*?&)',
                  },
                })}
              />
            </Grid>

            <Grid size={12}>
              <MuiTextField
                label="Confirm Password"
                type="password"
                autoComplete="new-password"
                startAdornment={PASSWORD_ADORNMENT}
                error={Boolean(errors.confirmPassword)}
                helperText={errors.confirmPassword?.message}
                disabled={isLoading}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (val, formValues) =>
                    val === formValues.password || 'Passwords do not match',
                })}
              />
            </Grid>

            <Grid size={12}>
              <MuiButton
                type="submit"
                fullWidth
                variant="contained"
                size="medium"
                disabled={isLoading}
                sx={{ fontWeight: 600 }}
                startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
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
                label="Sign up with Google"
                onClick={handleGoogleSso}
                isLoading={isGoogleLoading}
                disabled={isLoading || isGoogleLoading}
              />
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <MuiButton
            component={Link}
            to={ROUTES.LOGIN}
            variant="text"
            size="small"
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            Already have an account? Sign In
          </MuiButton>
        </Box>
      </Card>
    </Container>
  );
};

export default Register;
