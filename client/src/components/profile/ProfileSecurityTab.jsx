/**
 * @module components/profile/ProfileSecurityTab
 * @description Account security and password management tab.
 * Enforces zero-lag typing with react-hook-form mode: 'onBlur' and zero watch calls.
 */

import { useForm } from 'react-hook-form';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import LockResetIcon from '@mui/icons-material/LockReset';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import Stack from '@mui/material/Stack';
import { toast } from 'react-toastify';

import { useUpdatePasswordMutation } from '../../redux/features/userSlice.js';
import MuiButton from '../reusable/MuiButton.jsx';
import MuiTextField from '../reusable/MuiTextField.jsx';
import { PASSWORD_MIN_LENGTH } from '../../utils/constants.js';

/**
 * Security Tab providing password update capabilities and complexity verification.
 *
 * @component ProfileSecurityTab
 * @returns {import('react').JSX.Element} Rendered security tab.
 */
export const ProfileSecurityTab = () => {
  const [updatePassword, { isLoading }] = useUpdatePasswordMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values) => {
    try {
      await updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }).unwrap();

      reset();
      toast.success('Account password updated successfully.');
    } catch (err) {
      const errorMsg =
        err?.data?.message || err?.message || 'Failed to update password. Please check your current password.';
      toast.error(errorMsg);
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: '12px',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        boxShadow: 'none',
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Typography variant="h6" sx={{ fontSize: { xs: '0.95rem', sm: '1.05rem' }, fontWeight: 600, mb: 0.5 }}>
          Account Security & Password
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: { xs: '0.8rem', sm: '0.875rem' }, mb: { xs: 2, sm: 2.5 } }}>
          Ensure your Personal AI Agent account remains secure with a strong, complex password.
        </Typography>

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Grid container spacing={{ xs: 1.5, sm: 2.5 }}>
            {/* Current Password */}
            <Grid size={{ xs: 12 }}>
              <MuiTextField
                label="Current Password"
                type="password"
                isPassword
                fullWidth
                error={Boolean(errors.currentPassword)}
                helperText={errors.currentPassword?.message || 'Enter your existing account password'}
                {...register('currentPassword', {
                  required: 'Current password is required.',
                })}
              />
            </Grid>

            {/* New Password */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <MuiTextField
                label="New Password"
                type="password"
                isPassword
                fullWidth
                error={Boolean(errors.newPassword)}
                helperText={errors.newPassword?.message || `Minimum ${PASSWORD_MIN_LENGTH || 8} characters`}
                {...register('newPassword', {
                  required: 'New password is required.',
                  minLength: {
                    value: PASSWORD_MIN_LENGTH || 8,
                    message: `Password must be at least ${PASSWORD_MIN_LENGTH || 8} characters long.`,
                  },
                  validate: {
                    hasUpper: (v) => /[A-Z]/.test(v) || 'Must contain at least 1 uppercase letter.',
                    hasLower: (v) => /[a-z]/.test(v) || 'Must contain at least 1 lowercase letter.',
                    hasNumberOrSpecial: (v) =>
                      /[0-9!@#$%^&*(),.?":{}|<>]/.test(v) || 'Must contain at least 1 number or special character.',
                  },
                })}
              />
            </Grid>

            {/* Confirm Password */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <MuiTextField
                label="Confirm New Password"
                type="password"
                isPassword
                fullWidth
                error={Boolean(errors.confirmPassword)}
                helperText={errors.confirmPassword?.message || 'Re-enter your new password'}
                {...register('confirmPassword', {
                  required: 'Please confirm your new password.',
                  validate: (val, formValues) =>
                    val === formValues.newPassword || 'The passwords do not match.',
                })}
              />
            </Grid>
          </Grid>

          {/* Password Complexity Policy Deck */}
          <Box
            sx={{
              mt: { xs: 2, sm: 2.5 },
              p: 1.5,
              borderRadius: '8px',
              bgcolor: 'action.hover',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Password Complexity Guidelines:
            </Typography>
            <Stack spacing={0.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: '0.95rem', color: 'primary.main' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  At least 8 characters long (up to 128 characters)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: '0.95rem', color: 'primary.main' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Includes at least one uppercase letter (A-Z) and one lowercase letter (a-z)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: '0.95rem', color: 'primary.main' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Includes at least one numeric digit (0-9) or special character (!@#$%^&*)
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              mt: { xs: 2, sm: 2.5 },
            }}
          >
            <MuiButton
              type="submit"
              variant="contained"
              color="primary"
              disabled={isLoading || !isDirty}
              startIcon={
                isLoading ? <CircularProgress size={16} color="inherit" /> : <LockResetIcon fontSize="small" />
              }
              sx={{
                width: { xs: '100%', sm: 'auto' },
                py: { xs: 0.85, sm: 0.75 },
                fontWeight: 600,
              }}
            >
              {isLoading ? 'Updating Password...' : 'Update Account Password'}
            </MuiButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProfileSecurityTab;
