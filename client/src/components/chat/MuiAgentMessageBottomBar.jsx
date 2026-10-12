/**
 * @module components/chat/MuiAgentMessageBottomBar
 * @description Flat transparent actions deck for agent messages.
 * Adheres strictly to the Task 8.11 specifications:
 * - Strict Clipboard Copy Isolation: Copies ONLY the synthesized text response (excluding thoughts, tool JSON, and metadata).
 * - Zero Background Color Invariant: Enforces bgcolor: 'transparent !important' across idle and hover.
 * - Left Cluster: Model metadata and timestamp with optional token telemetry tooltip.
 * - Right Cluster: Text-only [Copy] with animated feedback and [Regenerate] with linear history pruning.
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
import ReplayIcon from '@mui/icons-material/Replay';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

/**
 * Normalizes model identifier to user-friendly label.
 * @param {string} rawModel
 * @returns {string} Clean model label.
 */
const formatModelName = (rawModel) => {
  if (!rawModel) return 'Operon';
  if (rawModel.includes('flash-lite')) return 'Gemini 2.5 Flash-Lite';
  if (rawModel.includes('flash')) return 'Gemini 2.5 Flash';
  if (rawModel.includes('pro')) return 'Gemini 2.5 Pro';
  return rawModel;
};

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

  const modelLabel = formatModelName(model);
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
        opacity: isStopped ? 1 : { xs: 1, sm: 0 },
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
