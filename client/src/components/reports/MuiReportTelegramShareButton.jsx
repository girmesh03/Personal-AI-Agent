/**
 * @module components/reports/MuiReportTelegramShareButton
 * @description Self-contained, reusable Telegram report sharing component.
 * Features:
 * - Direct popover action deck matching enterprise chat & report delivery specs.
 * - Format selector: Semantic Text (HTML) vs High-Fidelity Image Card.
 * - Multi-channel selection: Management, Maintenance & Facilities, and General Operations.
 * - Telegram integration health check with direct navigation to Profile configuration.
 * - Fully decoupled from chat routes; executes against Report SSOT (/api/v1/reports/:id/share/telegram).
 */

import { useState, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import TelegramIcon from '@mui/icons-material/Telegram';
import { toast } from 'react-toastify';

import { useShareReportToTelegramMutation } from '../../redux/features/reportSlice.js';

/**
 * Reusable Telegram report broadcast button.
 *
 * @component MuiReportTelegramShareButton
 * @param {object} props
 * @param {object|string} props.report - Operational report object or report ID.
 * @param {'small'|'medium'|'large'} [props.size='small'] - IconButton size.
 * @param {boolean} [props.disabled=false] - Whether button is disabled.
 * @param {object} [props.sx] - Additional MUI styling overrides.
 * @returns {import('react').JSX.Element} Rendered Telegram share button and modal popover.
 */
export const MuiReportTelegramShareButton = memo(({
  report,
  size = 'small',
  disabled = false,
  variant = 'icon',
  label = 'Share',
  buttonVariant = 'outlined',
  sx = {},
}) => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const telegram = user?.integrations?.telegram || {};
  const isTelegramConnected = Boolean(telegram.connected);
  const isTelegramEnabled = telegram.enabled !== false;

  const [shareReportToTelegram] = useShareReportToTelegramMutation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [userSelectedFormat, setUserSelectedFormat] = useState(null);
  const telegramFormat = userSelectedFormat || telegram.defaultFormat || 'text';
  const [sharingChannel, setSharingChannel] = useState(null);

  const reportId = typeof report === 'string' ? report : (report?._id || report?.id);

  const telegramChannels = [
    {
      id: 'management',
      label: 'Management (Default)',
      configured: Boolean(telegram.managementChatId),
    },
    {
      id: 'maintenance',
      label: 'Maintenance & Facilities',
      configured: Boolean(telegram.maintenanceChatId),
    },
    {
      id: 'general',
      label: 'General Operations',
      configured: Boolean(telegram.generalChatId),
    },
  ];

  const handleOpen = useCallback((e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  }, []);

  const handleClose = useCallback((e) => {
    if (e) e.stopPropagation();
    setAnchorEl(null);
  }, []);

  const handleShareToChannel = useCallback(async (channel, e) => {
    if (e) e.stopPropagation();
    if (!reportId || sharingChannel) return;

    setSharingChannel(channel);
    try {
      const res = await shareReportToTelegram({
        reportId,
        targetChannel: channel,
        asImage: telegramFormat === 'image',
      }).unwrap();

      const modeLabel = telegramFormat === 'image' ? 'Image Card' : 'Text';
      toast.success(res?.message || `Dispatched report to Telegram: ${channel} [${modeLabel}]`);
      setAnchorEl(null);
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Telegram report dispatch failed');
    } finally {
      setSharingChannel(null);
    }
  }, [reportId, sharingChannel, shareReportToTelegram, telegramFormat]);

  const isPopoverOpen = Boolean(anchorEl);

  return (
    <>
      {variant === 'button' ? (
        <Button
          variant={buttonVariant}
          size={size}
          onClick={handleOpen}
          disabled={disabled || !reportId}
          startIcon={<TelegramIcon fontSize="small" sx={{ color: '#2AABEE' }} />}
          aria-label="share report to telegram"
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.8rem',
            borderRadius: '8px',
            color: '#2AABEE',
            borderColor: 'divider',
            ...sx,
          }}
        >
          {label}
        </Button>
      ) : (
        <Tooltip title="Share to Telegram" arrow>
          <span>
            <IconButton
              size={size}
              onClick={handleOpen}
              disabled={disabled || !reportId}
              aria-label="share report to telegram"
              sx={{
                color: isPopoverOpen ? '#2AABEE' : 'text.secondary',
                transition: 'color 0.2s ease, transform 0.15s ease',
                '&:hover': {
                  color: '#2AABEE',
                  transform: 'scale(1.08)',
                },
                ...sx,
              }}
            >
              <TelegramIcon fontSize={size === 'small' ? 'small' : 'medium'} />
            </IconButton>
          </span>
        </Tooltip>
      )}

      <Popover
        open={isPopoverOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        disableEnforceFocus={true}
        disableRestoreFocus={true}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              width: 270,
              borderRadius: 2,
              boxShadow: 4,
              border: 1,
              borderColor: 'divider',
              backgroundImage: 'none',
              mt: 0.5,
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
          <TelegramIcon sx={{ fontSize: 18, color: '#2AABEE' }} />
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            Share Report to Telegram
          </Typography>
        </Box>

        {!isTelegramConnected || !isTelegramEnabled ? (
          <Box sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 1.5 }}>
              {!isTelegramConnected
                ? 'Telegram bot integration is not connected.'
                : 'Telegram integration is currently paused.'}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
                navigate('/profile?tab=telegram');
              }}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              Configure Telegram
            </Button>
          </Box>
        ) : (
          <>
            <ToggleButtonGroup
              value={telegramFormat}
              exclusive
              onChange={(_e, val) => val && setUserSelectedFormat(val)}
              size="small"
              fullWidth
              sx={{ mb: 1 }}
            >
              <ToggleButton value="text" sx={{ fontSize: '0.75rem', py: 0.3, textTransform: 'none' }}>
                Text (HTML)
              </ToggleButton>
              <ToggleButton value="image" sx={{ fontSize: '0.75rem', py: 0.3, textTransform: 'none' }}>
                Image Card
              </ToggleButton>
            </ToggleButtonGroup>

            <Divider sx={{ my: 0.8 }} />

            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
              Select Broadcast Channel:
            </Typography>

            <MenuList disablePadding>
              {telegramChannels.map((item) => {
                const isDisabled = !item.configured || Boolean(sharingChannel);
                const menuItem = (
                  <MenuItem
                    key={item.id}
                    onClick={(e) => item.configured && handleShareToChannel(item.id, e)}
                    disabled={isDisabled}
                    sx={{
                      fontSize: '0.8125rem',
                      borderRadius: 1,
                      py: 0.6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: item.configured ? 1 : 0.6,
                    }}
                  >
                    <span>{item.label}</span>
                    {sharingChannel === item.id ? (
                      <CircularProgress size={12} sx={{ ml: 1, color: '#2AABEE' }} />
                    ) : !item.configured ? (
                      <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                        Not set
                      </Typography>
                    ) : null}
                  </MenuItem>
                );

                if (!item.configured) {
                  return (
                    <Tooltip key={item.id} title="Chat ID not configured in Profile > Telegram" arrow placement="left">
                      <span>{menuItem}</span>
                    </Tooltip>
                  );
                }

                return menuItem;
              })}
            </MenuList>
          </>
        )}
      </Popover>
    </>
  );
});

MuiReportTelegramShareButton.displayName = 'MuiReportTelegramShareButton';

MuiReportTelegramShareButton.propTypes = {
  report: PropTypes.oneOfType([PropTypes.object, PropTypes.string]).isRequired,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  variant: PropTypes.oneOf(['icon', 'button']),
  label: PropTypes.string,
  buttonVariant: PropTypes.oneOf(['outlined', 'contained', 'text']),
  sx: PropTypes.object,
};

export default MuiReportTelegramShareButton;
