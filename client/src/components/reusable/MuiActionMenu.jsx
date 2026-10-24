/**
 * @module components/reusable/MuiActionMenu
 * @description Standardized 3-dots action menu with built-in action -> confirm -> effect lifecycle
 * integration using MuiConfirmDialog. Strictly 100% English UI chrome.
 */

import { useState, useCallback, memo } from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PropTypes from 'prop-types';
import MuiConfirmDialog from './MuiConfirmDialog.jsx';

/**
 * Standardized 3-dots actions menu component.
 * Executes the Three-Phase Action Lifecycle (action -> confirm -> effect):
 * If an item provides confirmation metadata, an explicit MuiConfirmDialog is opened
 * prior to dispatching the action effect.
 *
 * @component MuiActionMenu
 * @param {object} props - Component properties.
 * @param {Array<object>} props.items - Array of action menu items.
 * @param {string} props.items[].id - Unique action identifier.
 * @param {string} props.items[].label - English action label.
 * @param {import('react').ReactElement} [props.items[].icon] - Action leading icon.
 * @param {Function} props.items[].onClick - Action execution callback.
 * @param {boolean} [props.items[].isDestructive=false] - Whether action is destructive (renders red).
 * @param {string} [props.items[].confirmTitle] - Title for confirmation dialog if confirmation required.
 * @param {string} [props.items[].confirmDescription] - Detailed explanation of action consequences.
 * @param {string} [props.items[].confirmMatchText] - Optional text required to type for confirmation.
 * @param {boolean} [props.items[].disabled=false] - Disabled state flag.
 * @param {string} [props.tooltip='Actions'] - Tooltip for the 3-dots trigger button.
 * @param {'small'|'medium'} [props.size='small'] - Button size.
 * @param {object} [props.sx={}] - Style overrides.
 * @returns {JSX.Element} Rendered Action Menu with integrated Confirmation Dialog.
 */
export const MuiActionMenu = memo(({
  items = [],
  tooltip = 'Actions',
  size = 'small',
  sx = {},
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeConfirmItem, setActiveConfirmItem] = useState(null);
  const [isEffectLoading, setIsEffectLoading] = useState(false);

  const isOpen = Boolean(anchorEl);

  const handleOpen = useCallback((event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback((event) => {
    if (event) event.stopPropagation();
    setAnchorEl(null);
  }, []);

  const handleItemClick = useCallback(
    (item) => (event) => {
      event.stopPropagation();
      handleClose();

      // If action requires confirmation, open confirmation dialog first
      if (item.confirmTitle) {
        setActiveConfirmItem(item);
      } else if (typeof item.onClick === 'function') {
        item.onClick();
      }
    },
    [handleClose]
  );

  const handleConfirmClose = useCallback(() => {
    if (!isEffectLoading) {
      setActiveConfirmItem(null);
    }
  }, [isEffectLoading]);

  const handleConfirmEffect = useCallback(async () => {
    if (!activeConfirmItem || typeof activeConfirmItem.onClick !== 'function') {
      setActiveConfirmItem(null);
      return;
    }

    try {
      setIsEffectLoading(true);
      await activeConfirmItem.onClick();
    } finally {
      setIsEffectLoading(false);
      setActiveConfirmItem(null);
    }
  }, [activeConfirmItem]);

  return (
    <>
      <Tooltip title={tooltip}>
        <IconButton
          size={size}
          aria-label={tooltip}
          aria-haspopup="true"
          aria-expanded={isOpen ? 'true' : undefined}
          onClick={handleOpen}
          sx={{
            color: 'text.secondary',
            '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
            ...sx,
          }}
        >
          <MoreVertIcon fontSize={size} />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        slotProps={{
          paper: {
            elevation: 3,
            sx: {
              borderRadius: '8px',
              minWidth: 160,
              border: 1,
              borderColor: 'divider',
              boxShadow: (theme) => `0 4px 16px ${theme.palette.action.hover}`,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.id}
            onClick={handleItemClick(item)}
            disabled={item.disabled}
            sx={{
              py: 1,
              px: 1.5,
              fontSize: '0.875rem',
              fontWeight: 500,
              color: item.isDestructive ? 'error.main' : 'text.primary',
              '&:hover': {
                bgcolor: item.isDestructive ? 'error.lighter' : 'action.hover',
              },
            }}
          >
            {item.icon && (
              <ListItemIcon
                sx={{
                  color: item.isDestructive ? 'error.main' : 'text.secondary',
                  minWidth: 32,
                }}
              >
                {item.icon}
              </ListItemIcon>
            )}
            <ListItemText primary={item.label} />
          </MenuItem>
        ))}
      </Menu>

      {/* Confirmation Dialog for destructive or sensitive action items */}
      {activeConfirmItem && (
        <MuiConfirmDialog
          open={Boolean(activeConfirmItem)}
          onClose={handleConfirmClose}
          onConfirm={handleConfirmEffect}
          title={activeConfirmItem.confirmTitle}
          description={activeConfirmItem.confirmDescription}
          confirmText={activeConfirmItem.label}
          isDestructive={Boolean(activeConfirmItem.isDestructive)}
          isLoading={isEffectLoading}
          matchConfirmationText={activeConfirmItem.confirmMatchText}
        />
      )}
    </>
  );
});

MuiActionMenu.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.element,
      onClick: PropTypes.func.isRequired,
      isDestructive: PropTypes.bool,
      confirmTitle: PropTypes.string,
      confirmDescription: PropTypes.string,
      confirmMatchText: PropTypes.string,
      disabled: PropTypes.bool,
    })
  ).isRequired,
  tooltip: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium']),
  sx: PropTypes.object,
};

export default MuiActionMenu;
