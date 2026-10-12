/**
 * @module components/chat/MuiAgentExecutionTimeline
 * @description Single Frameless Vertical Timeline Accordion for agent turns in Operon AI Chat.
 * Combines Row 1 (Deliberative Reasoning) and Row 2 (Autonomous Tool Executions) into a single unified component.
 *
 * Adheres strictly to user architecture requirements:
 * - Single expandable accordion with zero outline and zero background color.
 * - First-line header affordance: ONE line, ALL LEFT-ALIGNED including chevron '>':
 *   [Icon] Operon [...] [timestamp] >
 * - Permanent static anchor: [Icon] Operon is ALWAYS present on the left.
 * - Dynamic trailing payload: dynamically tracks real-time pipeline stages:
 *   uploading -> transcribing -> processing docs -> thinking timer -> tool calls -> settled summary + timestamp.
 * - Zero horizontal overflow (overflowX: hidden) on mobile xs (360px-375px) via textOverflow: 'ellipsis'.
 * - Internal vertical timeline: continuous track (divider) connecting deliberative thought bullet nodes,
 *   multi-modal pipeline stages, and tool execution icon nodes with 1-click JSON inspector.
 * - Strictly theme tokens only (no hardcoded external colors).
 */

import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import { MuiToolCallPart } from './MuiToolCallPart.jsx';

/**
 * Formats timestamp for display (e.g. "06:06 PM").
 * @param {string|Date} dateStr
 * @returns {string} Formatted time string.
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
 * Single Frameless Vertical Timeline Accordion.
 *
 * @component MuiAgentExecutionTimeline
 * @param {object} props
 * @param {Array} [props.reasoningParts=[]] - Deliberative thought stream parts.
 * @param {Array} [props.toolParts=[]] - Autonomous tool call parts.
 * @param {string} [props.pipelineStatus=''] - Real-time pipeline stage string.
 * @param {boolean} [props.isStreaming=false] - Whether response is actively generating.
 * @param {string|Date} [props.createdAt] - Creation timestamp of the turn.
 * @param {string} [props.thoughtDuration] - Persisted measured thought duration in seconds.
 * @param {boolean} [props.hasTextStarted=false] - Whether response text has begun streaming.
 * @returns {import('react').JSX.Element} Rendered single accordion timeline.
 */
export const MuiAgentExecutionTimeline = ({
  reasoningParts = [],
  toolParts = [],
  pipelineStatus = '',
  isStreaming = false,
  isStopped = false,
  createdAt,
  thoughtDuration,
  hasTextStarted = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const initialDuration = thoughtDuration && thoughtDuration !== '0.0' ? thoughtDuration : '0.0';
  const [elapsedSeconds, setElapsedSeconds] = useState(initialDuration);
  const startTimeRef = useRef(null);

  // Track reasoning duration timer during streaming
  useEffect(() => {
    if (isStreaming) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          const sec = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
          setElapsedSeconds(sec);
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      if (startTimeRef.current) {
        const sec = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
        setElapsedSeconds(sec);
      } else if (thoughtDuration && thoughtDuration !== '0.0') {
        setElapsedSeconds(thoughtDuration);
      }
    }
  }, [isStreaming, thoughtDuration]);

  const hasReasoning = reasoningParts.length > 0 && reasoningParts.some((rp) => rp.text && rp.text.trim());
  const hasTools = toolParts.length > 0;
  const hasTimelineContent = hasReasoning || hasTools;

  const handleToggle = () => {
    if (hasTimelineContent) {
      setIsExpanded((prev) => !prev);
    }
  };

  // Derive dynamic status label after invariant [Icon] Operon
  const displayDuration =
    thoughtDuration && thoughtDuration !== '0.0'
      ? thoughtDuration
      : elapsedSeconds !== '0.0'
        ? elapsedSeconds
        : null;

  let dynamicStatusText = '';
  if (pipelineStatus) {
    dynamicStatusText = pipelineStatus;
  } else if (isStreaming) {
    if (hasReasoning && !hasTextStarted) {
      // Actively thinking before text output starts
      dynamicStatusText = `Thinking... ${elapsedSeconds}s`;
    } else if (hasTools) {
      const activeTool = toolParts[toolParts.length - 1]?.toolInvocation?.toolName || 'tool';
      dynamicStatusText = `Executing ${activeTool}...`;
    } else {
      // Actively streaming text response or initial handshake: zero fake thinking!
      dynamicStatusText = '';
    }
  } else if (isStopped) {
    dynamicStatusText = hasTimelineContent
      ? (displayDuration ? `Thought for ${displayDuration}s • Stopped` : 'Stopped')
      : 'Generation stopped';
  } else if (hasTimelineContent) {
    if (hasReasoning && hasTools) {
      dynamicStatusText = displayDuration
        ? `Thought for ${displayDuration}s • ${toolParts.length} operation${toolParts.length > 1 ? 's' : ''} executed`
        : `Thought • ${toolParts.length} operation${toolParts.length > 1 ? 's' : ''} executed`;
    } else if (hasReasoning) {
      dynamicStatusText = displayDuration ? `Thought for ${displayDuration}s` : 'Thought process';
    } else if (hasTools) {
      dynamicStatusText = `${toolParts.length} operation${toolParts.length > 1 ? 's' : ''} executed`;
    }
  }

  const timeString = formatTimestamp(createdAt || new Date());

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        bgcolor: 'transparent !important',
        backgroundColor: 'transparent !important',
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        p: 0,
        m: 0,
        mb: 1,
      }}
    >
      {/* FIRST-LINE HEADER AFFORDANCE: ONE LINE, ALL LEFT-ALIGNED INCLUDING CHEVRON '>', NO OVERFLOW-X ON XS */}
      <Box
        component="button"
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label="Toggle execution timeline details"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 0.75,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          border: 'none !important',
          outline: 'none !important',
          bgcolor: 'transparent !important',
          backgroundColor: 'transparent !important',
          boxShadow: 'none !important',
          p: 0,
          m: 0,
          cursor: hasTimelineContent ? 'pointer' : 'default',
          userSelect: 'none',
          textAlign: 'left',
          '&:hover': {
            opacity: hasTimelineContent ? 0.85 : 1,
          },
        }}
      >
        {/* 1. Icon (Permanent static anchor on the left) */}
        {isStreaming ? (
          <CircularProgress
            size={14}
            thickness={4}
            sx={{ color: 'primary.main', flexShrink: 0 }}
          />
        ) : (
          <AutoAwesomeOutlinedIcon
            sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }}
          />
        )}

        {/* 2. Brand Label (Permanent static anchor on the left) */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            fontSize: '0.875rem',
            flexShrink: 0,
          }}
        >
          Operon
        </Typography>

        {/* 3. Dynamic Real-Time Pipeline Stage Tracking [...] */}
        {dynamicStatusText && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontSize: '0.8125rem',
              flexShrink: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: { xs: 160, sm: 340, md: 520 },
            }}
          >
            [{dynamicStatusText}]
          </Typography>
        )}

        {/* 4. Timestamp (Subtle inline timestamp) */}
        {timeString && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.disabled',
              fontSize: '0.75rem',
              flexShrink: 0,
              ml: 0.25,
            }}
          >
            {timeString}
          </Typography>
        )}

        {/* 5. Chevron '>' (Left-aligned inline alongside text and timestamp) */}
        {hasTimelineContent && (
          <KeyboardArrowRightIcon
            sx={{
              fontSize: 18,
              color: 'text.secondary',
              flexShrink: 0,
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
            }}
          />
        )}
      </Box>

      {/* INTERNAL VERTICAL TIMELINE BODY (WHEN EXPANDED) */}
      {hasTimelineContent && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Box
            sx={{
              position: 'relative',
              borderLeft: '1.5px solid',
              borderColor: 'divider',
              ml: 1,
              pl: 2,
              mt: 1.5,
              mb: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            {/* Deliberative Reasoning Nodes */}
            {reasoningParts.map((rp, idx) => {
              if (!rp.text || !rp.text.trim()) return null;
              return (
                <Box
                  key={rp.id || `reasoning-node-${idx}`}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Step Dot Anchor */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -20,
                      top: 7,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor: 'text.secondary',
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: '0.84rem',
                      lineHeight: 1.6,
                      color: 'text.secondary',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {rp.text}
                  </Typography>
                </Box>
              );
            })}

            {/* Autonomous Tool Execution Nodes */}
            {toolParts.map((tp, idx) => (
              <Box
                key={tp.toolInvocation?.toolCallId || `tool-node-${idx}`}
                sx={{
                  position: 'relative',
                  width: '100%',
                }}
              >
                {/* Step Dot Anchor */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: -21,
                    top: 8,
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    bgcolor: 'background.paper',
                    border: '1.5px solid',
                    borderColor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
                <MuiToolCallPart
                  toolInvocation={tp.toolInvocation}
                  stepNumber={toolParts.length > 1 ? idx + 1 : undefined}
                  totalSteps={toolParts.length > 1 ? toolParts.length : undefined}
                />
              </Box>
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

MuiAgentExecutionTimeline.propTypes = {
  reasoningParts: PropTypes.array,
  toolParts: PropTypes.array,
  pipelineStatus: PropTypes.string,
  isStreaming: PropTypes.bool,
  isStopped: PropTypes.bool,
  createdAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  thoughtDuration: PropTypes.string,
  hasTextStarted: PropTypes.bool,
};

export default MuiAgentExecutionTimeline;
