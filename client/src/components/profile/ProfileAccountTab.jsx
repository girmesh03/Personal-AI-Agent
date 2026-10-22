/**
 * @module components/profile/ProfileAccountTab
 * @description Supervisor account profile management tab.
 * Enforces zero-lag typing with react-hook-form mode: 'onBlur' and zero watch calls.
 */

import { useForm } from 'react-hook-form';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import SaveIcon from '@mui/icons-material/Save';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';

import { useUpdateProfileMutation } from '../../redux/features/userSlice.js';
import MuiButton from '../reusable/MuiButton.jsx';
import MuiTextField from '../reusable/MuiTextField.jsx';
import { EMAIL_REGEX } from '../../utils/constants.js';

/**
 * Account Profile Tab for editing personal information.
 *
 * @component ProfileAccountTab
 * @param {object} props - Component properties.
 * @param {object} props.user - Current user object.
 * @returns {import('react').JSX.Element} Rendered account tab.
 */
export const ProfileAccountTab = ({ user }) => {
  const [updateProfile, { isLoading: isUpdatingProfile }] = useUpdateProfileMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      position: user?.position || 'Area Supervisor',
    },
  });

  const onSubmit = async (values) => {
    try {
      await updateProfile(values).unwrap();
      toast.success('Profile updated successfully.');
    } catch (err) {
      const errorMsg =
        err?.data?.message || err?.message || 'Failed to update profile. Please try again.';
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
          Personal Identity & Contact Information
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: { xs: '0.8rem', sm: '0.875rem' }, mb: { xs: 2, sm: 2.5 } }}>
          Manage your personal identity details, corporate position, and communication email.
        </Typography>

        {/* Profile Information Form */}
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Grid container spacing={{ xs: 1.5, sm: 2.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MuiTextField
                label="First Name"
                fullWidth
                error={Boolean(errors.firstName)}
                helperText={errors.firstName?.message || 'Required (2-50 characters)'}
                {...register('firstName', {
                  required: 'First name is required.',
                  minLength: { value: 2, message: 'Minimum 2 characters.' },
                  maxLength: { value: 50, message: 'Maximum 50 characters.' },
                })}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <MuiTextField
                label="Last Name"
                fullWidth
                error={Boolean(errors.lastName)}
                helperText={errors.lastName?.message || 'Required (2-50 characters)'}
                {...register('lastName', {
                  required: 'Last name is required.',
                  minLength: { value: 2, message: 'Minimum 2 characters.' },
                  maxLength: { value: 50, message: 'Maximum 50 characters.' },
                })}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <MuiTextField
                label="Corporate Email"
                type="email"
                fullWidth
                error={Boolean(errors.email)}
                helperText={errors.email?.message || 'Unique login and communication email'}
                {...register('email', {
                  required: 'Email address is required.',
                  pattern: {
                    value: EMAIL_REGEX,
                    message: 'Please provide a valid email address.',
                  },
                })}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <MuiTextField
                label="Operational Position / Role"
                fullWidth
                error={Boolean(errors.position)}
                helperText={errors.position?.message || 'Professional title in executive reports'}
                {...register('position', {
                  required: 'Position title is required.',
                })}
              />
            </Grid>
          </Grid>

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
              disabled={isUpdatingProfile || !isDirty}
              startIcon={
                isUpdatingProfile ? <CircularProgress size={16} color="inherit" /> : <SaveIcon fontSize="small" />
              }
              sx={{
                width: { xs: '100%', sm: 'auto' },
                py: { xs: 0.85, sm: 0.75 },
                fontWeight: 600,
              }}
            >
              {isUpdatingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
            </MuiButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

ProfileAccountTab.propTypes = {
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
    position: PropTypes.string,
    avatar: PropTypes.string,
  }),
};

export default ProfileAccountTab;
