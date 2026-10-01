/**
 * @module pages/Register
 * @description Supervisor registration page with auto-derivation preview and react-hook-form validation.
 */

import { useState, useMemo, memo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'react-toastify';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import MuiButton from '../components/reusable/MuiButton.jsx';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import GoogleIcon from '@mui/icons-material/Google';
import PropTypes from 'prop-types';
import { useRegisterMutation } from '../redux/features/authSlice.js';
import MuiTextField from '../components/reusable/MuiTextField.jsx';
import {
  EMAIL_REGEX,
  PASSWORD_REGEX,
  ROUTES,
} from '../utils/constants.js';

/** Stable adornment icons preventing unnecessary sub-tree reconciliations */
const EMAIL_ADORNMENT = <EmailOutlinedIcon fontSize="small" color="action" />;
const PASSWORD_ADORNMENT = <LockOutlinedIcon fontSize="small" color="action" />;

/**
 * Isolated derived name preview badge preventing parent form re-renders on keystroke.
 *
 * @component DerivedNameBadge
 * @param {object} props - Component properties.
 * @param {import('react-hook-form').Control} props.control - React Hook Form control object.
 * @returns {JSX.Element|null} Auto-derived supervisor name preview badge.
 */
const DerivedNameBadge = memo(({ control }) => {
  const watchedEmail = useWatch({ control, name: 'email', defaultValue: '' });
  const derivedName = useMemo(() => {
    if (!watchedEmail || !watchedEmail.includes('@')) return '';
    const prefix = watchedEmail.split('@')[0].trim();
    return prefix.length >= 2 ? prefix : `${prefix}__`;
  }, [watchedEmail]);

  if (!derivedName) return null;

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      <Chip
        icon={<BadgeOutlinedIcon fontSize="small" />}
        label={`Auto-derived Name: ${derivedName}`}
        size="small"
        variant="outlined"
        color="primary"
        sx={{ fontSize: '0.75rem' }}
      />
    </Box>
  );
});

DerivedNameBadge.displayName = 'DerivedNameBadge';
DerivedNameBadge.propTypes = {
  control: PropTypes.object.isRequired,
};

/**
 * Supervisor registration page scaffold.
 * Automatically derives name fields from the email prefix per Invariant 6;
 * zero name fields are collected from the user directly.
 *
 * @component Register
 * @returns {JSX.Element} Rendered registration page presentation.
 */
export const Register = () => {
  const navigate = useNavigate();
  const [registerUser, { isLoading }] = useRegisterMutation();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const handleGoogleAuthStub = () => {
    toast.info('Google Registration will be available soon. Please create your account with corporate email.');
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
          <PersonAddOutlinedIcon />
        </Box>

        <Typography variant="h5" fontWeight={700} gutterBottom>
          Create Account
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Register as an Enjoy Burger Field Area Supervisor.
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
                label="Corporate Email"
                autoComplete="email"
                autoFocus
                startAdornment={EMAIL_ADORNMENT}
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
                disabled={isLoading}
                {...register('email', {
                  required: 'Corporate email is required',
                  pattern: {
                    value: EMAIL_REGEX,
                    message: 'Please enter a valid email address',
                  },
                })}
              />
            </Grid>

            <Grid size={12} sx={{ py: 0 }}>
              <DerivedNameBadge control={control} />
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
                  'Minimum 8 characters with upper, lower, number & special character.'
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
                size="small"
                disabled={isLoading}
                sx={{ py: 1 }}
                startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
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
                Sign up with Google
              </MuiButton>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ textAlign: 'center', mt: 2.5 }}>
          <MuiButton
            component={Link}
            to={ROUTES.LOGIN}
            variant="text"
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Already have an account? Sign In
          </MuiButton>
        </Box>
      </Card>
    </Container>
  );
};

export default Register;
