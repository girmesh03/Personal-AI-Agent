/**
 * @module components/chat/ToolPartRenderer
 * @description Renders autonomous AI tool execution parts in the chat thread.
 * Displays concise, non-intrusive status badges for the 17 autonomous tools
 * with zero approval modals and clear execution states (running, done, error).
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import Popover from '@mui/material/Popover';

/**
 * Human-readable English labels for the 17 enterprise tools.
 * @constant
 * @type {Record<string, string>}
 */
const TOOL_LABELS = {
  create_report: 'Synthesizing Operational Report',
  update_report: 'Updating Operational Report',
  archive_report: 'Archiving Report',
  restore_report: 'Restoring Report',
  delete_report_permanently: 'Purging Report Record',
  toggle_issue_status: 'Updating Issue Status',
  toggle_activity_status: 'Updating Activity Status',
  lookup_user_branches: 'Searching Branches',
  create_branch: 'Registering New Branch',
  update_branch: 'Updating Branch Details',
  archive_branch: 'Archiving Branch',
  restore_branch: 'Restoring Branch',
  query_historical_reports: 'Querying Past Reports',
  query_branch_records: 'Analyzing Branch Records',
  save_supervisor_directive: 'Saving Supervisor Directive',
  export_tabular_data: 'Generating Tabular Export',
  sync_google_drive: 'Syncing to Google Drive',
  send_telegram_update: 'Broadcasting Field Update',
};

/**
 * Operon Autonomous Tool Part Renderer Component.
 *
 * @component ToolPartRenderer
 * @param {object} props - Component props.
 * @param {object} props.part - Tool message part entity.
 * @returns {import('react').JSX.Element|null} Rendered component.
 */
export const ToolPartRenderer = ({ part }) => {
  const invocation = part?.toolInvocation || {};
  const toolName = invocation.toolName || 'tool';
  const state = invocation.state || 'output-available';
  const input = invocation.input;
  const output = invocation.output;
  const errorText = invocation.errorText;

  const [anchorEl, setAnchorEl] = useState(null);

  const displayName = TOOL_LABELS[toolName] || toolName.replace(/_/g, ' ');

  const isRunning = state === 'input-streaming' || state === 'input-available';
  const isError = state === 'output-error';
  const isDone = state === 'output-available';

  const handleClick = (event) => {
    if (input || output || errorText) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  let icon = <BuildCircleIcon sx={{ fontSize: 16 }} />;
  let label = displayName;
  let chipColor = 'default';

  if (isRunning) {
    icon = <CircularProgress size={12} color="inherit" />;
    label = `Executing ${displayName}...`;
    chipColor = 'primary';
  } else if (isError) {
    icon = <ErrorOutlineIcon sx={{ fontSize: 16 }} />;
    label = `${displayName} failed`;
    chipColor = 'error';
  } else if (isDone) {
    icon = <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />;
    chipColor = 'default';
  }

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', my: 0.5, mr: 1 }}>
      <Tooltip title="Click to view tool details" arrow disableHoverListener={isRunning}>
        <Chip
          icon={icon}
          label={label}
          size="small"
          variant="outlined"
          color={chipColor}
          onClick={handleClick}
          sx={{
            fontSize: '0.75rem',
            fontWeight: 500,
            borderRadius: 1.5,
            borderColor: isRunning ? 'primary.main' : isError ? 'error.main' : 'divider',
            bgcolor: 'action.hover',
            cursor: input || output || errorText ? 'pointer' : 'default',
            '&:hover': {
              borderColor: 'text.secondary',
            },
          }}
        />
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              maxWidth: 360,
              maxHeight: 260,
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              boxShadow: 2,
            },
          },
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
          {displayName}
        </Typography>

        {input && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Parameters:
            </Typography>
            <Typography
              variant="caption"
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                p: 0.5,
                bgcolor: 'action.hover',
                borderRadius: 1,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {typeof input === 'object' ? JSON.stringify(input, null, 2) : String(input)}
            </Typography>
          </Box>
        )}

        {output && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Execution Result:
            </Typography>
            <Typography
              variant="caption"
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                p: 0.5,
                bgcolor: 'action.hover',
                borderRadius: 1,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output)}
            </Typography>
          </Box>
        )}

        {errorText && (
          <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
            {errorText}
          </Typography>
        )}
      </Popover>
    </Box>
  );
};

ToolPartRenderer.propTypes = {
  part: PropTypes.shape({
    type: PropTypes.string,
    toolInvocation: PropTypes.shape({
      toolCallId: PropTypes.string,
      toolName: PropTypes.string,
      state: PropTypes.string,
      input: PropTypes.any,
      output: PropTypes.any,
      errorText: PropTypes.string,
    }),
  }).isRequired,
};

export default ToolPartRenderer;
