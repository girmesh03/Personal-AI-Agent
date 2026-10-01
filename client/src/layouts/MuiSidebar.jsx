/**
 * @module layouts/MuiSidebar
 * @description Protected navigation drawer supporting permanent mini/full modes and temporary mobile overlay.
 */

import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import DescriptionIcon from "@mui/icons-material/Description";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import useLogout from "../hooks/useLogout.js";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../redux/features/authSlice.js";
import Logo from "./Logo.jsx";
import {
  APPBAR_MIN_HEIGHT,
  ROUTES,
  SIDEBAR_FULL_WIDTH,
  SIDEBAR_MINI_WIDTH,
} from "../utils/constants.js";

/**
 * Navigation route item definitions.
 * @constant
 * @type {ReadonlyArray<{ path: string, icon: import('react').ElementType, label: string, exact: boolean }>}
 */
const NAV_ITEMS = Object.freeze([
  {
    path: ROUTES.DASHBOARD,
    icon: DashboardIcon,
    label: "Dashboard",
    exact: true,
  },
  { path: ROUTES.CHAT, icon: SmartToyIcon, label: "Chat", exact: false },
  { path: ROUTES.REPORTS, icon: DescriptionIcon, label: "Reports", exact: false },
  { path: ROUTES.BRANCHES, icon: StorefrontIcon, label: "Branches", exact: false },
  { path: ROUTES.PROFILE, icon: PersonIcon, label: "Profile", exact: true },
]);

/**
 * Navigation drawer component with responsive layout variants and avatar profile controls.
 *
 * @component MuiSidebar
 * @param {object} props - Component properties.
 * @param {'mini'|'full'} props.mode - Sidebar width density mode on desktop screens.
 * @param {() => void} props.onToggleMode - Callback toggling between mini and full modes.
 * @param {boolean} props.mobileOpen - Whether the mobile drawer overlay is visible.
 * @param {() => void} props.onMobileClose - Callback closing the mobile drawer overlay.
 * @returns {JSX.Element} Rendered drawer navigation component.
 */
const MuiSidebar = ({ mode, onToggleMode, mobileOpen, onMobileClose }) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSelector(selectAuthUser);
  const logout = useLogout();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [anchorEl, setAnchorEl] = useState(null);

  /** The temporary overlay always presents full affordances. */
  const effectiveMode = isMobile ? "full" : mode;
  const isMini = effectiveMode === "mini";
  const drawerWidth = isMini ? SIDEBAR_MINI_WIDTH : SIDEBAR_FULL_WIDTH;

  const initials = useMemo(() => {
    if (!user) return "?";
    const first = user.firstName?.[0] ?? "";
    const last = user.lastName?.[0] ?? "";
    return (first + last).toUpperCase();
  }, [user]);

  const displayName = useMemo(() => {
    if (!user) return "User";
    const first = user.firstName?.trim() ?? "";
    const last = user.lastName?.trim() ?? "";
    return first || last ? `${first} ${last}`.trim() : "User";
  }, [user]);

  const isSelected = (path) => location.pathname === path;

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleProfileClick = () => {
    handleMenuClose();
    navigate(ROUTES.PROFILE);
  };

  const handleLogoutClick = () => {
    handleMenuClose();
    void logout();
  };

  const headerContent = isMini ? (
    /* Mini: the lone, centered mode toggle (owner directive). */
    <IconButton
      size="small"
      aria-label="Expand sidebar"
      onClick={onToggleMode}
      sx={{ color: "text.secondary", flexShrink: 0 }}
    >
      <ChevronRightIcon fontSize="small" />
    </IconButton>
  ) : (
    /* Full (or overlay): Logo left, mode/close toggle right. */
    <>
      <Logo to={ROUTES.DASHBOARD} sx={{ minWidth: 0 }} />
      <Box sx={{ flexGrow: 1 }} />
      <IconButton
        size="small"
        aria-label={isMobile ? "Close navigation" : "Collapse sidebar"}
        onClick={isMobile ? onMobileClose : onToggleMode}
        sx={{ color: "text.secondary", flexShrink: 0 }}
      >
        {isMobile ? (
          <MenuIcon fontSize="small" />
        ) : (
          <ChevronLeftIcon fontSize="small" />
        )}
      </IconButton>
    </>
  );

  const sidebarContent = (
    <Box
      component="nav"
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: isMini ? "center" : "flex-start",
          minHeight: APPBAR_MIN_HEIGHT,
          px: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        {headerContent}
      </Box>

      {/* Navigation */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", py: 1 }}>
        <List dense disablePadding aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const labelNode = (
              <Typography
                variant="body2"
                noWrap
                sx={{ fontWeight: 500, ml: 1 }}
              >
                {item.label}
              </Typography>
            );
            return (
              <Tooltip
                key={item.path}
                title={isMini ? item.label : ""}
                placement="right"
                arrow
              >
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  end={item.exact}
                  selected={isSelected(item.path)}
                  sx={{
                    mx: 1,
                    my: 0.25,
                    borderRadius: 1,
                    justifyContent: isMini ? "center" : "flex-start",
                    px: isMini ? 0 : 1.5,
                    py: 0.75,
                    "&:hover": {
                      bgcolor: "action.hover",
                    },
                  }}
                  onClick={() => isMobile && onMobileClose()}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: isMini ? 0 : 32,
                      justifyContent: "center",
                    }}
                  >
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  {isMini ? null : labelNode}
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
      </Box>

      <Divider />

      {/* Avatar menu anchor */}
      <Box sx={{ px: 1, py: 1.5 }}>
        {isMini ? (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Tooltip title={displayName} placement="right" arrow>
              <IconButton
                size="small"
                aria-label="User menu"
                onClick={handleMenuOpen}
                sx={{ p: 0 }}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    bgcolor: "primary.main",
                  }}
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Box
            role="button"
            tabIndex={0}
            onClick={handleMenuOpen}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                handleMenuOpen(event);
              }
            }}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              width: "100%",
              px: 0.75,
              py: 0.5,
              borderRadius: 1,
              cursor: "pointer",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <Avatar
              sx={{
                width: 28,
                height: 28,
                fontSize: "0.8125rem",
                fontWeight: 600,
                bgcolor: "primary.main",
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" color="text.secondary" noWrap>
                {displayName}
              </Typography>
            </Box>
            <MoreVertIcon fontSize="small" color="action" />
          </Box>
        )}
      </Box>

      {/* Avatar menu — opens up-right of the bottom anchor (§47.3). */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: isMini ? "left" : "right",
        }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 160,
              maxWidth: isMini ? "calc(100vw - 120px)" : "calc(100vw - 280px)",
              mb: 0.5,
            },
          },
          popper: {
            modifiers: [
              {
                name: "flip",
                options: {
                  fallbackPlacements: [
                    "top-start",
                    "bottom-start",
                    "top-end",
                    "bottom-end",
                    "right",
                    "left",
                  ],
                },
              },
              {
                name: "preventOverflow",
                options: { boundary: "viewport", altBoundary: true },
              },
            ],
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
          <ListItemIcon sx={{ minWidth: 32, color: "error.main" }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={onMobileClose}
        disableEnforceFocus
        disableRestoreFocus
        slotProps={{
          paper: {
            sx: { width: SIDEBAR_FULL_WIDTH },
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      anchor="left"
      open
      sx={{ width: drawerWidth, flexShrink: 0 }}
      slotProps={{
        paper: {
          sx: {
            width: drawerWidth,
            transition: theme.transitions.create("width", {
              duration: theme.transitions.duration.shorter,
            }),
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          },
        },
      }}
    >
      {sidebarContent}
    </Drawer>
  );
};

export default MuiSidebar;
