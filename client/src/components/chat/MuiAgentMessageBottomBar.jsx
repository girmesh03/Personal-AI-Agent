/**
 * @module components/chat/MuiAgentMessageBottomBar
 * @description Flat transparent actions deck for agent messages.
 * Adheres strictly to the Task 8.11 specifications:
 * - Strict Clipboard Copy Isolation: Copies ONLY the synthesized text response (excluding thoughts, tool JSON, and metadata).
 * - Zero Background Color Invariant: Enforces bgcolor: 'transparent !important' across idle and hover.
 * - Left Cluster: Model metadata and timestamp with optional token telemetry tooltip.
 * - Right Cluster: Text-only [Copy] with animated feedback and [Regenerate] with linear history pruning.
 */

import { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import PropTypes from 'prop-types';
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
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ReplayIcon from '@mui/icons-material/Replay';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TelegramIcon from '@mui/icons-material/Telegram';
import { toast } from 'react-toastify';
import { useShareTelegramMutation } from '../../redux/features/chatSlice.js';
import { formatModelDisplayName } from '../../utils/constants.js';

/**
 * Formats timestamp for display.
 * @param {string|Date} dateStr
 * @returns {string} Formatted timestamp string (e.g. "14:35").
 */
const formatTimestamp = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

/**
 * Flat transparent bottom action bar for agent turns.
 *
 * @component MuiAgentMessageBottomBar
 * @param {object} props
 * @param {string} [props.text=''] - Pure synthesized text to copy.
 * @param {string} [props.model] - Model name used for generation.
 * @param {object} [props.usage] - Token usage telemetry metadata.
 * @param {string|Date} [props.createdAt] - Creation timestamp.
 * @param {Function} [props.onRegenerate] - Callback to trigger turn regeneration.
 * @param {Function} [props.onContinue] - Callback to continue interrupted generation.
 * @param {boolean} [props.isStreaming=false] - Whether response is actively generating.
 * @param {boolean} [props.isStopped=false] - Whether response was interrupted by user stop.
 * @returns {import('react').JSX.Element} Rendered action bar.
 */
export const MuiAgentMessageBottomBar = ({
  text = '',
  model,
  usage,
  createdAt,
  onRegenerate,
  onContinue,
  isStreaming = false,
  isStopped = false,
}) => {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef(null);

  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const telegram = user?.integrations?.telegram || {};
  const isTelegramConnected = Boolean(telegram.connected);
  const isTelegramEnabled = telegram.enabled !== false;

  const [shareTelegram] = useShareTelegramMutation();
  const [telegramAnchor, setTelegramAnchor] = useState(null);
  const [telegramFormat, setTelegramFormat] = useState(telegram.defaultFormat || 'text');
  const [sharingChannel, setSharingChannel] = useState(null);

  useEffect(() => {
    if (telegram.defaultFormat) {
      setTelegramFormat(telegram.defaultFormat);
    }
  }, [telegram.defaultFormat]);

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

  const handleOpenTelegram = (e) => {
    setTelegramAnchor(e.currentTarget);
  };

  const handleCloseTelegram = () => {
    setTelegramAnchor(null);
  };

  const handleShareToTelegramChannel = async (channel) => {
    if (!text || sharingChannel) return;
    setSharingChannel(channel);
    try {
      const res = await shareTelegram({
        text,
        targetChannel: channel,
        asImage: telegramFormat === 'image',
      }).unwrap();

      const modeLabel = telegramFormat === 'image' ? 'Image Card' : 'Text';
      toast.success(`Dispatched to Telegram: ${channel} [${modeLabel}]`);
      handleCloseTelegram();
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Telegram dispatch failed');
    } finally {
      setSharingChannel(null);
    }
  };

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Fallback
    }
  };

  const modelLabel = formatModelDisplayName(model);
  const timeLabel = formatTimestamp(createdAt);

  const usageTooltip =
    usage && usage.totalTokens
      ? `Tokens: ${usage.totalTokens} (Prompt: ${usage.promptTokens || 0}, Completion: ${usage.candidatesTokens || 0})`
      : '';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 1.25,
        width: '100%',
        mt: 0.5,
        pt: 0.5,
        userSelect: 'none',
        opacity: isStopped || Boolean(telegramAnchor) ? 1 : { xs: 1, sm: 0 },
        transition: 'opacity 150ms ease',
        '.MuiAgentMessage-root:hover &': {
          opacity: 1,
        },
      }}
    >
      {/* 1. Action Buttons Cluster (Left-Aligned) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {/* Continue Generating Button (Rendered when stream was stopped by user and partial text exists) */}
        {isStopped && typeof onContinue === 'function' && Boolean(text && text.trim()) && (
          <Tooltip title="Continue generation from interruption point">
            <Button
              size="small"
              variant="outlined"
              startIcon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
              onClick={onContinue}
              sx={{
                color: 'primary.main',
                borderColor: 'primary.main',
                borderRadius: '8px',
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                py: '2px',
                px: 1,
                minHeight: 24,
                bgcolor: 'transparent !important',
                backgroundColor: 'transparent !important',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              Continue Generating
            </Button>
          </Tooltip>
        )}

        {/* Retry Button: prominent labeled button if stopped before text, or compact icon button */}
        {typeof onRegenerate === 'function' && (
          isStopped && (!text || !text.trim()) ? (
            <Tooltip title="Retry generation">
              <Button
                size="small"
                variant="outlined"
                startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
                onClick={onRegenerate}
                sx={{
                  color: 'primary.main',
                  borderColor: 'primary.main',
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  py: '2px',
                  px: 1,
                  minHeight: 24,
                  bgcolor: 'transparent !important',
                  backgroundColor: 'transparent !important',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                Retry
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title="Regenerate response">
              <span>
                <IconButton
                  size="small"
                  onClick={onRegenerate}
                  disabled={isStreaming}
                  aria-label="Regenerate response"
                  sx={{
                    p: 0.5,
                    color: 'text.secondary',
                    bgcolor: 'transparent !important',
                    backgroundColor: 'transparent !important',
                    boxShadow: 'none !important',
                    border: 'none !important',
                    '&:hover': {
                      color: 'text.primary',
                      bgcolor: 'transparent !important',
                      backgroundColor: 'transparent !important',
                    },
                    '&:disabled': {
                      color: 'text.disabled',
                      bgcolor: 'transparent !important',
                      backgroundColor: 'transparent !important',
                    },
                  }}
                >
                  <ReplayIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          )
        )}

        {/* Copy Response (Text Only) */}
        {Boolean(text && text.trim()) && (
          <Tooltip title={copied ? 'Copied!' : 'Copy response'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              aria-label="Copy response text"
              sx={{
                p: 0.5,
                color: copied ? 'success.main' : 'text.secondary',
                bgcolor: 'transparent !important',
                backgroundColor: 'transparent !important',
                boxShadow: 'none !important',
                border: 'none !important',
                '&:hover': {
                  color: 'text.primary',
                  bgcolor: 'transparent !important',
                  backgroundColor: 'transparent !important',
                },
              }}
            >
              {copied ? (
                <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
              ) : (
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        )}

        {/* Share to Telegram */}
        {Boolean(text && text.trim()) && (
          <>
            <Tooltip title="Share to Telegram">
              <span>
                <IconButton
                  size="small"
                  onClick={handleOpenTelegram}
                  disabled={isStreaming}
                  aria-label="Share to Telegram"
                  sx={{
                    p: 0.5,
                    color: 'text.secondary',
                    bgcolor: 'transparent !important',
                    backgroundColor: 'transparent !important',
                    boxShadow: 'none !important',
                    border: 'none !important',
                    '&:hover': {
                      color: '#2AABEE',
                      bgcolor: 'transparent !important',
                      backgroundColor: 'transparent !important',
                    },
                    '&:disabled': {
                      color: 'text.disabled',
                      bgcolor: 'transparent !important',
                      backgroundColor: 'transparent !important',
                    },
                  }}
                >
                  <TelegramIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>

            <Popover
              open={Boolean(telegramAnchor)}
              anchorEl={telegramAnchor}
              onClose={handleCloseTelegram}
              disableEnforceFocus={true}
              disableRestoreFocus={true}
              anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              slotProps={{
                paper: {
                  sx: {
                    p: 1.5,
                    width: 260,
                    borderRadius: 2,
                    boxShadow: 4,
                    border: 1,
                    borderColor: 'divider',
                    backgroundImage: 'none',
                    mb: 1,
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
                <TelegramIcon sx={{ fontSize: 18, color: '#2AABEE' }} />
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                  Share to Telegram
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
                    onClick={() => {
                      handleCloseTelegram();
                      navigate('/profile?tab=telegram');
                    }}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Configure Telegram
                  </Button>
                </Box>
              ) : (
                <>
                  <ToggleButtonGroup
                    value={telegramFormat}
                    exclusive
                    onChange={(_e, val) => val && setTelegramFormat(val)}
                    size="small"
                    fullWidth
                    sx={{ mb: 1 }}
                  >
                    <ToggleButton value="text" sx={{ fontSize: '0.75rem', py: 0.3 }}>
                      Text (HTML)
                    </ToggleButton>
                    <ToggleButton value="image" sx={{ fontSize: '0.75rem', py: 0.3 }}>
                      Image Card
                    </ToggleButton>
                  </ToggleButtonGroup>

                  <Divider sx={{ my: 0.8 }} />

                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    Select Channel:
                  </Typography>

                  <MenuList disablePadding>
                    {telegramChannels.map((item) => {
                      const isDisabled = !item.configured || Boolean(sharingChannel);
                      const menuItem = (
                        <MenuItem
                          key={item.id}
                          onClick={() => item.configured && handleShareToTelegramChannel(item.id)}
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
                            <CircularProgress size={12} sx={{ ml: 1 }} />
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
        )}
      </Box>

      {/* 2. Identity & Time Cluster (Left-Aligned alongside Action Buttons): [Icon + Model + timestamp] */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flexShrink: 1 }}>
        <Tooltip title={usageTooltip ? `${modelLabel} • ${usageTooltip}` : modelLabel} arrow>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <AutoAwesomeOutlinedIcon sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }} />
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.75rem',
                color: 'text.secondary',
                fontWeight: 500,
                maxWidth: { xs: 110, sm: 220 },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
                verticalAlign: 'middle',
              }}
            >
              {modelLabel}
            </Typography>
          </Box>
        </Tooltip>

        {timeLabel && (
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.75rem',
              color: 'text.disabled',
              flexShrink: 0,
            }}
          >
            • {timeLabel}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

MuiAgentMessageBottomBar.propTypes = {
  text: PropTypes.string,
  model: PropTypes.string,
  usage: PropTypes.shape({
    promptTokens: PropTypes.number,
    candidatesTokens: PropTypes.number,
    totalTokens: PropTypes.number,
  }),
  createdAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  onRegenerate: PropTypes.func,
  onContinue: PropTypes.func,
  isStreaming: PropTypes.bool,
  isStopped: PropTypes.bool,
};

export default MuiAgentMessageBottomBar;
