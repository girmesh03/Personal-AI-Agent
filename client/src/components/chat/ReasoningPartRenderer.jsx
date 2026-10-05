/**
 * @module components/chat/ReasoningPartRenderer
 * @description Specialized reasoning/thinking part renderer for AI streaming chat.
 * Renders an accessible collapsible thought accordion (OperonThoughtAccordion) that
 * remains auto-expanded with a live elapsed timer and pulsing indicator while reasoning,
 * and automatically collapses to a concise summary when streaming finishes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PsychologyIcon from '@mui/icons-material/Psychology';
import CheckIcon from '@mui/icons-material/Check';
import { toast } from 'react-toastify';

/**
 * Operon Reasoning Part Renderer Component.
 *
 * @component ReasoningPartRenderer
 * @param {object} props - Component props.
 * @param {{ type: string, text: string, state?: 'streaming'|'done' }} props.part - Reasoning message part.
 * @param {boolean} [props.defaultExpanded] - Initial accordion expanded state.
 * @returns {import('react').JSX.Element|null} Rendered component.
 */
export const ReasoningPartRenderer = ({ part, defaultExpanded }) => {
  const isStreaming = part?.state === 'streaming';
  const thoughtText = part?.text || '';

  // Track accordion expansion state (auto-expanded during streaming, collapsed on done)
  const [expanded, setExpanded] = useState(defaultExpanded ?? isStreaming);
  const [copied, setCopied] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const startTimeRef = useRef(0);
  const prevStreamingRef = useRef(isStreaming);

  // Live timer while actively streaming thought deltas
  useEffect(() => {
    if (isStreaming) {
      if (startTimeRef.current === 0) {
        startTimeRef.current = Date.now();
      }
      const interval = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isStreaming]);

  // Auto-collapse when streaming transitions from true to false
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      setExpanded(false);
    } else if (!prevStreamingRef.current && isStreaming) {
      setExpanded(true);
      startTimeRef.current = Date.now();
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Handle manual user toggle
  const handleToggle = useCallback((event, isExpanded) => {
    setExpanded(isExpanded);
  }, []);

  // Copy thought trace to clipboard
  const handleCopy = useCallback(
    async (event) => {
      event.stopPropagation();
      if (!thoughtText.trim()) return;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(thoughtText.trim());
        }
        setCopied(true);
        toast.success('Reasoning trace copied to clipboard.');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error('Failed to copy reasoning trace.');
      }
    },
    [thoughtText]
  );

  if (!thoughtText && !isStreaming) {
    return null;
  }

  const durationSec = (elapsedMs / 1000).toFixed(1);
  const titleLabel = isStreaming
    ? `Reasoning... (${durationSec}s)`
    : elapsedMs > 0
      ? `Thought for ${durationSec}s`
      : 'Thought process';

  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expanded}
      onChange={handleToggle}
      slotProps={{
        transition: { unmountOnExit: true },
      }}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px !important',
        bgcolor: 'action.hover',
        mb: 1.5,
        '&:before': { display: 'none' },
        overflow: 'hidden',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
        sx={{
          minHeight: 38,
          px: 1.5,
          py: 0.5,
          '& .MuiAccordionSummary-content': {
            my: 0.5,
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'space-between',
            pr: 1,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PsychologyIcon
            sx={{
              fontSize: 18,
              color: isStreaming ? 'primary.main' : 'text.secondary',
            }}
          />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: isStreaming ? 'primary.main' : 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
            }}
          >
            {titleLabel}
            {isStreaming && (
              <Box
                component="span"
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'inline-block',
                  animation: 'pulsingDot 1.2s infinite ease-in-out',
                  '@keyframes pulsingDot': {
                    '0%': { opacity: 0.3, transform: 'scale(0.8)' },
                    '50%': { opacity: 1, transform: 'scale(1.2)' },
                    '100%': { opacity: 0.3, transform: 'scale(0.8)' },
                  },
                }}
              />
            )}
          </Typography>
        </Box>

        {thoughtText && (
          <Tooltip title={copied ? 'Copied!' : 'Copy thought trace'} arrow>
            <IconButton
              size="small"
              onClick={handleCopy}
              aria-label="Copy reasoning text"
              sx={{ p: 0.5, color: 'text.secondary' }}
            >
              {copied ? (
                <CheckIcon sx={{ fontSize: 15, color: 'success.main' }} />
              ) : (
                <ContentCopyIcon sx={{ fontSize: 15 }} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </AccordionSummary>

      <AccordionDetails
        sx={{
          px: 1.5,
          pt: 0.5,
          pb: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography
          variant="body2"
          component="pre"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            color: 'text.secondary',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            m: 0,
            lineHeight: 1.5,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {thoughtText}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
};

ReasoningPartRenderer.propTypes = {
  part: PropTypes.shape({
    type: PropTypes.string.isRequired,
    text: PropTypes.string,
    state: PropTypes.oneOf(['streaming', 'done']),
  }).isRequired,
  defaultExpanded: PropTypes.bool,
};

export default ReasoningPartRenderer;
