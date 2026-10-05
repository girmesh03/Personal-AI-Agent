/**
 * @module components/chat/MessageActionsBar
 * @description Action toolbar rendered for user and assistant chat message turns.
 * Enforces the Strict Clipboard Boundary Engine (copying strictly pure text, omitting
 * IDs, timestamps, reasoning notes, and tool badges) and supports inline editing
 * and assistant turn regeneration.
 */

import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckIcon from '@mui/icons-material/Check';
import { toast } from 'react-toastify';

/**
 * Operon Message Actions Bar Component.
 *
 * @component MessageActionsBar
 * @param {object} props - Component props.
 * @param {import('@mui/x-chat-headless').ChatMessage} [props.message] - Target message entity.
 * @param {boolean} [props.isStreaming=false] - Whether a stream is currently active.
 * @param {(message: object) => void} [props.onEdit] - Callback to trigger turn editing.
 * @param {(message: object) => void} [props.onRetry] - Callback to trigger turn regeneration.
 * @returns {import('react').JSX.Element|null} Rendered component.
 */
export const MessageActionsBar = ({
  message,
  isStreaming = false,
  onEdit,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);

  const isUser = message?.role === 'user';
  const isAssistant = message?.role === 'assistant';

  // Extract pure text content adhering strictly to the Strict Clipboard Boundary Law
  const getPureText = useCallback(() => {
    if (!message) return '';
    const textPart = (message.parts || []).find((p) => p.type === 'text');
    return (textPart?.text || '').trim();
  }, [message]);

  // Handle clipboard copy
  const handleCopy = useCallback(async () => {
    const pureText = getPureText();
    if (!pureText) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(pureText);
      }
      setCopied(true);
      const label = isUser ? 'User prompt' : 'Assistant response';
      toast.success(`${label} copied to clipboard.`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy message text.');
    }
  }, [getPureText, isUser]);

  // Handle edit trigger
  const handleEdit = useCallback(() => {
    if (onEdit && message) {
      onEdit(message);
    }
  }, [onEdit, message]);

  // Handle retry trigger
  const handleRetry = useCallback(() => {
    if (onRetry && !isStreaming && message) {
      onRetry(message);
    }
  }, [onRetry, message, isStreaming]);

  if (!message) {
    return null;
  }

  const pureText = getPureText();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        mt: 0.5,
        opacity: { xs: 1, sm: 0.8 },
        transition: 'opacity 0.2s ease',
        '&:hover': {
          opacity: 1,
        },
      }}
    >
      {/* Action 1: Copy Pure Text */}
      {pureText && (
        <Tooltip title={copied ? 'Copied!' : isUser ? 'Copy prompt' : 'Copy response'} arrow>
          <IconButton
            size="small"
            onClick={handleCopy}
            aria-label={isUser ? 'Copy prompt text' : 'Copy response text'}
            sx={{ p: 0.5, color: 'text.secondary' }}
          >
            {copied ? (
              <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
            ) : (
              <ContentCopyIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      )}

      {/* Action 2: User Turn Edit */}
      {isUser && onEdit && (
        <Tooltip title="Edit prompt" arrow>
          <IconButton
            size="small"
            onClick={handleEdit}
            disabled={isStreaming}
            aria-label="Edit message"
            sx={{ p: 0.5, color: 'text.secondary' }}
          >
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* Action 3: Assistant Turn Retry */}
      {isAssistant && onRetry && (
        <Tooltip title={isStreaming ? 'Generating response...' : 'Retry response'} arrow>
          <span>
            <IconButton
              size="small"
              onClick={handleRetry}
              disabled={isStreaming}
              aria-label="Retry response"
              sx={{ p: 0.5, color: 'text.secondary' }}
            >
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
  );
};

MessageActionsBar.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string,
    role: PropTypes.string,
    parts: PropTypes.array,
  }),
  isStreaming: PropTypes.bool,
  onEdit: PropTypes.func,
  onRetry: PropTypes.func,
};

export default MessageActionsBar;
