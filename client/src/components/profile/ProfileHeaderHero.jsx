/**
 * @module components/profile/ProfileHeaderHero
 * @description Supervisor identity header hero displaying avatar, initials, full name, email,
 * active agent chip, and direct avatar photo management (upload/remove) with zero visual duplication.
 */

import { useRef } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router';
import { toast } from 'react-toastify';

import { ROUTES } from '../../utils/constants.js';
import MuiButton from '../reusable/MuiButton.jsx';
import {
  useUpdateAvatarMutation,
  useRemoveAvatarMutation,
} from '../../redux/features/userSlice.js';
import { optimizeAvatarImage } from '../../utils/imageOptimizer.js';
import { getAvatarUrl } from '../../utils/avatarUtils.js';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Supervisor identity hero banner rendered at the top of the Profile canvas.
 * Houses the canonical profile photo with upload/remove actions.
 *
 * @component ProfileHeaderHero
 * @param {object} props - Component properties.
 * @param {object} props.user - Active supervisor user object.
 * @returns {import('react').JSX.Element} Rendered profile hero banner.
 */
export const ProfileHeaderHero = ({ user }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [updateAvatar, { isLoading: isUploadingAvatar }] = useUpdateAvatarMutation();
  const [removeAvatar, { isLoading: isRemovingAvatar }] = useRemoveAvatarMutation();

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(ROUTES.DASHBOARD || '/dashboard');
    }
  };

  const isAvatarBusy = isUploadingAvatar || isRemovingAvatar;

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'U';

  const fullName =
    user?.fullName ||
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() ||
    'Supervisor';

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPEG, WebP).');
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error('Image size must be 5MB or less.');
      return;
    }

    try {
      const optimizedBase64 = await optimizeAvatarImage(file);
      await updateAvatar({ avatar: optimizedBase64 }).unwrap();
      toast.success('Profile photo updated successfully.');
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to update avatar image.');
    } finally {
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await removeAvatar().unwrap();
      toast.success('Profile photo removed.');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to remove avatar.');
    }
  };

  return (
    <Box sx={{ mb: { xs: 2, sm: 2.5 } }}>
      {/* Top Navigation & Breadcrumbs Row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1.5,
        }}
      >
        {/* Universal Back Button (History-Aware) */}
        <MuiButton
          variant="text"
          color="inherit"
          size="small"
          onClick={handleBack}
          startIcon={<ArrowBackIcon fontSize="small" />}
          sx={{
            display: { xs: 'none', sm: 'inline-flex' },
            color: 'text.secondary',
            fontWeight: 500,
          }}
        >
          Back
        </MuiButton>

        {/* Mobile xs: 375px Iconified Back Button */}
        <Tooltip title="Back">
          <IconButton
            onClick={handleBack}
            size="small"
            sx={{
              display: { xs: 'inline-flex', sm: 'none' },
              color: 'text.secondary',
              border: 1,
              borderColor: 'divider',
              p: 0.5,
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Structured Breadcrumbs replacing orphaned caption */}
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" sx={{ fontSize: '0.85rem', color: 'text.disabled' }} />}
          aria-label="breadcrumb"
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontWeight: 500,
              fontSize: { xs: '0.75rem', sm: '0.8125rem' },
            }}
          >
            Workspace
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.primary',
              fontWeight: 600,
              fontSize: { xs: '0.75rem', sm: '0.8125rem' },
            }}
          >
            Profile & Settings
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* User Identity Header Card */}
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
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1.5, sm: 2 },
            }}
          >
            {/* Hidden File Input for Avatar Upload */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {/* Single Interactive Avatar with Camera Upload Badge */}
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                <Tooltip title="Change profile photo">
                  <IconButton
                    size="small"
                    disabled={isAvatarBusy}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{
                      width: { xs: 24, sm: 28 },
                      height: { xs: 24, sm: 28 },
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      boxShadow: 1,
                      p: 0.5,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <PhotoCameraIcon sx={{ fontSize: { xs: 13, sm: 16 }, color: 'text.primary' }} />
                  </IconButton>
                </Tooltip>
              }
            >
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={getAvatarUrl(user?.avatar) || undefined}
                  alt={fullName}
                  sx={{
                    width: { xs: 52, sm: 64 },
                    height: { xs: 52, sm: 64 },
                    fontSize: { xs: '1.15rem', sm: '1.45rem' },
                    fontWeight: 700,
                    bgcolor: 'primary.main',
                    border: 2,
                    borderColor: 'divider',
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </Avatar>
                {isAvatarBusy && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(0,0,0,0.45)',
                      borderRadius: '50%',
                    }}
                  >
                    <CircularProgress size={22} sx={{ color: '#fff' }} />
                  </Box>
                )}
              </Box>
            </Badge>

            {/* Identity Text and Chips */}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography
                  variant="h6"
                  noWrap
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '1rem', sm: '1.2rem' },
                    lineHeight: 1.25,
                  }}
                >
                  {fullName}
                </Typography>

                {user?.avatar && (
                  <Tooltip title="Remove photo">
                    <IconButton
                      size="small"
                      color="error"
                      disabled={isAvatarBusy}
                      onClick={handleRemoveAvatar}
                      sx={{ p: 0.5 }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: '1.1rem' }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              <Typography
                variant="body2"
                noWrap
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                  mb: 0.75,
                }}
              >
                {user?.email || 'user@example.com'}
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                <Chip
                  label={user?.position || 'Area Supervisor'}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: '0.7rem',
                    height: 22,
                    fontWeight: 500,
                  }}
                />
                <Chip
                  icon={<SmartToyOutlinedIcon sx={{ fontSize: '0.85rem !important' }} />}
                  label="Personal AI Agent Active"
                  size="small"
                  color="primary"
                  variant="filled"
                  sx={{
                    fontSize: '0.7rem',
                    height: 22,
                    fontWeight: 600,
                  }}
                />
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

ProfileHeaderHero.propTypes = {
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    fullName: PropTypes.string,
    email: PropTypes.string,
    position: PropTypes.string,
    avatar: PropTypes.string,
  }),
};

export default ProfileHeaderHero;
