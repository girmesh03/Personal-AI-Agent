/**
 * @module components/chat/MuiReasoningAccordion
 * @description Collapsible accordion rendering the agent's deliberative reasoning (brain thought stream).
 * Adheres strictly to the Task 8.11 specifications:
 * - Default expanded with live elapsed timer ("Thinking... (X.Xs)") while streaming.
 * - Automatically collapses when complete ("Thought for X.Xs") with clean manual toggle.
 * - Minimal, dignified, neutral aesthetic with zero saturated fills.
 * - Excluded from response copy targets.
 */

import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

/**
 * Deliberative reasoning thought stream accordion.
 *
 * @component MuiReasoningAccordion
 * @param {object} props
 * @param {string} [props.text=''] - Raw thinking / reasoning text content.
 * @param {string} [props.state='done'] - Stream state ('streaming' | 'done').
 * @returns {import('react').JSX.Element|null} Rendered reasoning accordion.
 */
export const MuiReasoningAccordion = ({ text = '', state = 'done' }) => {
  const isStreaming = state === 'streaming';
  const [isExpanded, setIsExpanded] = useState(isStreaming);
  const [elapsedSeconds, setElapsedSeconds] = useState('0.0');
  const startTimeRef = useRef(null);

  // Auto-expand on streaming start; auto-collapse on streaming finish if user hasn't intervened
  const userToggledRef = useRef(false);

  useEffect(() => {
    if (isStreaming) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      if (!userToggledRef.current) {
        setIsExpanded(true);
      }
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          const sec = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
          setElapsedSeconds(sec);
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      if (!userToggledRef.current) {
        setIsExpanded(false);
      }
      if (startTimeRef.current) {
        const sec = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
        setElapsedSeconds(sec);
      }
    }
  }, [isStreaming]);

  if (!text && !isStreaming) return null;

  const handleToggle = () => {
    userToggledRef.current = true;
    setIsExpanded((prev) => !prev);
  };

  const labelText = isStreaming
    ? `Thinking... (${elapsedSeconds}s)`
    : `Thought for ${elapsedSeconds}s`;

  return (
    <Box
      sx={{
        width: '100%',
        border: 1,
        borderColor: 'divider',
        borderRadius: '12px',
        bgcolor: 'transparent',
        overflow: 'hidden',
        mb: 1.5,
        transition: 'border-color 0.2s ease',
        '&:hover': {
          borderColor: 'text.disabled',
        },
      }}
    >
      {/* Header affordance */}
      <Box
        component="button"
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label="Toggle reasoning details"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          p: '7px 12px',
          bgcolor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          userSelect: 'none',
          outline: 'none',
          '&:focus-visible': {
            outline: (theme) => `2px solid ${theme.palette.primary.main}`,
            outlineOffset: -2,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PsychologyOutlinedIcon
            sx={{
              fontSize: 18,
              color: isStreaming ? 'primary.main' : 'text.secondary',
              animation: isStreaming ? 'pulseBrain 1.8s infinite ease-in-out' : 'none',
              '@keyframes pulseBrain': {
                '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                '50%': { opacity: 0.65, transform: 'scale(1.08)' },
              },
            }}
          />
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: isStreaming ? 'text.primary' : 'text.secondary',
            }}
          >
            {labelText}
          </Typography>
        </Box>

        <ExpandMoreIcon
          sx={{
            fontSize: 18,
            color: 'text.secondary',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </Box>

      {/* Collapsible thought stream body */}
      <Collapse in={isExpanded} timeout="auto" unmountOnExit={false}>
        <Box
          sx={{
            p: '8px 12px 12px 12px',
            borderTop: 1,
            borderColor: 'divider',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          <Typography
            component="div"
            sx={{
              fontSize: '0.8125rem',
              lineHeight: 1.6,
              color: 'text.secondary',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'monospace, sans-serif',
              userSelect: 'text',
            }}
          >
            {text || (isStreaming ? 'Synthesizing deliberative strategy...' : '')}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
};

MuiReasoningAccordion.propTypes = {
  text: PropTypes.string,
  state: PropTypes.oneOf(['streaming', 'done']),
};

export default MuiReasoningAccordion;
