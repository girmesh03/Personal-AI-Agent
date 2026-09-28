/**
 * @module layouts/AvatarMenu
 * @description User avatar dropdown menu in protected app-bar providing profile navigation and session termination.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Tooltip from '@mui/material/Tooltip';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import { selectAuthUser } from '../redux/features/authSlice.js';
import useLogout from '../hooks/useLogout.js';
import { PROFILE_ROUTE } from '../utils/constants.js';

/**
 * Supervisor avatar menu displaying user initials, profile navigation, and logout options.
 *
 * @component AvatarMenu
 * @returns {JSX.Element} Rendered user avatar trigger and menu dropdown.
 */
export const AvatarMenu = () => {
  const user = useSelector(selectAuthUser);
  const logout = useLogout();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  const handleOpen = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleProfileClick = () => {
    handleClose();
    navigate(PROFILE_ROUTE);
  };

  const handleLogoutClick = () => {
    handleClose();
    void logout();
  };

  return (
    <>
      <Tooltip title={user?.fullName ?? 'User menu'}>
        <IconButton
          size="small"
          aria-label="User menu"
          onClick={handleOpen}
          sx={{ p: 0 }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: '0.75rem',
              fontWeight: 600,
              bgcolor: 'primary.main',
            }}
          >
            {initials}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { minWidth: 200, mt: 1 },
          },
        }}
      >
        <MenuItem onClick={handleProfileClick}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={handleLogoutClick}>
          <ListItemIcon sx={{ minWidth: 32, color: 'error.main' }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </>
  );
};

export default AvatarMenu;
