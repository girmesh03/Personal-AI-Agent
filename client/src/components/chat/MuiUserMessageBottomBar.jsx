/**
 * @module components/chat/MuiUserMessageBottomBar
 * @description Bottom contextual row of the user message card.
 * In Normal View Mode: Elevated action pill on hover ([Copy], [Edit], and [Expand/Collapse] chevron).
 * In Error View Mode: Replaces normal hover action pill with an Inline Warning Recovery Strip
 *                     (zero bgcolor, warning.main text/icon, [Retry], and [Edit] buttons).
 * In Edit Mode: Full-width action bar with [Attach File] on left, [Cancel] and [Send/Submit] on right.
 */

import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ReplayIcon from '@mui/icons-material/Replay';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { ATTACHMENT_CONSTANTS, AUDIO_CONSTANTS } from '../../utils/constants.js';

/**
 * Formats timestamp for display.
 * @param {string|Date} dateStr
 * @param {boolean} isEdited
 * @returns {string} Formatted timestamp string (e.g. "14:32 (edited)").
 */
const formatTimestamp = (dateStr, isEdited) => {
  if (!dateStr) return isEdited ? '(edited)' : '';
  try {
    const d = new Date(dateStr);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return isEdited ? `${time} (edited)` : time;
  } catch {
    return isEdited ? '(edited)' : '';
  }
};

/**
 * Bottom action and retry deck for User Message.
 *
 * @component MuiUserMessageBottomBar
 * @param {object} props
 * @param {string} [props.status='idle'] - Turn status ('success'|'error'|'streaming'|'idle').
 * @param {string} [props.text=''] - Message text to copy.
 * @param {boolean} [props.isEditing=false] - Whether card is in Edit Mode.
 * @param {boolean} [props.isExpanded=false] - Whether long text is expanded.
 * @param {boolean} [props.hasOverflow=false] - Whether text height exceeds clamp threshold.
 * @param {Function} [props.onToggleExpand] - Toggle expand/collapse callback.
 * @param {Function} [props.onStartEdit] - Trigger edit mode callback.
 * @param {Function} [props.onCancelEdit] - Cancel edit mode callback.
 * @param {Function} [props.onSubmitEdit] - Submit edited turn callback.
 * @param {Function} [props.onRetry] - Retry failed turn callback.
 * @param {Function} [props.onAttachFiles] - Callback receiving newly selected files.
 * @param {boolean} [props.disabledSubmit=false] - Whether submit button is disabled.
 * @param {string|Date} [props.createdAt] - Creation timestamp.
 * @param {string|Date} [props.editedAt] - Edit timestamp.
 * @returns {import('react').JSX.Element} Rendered bottom bar.
 */
export const MuiUserMessageBottomBar = ({
  status = 'idle',
  text = '',
  isEditing = false,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onRetry,
  onAttachFiles,
  disabledSubmit = false,
  createdAt,
  editedAt,
}) => {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

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

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && typeof onAttachFiles === 'function') {
      onAttachFiles(files);
    }
    // Reset file input value to allow re-attaching same file if deleted
    e.target.value = '';
  };

  // 1. EDIT MODE: Full-width action bar
  if (isEditing) {
    // Build accepted extensions list
    const acceptedExtensions = [
      ...ATTACHMENT_CONSTANTS.ALLOWED_EXTENSIONS,
      ...AUDIO_CONSTANTS.ALLOWED_EXTENSIONS,
    ].join(',');

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          mt: 1,
          pt: 1,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {/* Left: Attach file trigger */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedExtensions}
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />
          <Tooltip title="Attach files, audios, or images">
            <IconButton
              size="small"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file to message"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <AttachFileIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Right: Cancel & Send action pills */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            variant="text"
            onClick={onCancelEdit}
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              color: 'text.secondary',
              borderRadius: '8px',
              px: 1.5,
              py: 0.25,
              minWidth: 64,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            Cancel
          </Button>

          <Tooltip
            title={
              disabledSubmit
                ? 'Enter text or attach a file/image to send, and wait for any active uploads to complete.'
                : 'Save and submit edit'
            }
            arrow
            placement="top"
          >
            <span>
              <Button
                size="small"
                variant="contained"
                color="primary"
                disabled={disabledSubmit}
                onClick={onSubmitEdit}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  px: 1.75,
                  py: 0.25,
                  minWidth: 68,
                  boxShadow: 'none',
                  '&:hover': {
                    boxShadow: 'none',
                  },
                }}
              >
                Send
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>
    );
  }

  // 2. ERROR STATE VIEW MODE: Inline Warning Recovery Strip (Zero bgcolor, warning.main text)
  if (status === 'error') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          mt: 0.75,
          pt: 0.5,
          bgcolor: 'transparent',
        }}
      >
        {/* Warning Indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main' }} />
          <Typography
            variant="caption"
            sx={{
              color: 'warning.main',
              fontWeight: 500,
              fontSize: '0.75rem',
              lineHeight: 1,
            }}
          >
            Failed to complete response
          </Typography>
        </Box>

        {/* Direct Recovery Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Button
            size="small"
            variant="text"
            startIcon={<ReplayIcon sx={{ fontSize: '15px !important' }} />}
            onClick={onRetry}
            sx={{
              color: 'warning.main',
              bgcolor: 'transparent',
              textTransform: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              p: '2px 8px',
              minWidth: 0,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            Retry
          </Button>

          <Button
            size="small"
            variant="text"
            startIcon={<EditOutlinedIcon sx={{ fontSize: '15px !important' }} />}
            onClick={onStartEdit}
            sx={{
              color: 'warning.main',
              bgcolor: 'transparent',
              textTransform: 'none',
              fontSize: '0.75rem',
              fontWeight: 500,
              p: '2px 8px',
              minWidth: 0,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            Edit
          </Button>
        </Box>
      </Box>
    );
  }

  // 3. NORMAL VIEW MODE: Timestamp on left, Elevated Hover Action Pill on right
  const timeString = formatTimestamp(createdAt, Boolean(editedAt));

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 0.75,
        width: '100%',
        mt: 0.5,
        minHeight: 26,
        opacity: { xs: 1, sm: 0 },
        transition: 'opacity 150ms ease',
        '.MuiUserMessage-root:hover &': {
          opacity: 1,
        },
      }}
    >
      {/* Timestamp / Edited indicator */}
      {timeString && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            fontSize: '0.6875rem',
            userSelect: 'none',
            mr: 0.5,
          }}
        >
          {timeString}
        </Typography>
      )}

      {/* Flat action deck (zero background color, transparent icons) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          bgcolor: 'transparent',
        }}
      >
        {/* Copy button (rendered only when message text is non-empty) */}
        {Boolean(text && text.trim()) && (
          <Tooltip title={copied ? 'Copied!' : 'Copy prompt'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              aria-label="Copy prompt text"
              sx={{
                p: 0.5,
                width: 26,
                height: 26,
                minWidth: 26,
                minHeight: 26,
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
                '&:active': {
                  bgcolor: 'transparent !important',
                  backgroundColor: 'transparent !important',
                },
                '&:focus': {
                  bgcolor: 'transparent !important',
                  backgroundColor: 'transparent !important',
                },
              }}
            >
              {copied ? (
                <CheckIcon sx={{ fontSize: 15 }} />
              ) : (
                <ContentCopyIcon sx={{ fontSize: 15 }} />
              )}
            </IconButton>
          </Tooltip>
        )}

        {/* Edit button */}
        <Tooltip title="Edit prompt">
          <IconButton
            size="small"
            onClick={onStartEdit}
            aria-label="Edit prompt text"
            sx={{
              p: 0.5,
              width: 26,
              height: 26,
              minWidth: 26,
              minHeight: 26,
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
              '&:active': {
                bgcolor: 'transparent !important',
                backgroundColor: 'transparent !important',
              },
              '&:focus': {
                bgcolor: 'transparent !important',
                backgroundColor: 'transparent !important',
              },
            }}
          >
            <EditOutlinedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

MuiUserMessageBottomBar.propTypes = {
  status: PropTypes.string,
  text: PropTypes.string,
  isEditing: PropTypes.bool,
  onStartEdit: PropTypes.func,
  onCancelEdit: PropTypes.func,
  onSubmitEdit: PropTypes.func,
  onRetry: PropTypes.func,
  onAttachFiles: PropTypes.func,
  disabledSubmit: PropTypes.bool,
  createdAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  editedAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
};

export default MuiUserMessageBottomBar;
