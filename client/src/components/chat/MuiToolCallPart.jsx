/**
 * @module components/chat/MuiToolCallPart
 * @description Autonomous tool execution card rendered for each tool part during an agent turn.
 * Adheres strictly to the Task 8.11 specifications:
 * - Autonomous multi-step execution cards (steps 1..5) with zero approval modals.
 * - Live status indicators: spinner on input-streaming/input-available, green check on output-available,
 *   and error icon on output-error.
 * - Human-readable tool labels with dynamic operational summary badges.
 * - Collapsible JSON inspection drawer for parameters and database execution results.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import { alpha } from '@mui/material/styles';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TelegramIcon from '@mui/icons-material/Telegram';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

/**
 * Human-friendly title dictionary for the 17 autonomous operations tools.
 */
const TOOL_DISPLAY_NAMES = {
  lookup_user_branches: 'Branch Directory Lookup',
  create_branch: 'Register Branch',
  update_branch: 'Update Branch',
  archive_branch: 'Archive Branch',
  restore_branch: 'Restore Branch',
  delete_branch_permanently: 'Permanent Delete Branch',
  create_report: 'Create Inspection Report',
  update_report: 'Update Inspection Report',
  update_branch_record_status: 'Update Record Status',
  archive_report: 'Archive Inspection Report',
  restore_report: 'Restore Inspection Report',
  delete_report_permanently: 'Permanent Delete Report',
  query_historical_reports: 'Historical Reports Query',
  query_branch_records: 'Branch Records Query',
  export_report: 'Export Operational Report',
  share_to_telegram: 'Telegram Alert Dispatch',
  save_supervisor_directive: 'Save Supervisor Directives',
};

/**
 * Derives a human-friendly summary text from the tool execution output.
 * @param {object|any} output
 * @returns {string} Summary string.
 */
const deriveOutputSummary = (output) => {
  if (!output) return 'Completed';
  if (Array.isArray(output)) {
    return `${output.length} record${output.length === 1 ? '' : 's'} found`;
  }
  if (typeof output === 'object') {
    if (output.channel === 'telegram' || output.targetChannel) {
      const ch = output.targetChannel || output.channel;
      const modeStr = output.mode === 'image' ? 'Image Card' : 'Text';
      const statusStr = output.isStub ? 'Stub' : 'Live';
      return `${ch} • ${modeStr} • ${statusStr}`;
    }
    if (output.reportId) {
      return `Report #${String(output.reportId).slice(-6)} created`;
    }
    if (output.count !== undefined) {
      return `${output.count} item${output.count === 1 ? '' : 's'} found`;
    }
    if (output.branch?.name) {
      return `Branch: ${output.branch.name}`;
    }
    if (output.message && typeof output.message === 'string') {
      return output.message.slice(0, 60);
    }
    if (output.success) {
      return 'Execution successful';
    }
  }
  return 'Completed';
};

/**
 * Autonomous tool execution card.
 *
 * @component MuiToolCallPart
 * @param {object} props
 * @param {object} props.toolInvocation - Tool execution descriptor from MUI X Chat headless.
 * @returns {import('react').JSX.Element} Rendered tool execution card.
 */
export const MuiToolCallPart = ({ toolInvocation, stepNumber, totalSteps }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!toolInvocation) return null;

  const { toolName = 'tool', state = 'output-available', input, output, errorText } = toolInvocation;

  const isExecuting = state === 'input-streaming' || state === 'input-available';
  const isError = state === 'output-error' || Boolean(errorText);
  const isSuccess = state === 'output-available' && !isError;

  const friendlyName = TOOL_DISPLAY_NAMES[toolName] || toolName.replace(/_/g, ' ');
  const displayName = stepNumber
    ? (totalSteps ? `Step ${stepNumber}/${totalSteps}: ${friendlyName}` : `Step ${stepNumber}: ${friendlyName}`)
    : friendlyName;
  const summaryText = isExecuting
    ? 'Executing in ACID session...'
    : isError
      ? (errorText || 'Execution error')
      : deriveOutputSummary(output);

  return (
    <Box
      sx={{
        width: '100%',
        border: 1,
        borderColor: isError ? 'error.light' : 'divider',
        borderRadius: '10px',
        bgcolor: 'transparent',
        p: '6px 12px',
        mb: 1,
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Primary summary strip */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        {/* Left: Icon, Tool Name & Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexWrap: 'wrap' }}>
          {toolName === 'share_to_telegram' ? (
            <TelegramIcon sx={{ fontSize: 16, color: '#2AABEE' }} />
          ) : (
            <BuildOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          )}
          <Typography
            sx={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'text.primary',
              fontFamily: 'monospace, sans-serif',
            }}
          >
            {displayName}
          </Typography>

          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.8,
              py: 0.2,
              borderRadius: '6px',
              bgcolor: isExecuting
                ? 'action.hover'
                : isError
                  ? 'error.light'
                  : 'action.hover',
            }}
          >
            {isExecuting && (
              <CircularProgress size={12} thickness={5} sx={{ color: 'primary.main' }} />
            )}
            {isSuccess && (
              <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />
            )}
            {isError && (
              <ErrorOutlineIcon sx={{ fontSize: 14, color: 'error.main' }} />
            )}

            <Typography
              variant="caption"
              sx={{
                fontSize: '0.75rem',
                color: isError ? 'error.main' : 'text.secondary',
                fontWeight: 500,
              }}
            >
              {summaryText}
            </Typography>

            {output?.deepLink && (
              <Box
                component="a"
                href={output.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.3,
                  fontSize: '0.75rem',
                  color: '#2AABEE',
                  textDecoration: 'none',
                  fontWeight: 600,
                  ml: 0.5,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                View <OpenInNewIcon sx={{ fontSize: 11 }} />
              </Box>
            )}
          </Box>
        </Box>

        {/* Right: Collapsible JSON details trigger */}
        <Box
          component="button"
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          aria-expanded={showDetails}
          aria-label="Inspect tool call parameters and result"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            p: '2px 6px',
            bgcolor: 'transparent !important',
            backgroundColor: 'transparent !important',
            border: 'none !important',
            boxShadow: 'none !important',
            cursor: 'pointer',
            color: 'text.secondary',
            fontSize: '0.75rem',
            userSelect: 'none',
            '&:hover': {
              color: 'text.primary',
            },
          }}
        >
          <span>{showDetails ? 'Hide' : 'Inspect'}</span>
          <ExpandMoreIcon
            sx={{
              fontSize: 16,
              transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </Box>
      </Box>

      {/* Expandable JSON details */}
      <Collapse in={showDetails} timeout="auto" unmountOnExit={false}>
        <Box
          sx={{
            mt: 1,
            pt: 1,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {input !== undefined && (
            <Box>
              <Typography
                variant="caption"
                sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}
              >
                Arguments:
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1,
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  borderRadius: '6px',
                  bgcolor: (theme) =>
                    theme.vars
                      ? theme.vars.palette.action.hover
                      : alpha(theme.palette.action.hover, 0.4),
                  border: 1,
                  borderColor: 'divider',
                  color: 'text.primary',
                  overflowX: 'auto',
                  maxWidth: '100%',
                  maxHeight: 180,
                }}
              >
                {JSON.stringify(input, null, 2)}
              </Box>
            </Box>
          )}

          {output !== undefined && (
            <Box>
              <Typography
                variant="caption"
                sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}
              >
                Output:
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1,
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  borderRadius: '6px',
                  bgcolor: (theme) =>
                    theme.vars
                      ? theme.vars.palette.action.hover
                      : alpha(theme.palette.action.hover, 0.4),
                  border: 1,
                  borderColor: 'divider',
                  color: 'text.primary',
                  overflowX: 'auto',
                  maxWidth: '100%',
                  maxHeight: 220,
                }}
              >
                {JSON.stringify(output, null, 2)}
              </Box>
            </Box>
          )}

          {errorText && (
            <Box>
              <Typography
                variant="caption"
                sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'error.main' }}
              >
                Error:
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  color: 'error.main',
                  fontFamily: 'monospace',
                  p: 0.5,
                }}
              >
                {errorText}
              </Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

MuiToolCallPart.propTypes = {
  toolInvocation: PropTypes.shape({
    toolCallId: PropTypes.string,
    toolName: PropTypes.string,
    state: PropTypes.string,
    input: PropTypes.any,
    output: PropTypes.any,
    errorText: PropTypes.string,
  }),
  stepNumber: PropTypes.number,
  totalSteps: PropTypes.number,
};

export default MuiToolCallPart;
