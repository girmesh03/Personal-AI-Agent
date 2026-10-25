/**
 * @module components/reports/ReportIssuesCard
 * @description Structured subdocument panel displaying operational issues & bottlenecks.
 * Features:
 * - Clean English title strictly formatted as "Issues (N)"
 * - Deprecated props purged in favor of modern MUI slotProps
 * - MaxHeight scroll bounds with custom theme scrollbars for collection scalability
 * - Item-level editing capability with zero-lag uncontrolled text input
 * - Responsive 2-tier stacked layout on mobile xs (vw < 600px) preventing text compression
 * - Reduced horizontal padding on mobile xs preserving viewport width
 */

import { useState, useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';

import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

import MuiStatusChip from '../reusable/MuiStatusChip.jsx';
import MuiButton from '../reusable/MuiButton.jsx';
import { REPORT_CONSTANTS } from '../../utils/constants.js';

const ISSUE_STATUS_LABELS = {
  reported: 'Reported',
  in_progress: 'In Progress',
  completed: 'Completed',
  no_issue: 'No Issue',
};

/**
 * Operational issues and findings panel.
 *
 * @component ReportIssuesCard
 * @param {object} props - Component properties.
 * @param {Array<object>} [props.issues=[]] - Array of issue subdocuments.
 * @param {(updatedIssues: Array<object>) => void} [props.onUpdateIssues] - Item-level edit callback.
 * @returns {import('react').JSX.Element} Rendered issues card.
 */
export const ReportIssuesCard = memo(({ issues = [], onUpdateIssues }) => {
  const reportedCount = issues.filter((i) => i.status === 'reported').length;
  const inProgressCount = issues.filter((i) => i.status === 'in_progress').length;
  const completedCount = issues.filter((i) => i.status === 'completed').length;

  // Uncontrolled input ref for zero-lag editing (0 React re-renders on keystroke)
  const editInputRef = useRef(null);
  const addInputRef = useRef(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editStatus, setEditStatus] = useState(REPORT_CONSTANTS.DEFAULT_ISSUE_STATUS);
  const [isAdding, setIsAdding] = useState(false);
  const [addStatus, setAddStatus] = useState(REPORT_CONSTANTS.DEFAULT_ISSUE_STATUS);
  const [savingIndex, setSavingIndex] = useState(null);
  const [deletingIndex, setDeletingIndex] = useState(null);
  const [isAddSaving, setIsAddSaving] = useState(false);

  const handleStartEdit = useCallback((idx, item) => {
    setEditingIndex(idx);
    const validStatus = REPORT_CONSTANTS.ISSUE_STATUSES.includes(item?.status)
      ? item.status
      : REPORT_CONSTANTS.DEFAULT_ISSUE_STATUS;
    setEditStatus(validStatus);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditStatus(REPORT_CONSTANTS.DEFAULT_ISSUE_STATUS);
  }, []);

  const handleDelete = useCallback(
    async (idx) => {
      if (!onUpdateIssues) return;
      const updated = issues.filter((_, i) => i !== idx);
      try {
        setDeletingIndex(idx);
        await onUpdateIssues(updated);
        if (editingIndex === idx) {
          setEditingIndex(null);
        } else if (editingIndex > idx) {
          setEditingIndex(editingIndex - 1);
        }
      } catch {
        // Keep state if update fails
      } finally {
        setDeletingIndex(null);
      }
    },
    [issues, onUpdateIssues, editingIndex]
  );

  const handleSaveEdit = useCallback(
    async (idx) => {
      if (!onUpdateIssues) {
        setEditingIndex(null);
        return;
      }
      const newText = editInputRef.current ? editInputRef.current.value.trim() : '';
      if (!newText) return;

      const updated = issues.map((item, i) =>
        i === idx ? { ...item, text: newText, status: editStatus } : item
      );
      try {
        setSavingIndex(idx);
        await onUpdateIssues(updated);
        setEditingIndex(null);
      } catch {
        // Keep in edit mode so edits are preserved if update fails
      } finally {
        setSavingIndex(null);
      }
    },
    [issues, editStatus, onUpdateIssues]
  );

  const handleSaveAdd = useCallback(async () => {
    if (!onUpdateIssues) {
      setIsAdding(false);
      return;
    }
    const newText = addInputRef.current ? addInputRef.current.value.trim() : '';
    if (!newText) return;

    try {
      setIsAddSaving(true);
      await onUpdateIssues([...issues, { text: newText, status: addStatus }]);
      setIsAdding(false);
      setAddStatus('reported');
    } catch {
      // Keep adding form open so input is preserved
    } finally {
      setIsAddSaving(false);
    }
  }, [issues, addStatus, onUpdateIssues]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.25, sm: 2, md: 2.5 },
        borderRadius: 2,
        bgcolor: 'background.paper',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header with Counter Badges & Add Button */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          pb: 1.5,
          mb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color={reportedCount > 0 ? 'error' : 'primary'} sx={{ fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
            Issues ({issues.length})
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {reportedCount > 0 && (
            <MuiStatusChip status="reported" label={`${reportedCount} flagged`} size="small" />
          )}
          {inProgressCount > 0 && (
            <MuiStatusChip status="in_progress" label={`${inProgressCount} open`} size="small" />
          )}
          {completedCount > 0 && (
            <MuiStatusChip status="completed" label={`${completedCount} solved`} size="small" />
          )}
          {issues.length === 0 && (
            <MuiStatusChip status="no_issue" label="All Clean" size="small" />
          )}
          {onUpdateIssues && (
            <Tooltip title="Add Issue">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => setIsAdding((prev) => !prev)}
                  disabled={isAddSaving}
                  aria-label="Add Issue"
                  sx={{ border: (t) => `1px solid ${t.palette.divider}`, p: 0.5 }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Inline Add Issue Form */}
      {isAdding && (
        <Box
          sx={{
            p: 1.5,
            mb: 1.5,
            borderRadius: 1.5,
            border: (theme) => `1px solid ${theme.palette.primary.main}`,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
          }}
        >
          <TextField
            inputRef={addInputRef}
            size="small"
            multiline
            minRows={2}
            maxRows={4}
            placeholder="Describe operational bottleneck or issue..."
            autoFocus
            fullWidth
            disabled={isAddSaving}
            slotProps={{
              input: {
                sx: { fontSize: '0.875rem' },
              },
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveAdd();
              if (e.key === 'Escape' && !isAddSaving) setIsAdding(false);
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <FormControl size="small">
              <Select
                value={addStatus}
                onChange={(e) => setAddStatus(e.target.value)}
                disabled={isAddSaving}
                sx={{ height: 32, fontSize: '0.8125rem' }}
              >
                {REPORT_CONSTANTS.ISSUE_STATUSES.map((statusKey) => (
                  <MenuItem key={statusKey} value={statusKey}>
                    {ISSUE_STATUS_LABELS[statusKey] || statusKey}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <MuiButton
                size="small"
                color="inherit"
                disabled={isAddSaving}
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </MuiButton>
              <MuiButton
                size="small"
                variant="contained"
                color="primary"
                disabled={isAddSaving}
                startIcon={isAddSaving ? <CircularProgress size={14} color="inherit" /> : null}
                onClick={handleSaveAdd}
              >
                Add
              </MuiButton>
            </Box>
          </Box>
        </Box>
      )}

      {/* List of Issues with Scroll Bounds */}
      {issues.length === 0 ? (
        <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 20 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No operational issues or bottlenecks flagged during this inspection audit.
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            maxHeight: { xs: 320, sm: 400, md: 480 },
            overflowY: 'auto',
            pr: 0.5,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.2),
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.4),
            },
          }}
        >
          <List disablePadding sx={{ width: '100%' }}>
            {issues.map((item, idx) => {
              const isEditing = editingIndex === idx;

              if (isEditing) {
                return (
                  <ListItem
                    key={item._id || idx}
                    disableGutters
                    sx={{
                      py: 1.5,
                      borderBottom:
                        idx < issues.length - 1
                          ? (theme) => `1px solid ${theme.palette.divider}`
                          : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: 1,
                    }}
                  >
                    {/* Zero-lag Uncontrolled Input (0 React re-renders on keystroke) */}
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={4}
                      inputRef={editInputRef}
                      defaultValue={item.text}
                      disabled={savingIndex === idx || deletingIndex === idx}
                      placeholder="Issue description"
                      slotProps={{
                        input: {
                          sx: { fontSize: '0.875rem' },
                        },
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveEdit(idx);
                        if (e.key === 'Escape' && savingIndex !== idx && deletingIndex !== idx) handleCancelEdit();
                      }}
                    />
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                      }}
                    >
                      <Select
                        size="small"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        disabled={savingIndex === idx || deletingIndex === idx}
                        MenuProps={{
                          disableEnforceFocus: true,
                          disableRestoreFocus: true,
                        }}
                        sx={{ height: 32, fontSize: '0.8125rem' }}
                      >
                        {REPORT_CONSTANTS.ISSUE_STATUSES.map((statusKey) => (
                          <MenuItem key={statusKey} value={statusKey}>
                            {ISSUE_STATUS_LABELS[statusKey] || statusKey}
                          </MenuItem>
                        ))}
                      </Select>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title="Delete Issue">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={savingIndex === idx || deletingIndex === idx}
                              onClick={() => handleDelete(idx)}
                              aria-label="Delete issue"
                            >
                              {deletingIndex === idx ? (
                                <CircularProgress size={16} color="error" />
                              ) : (
                                <DeleteOutlinedIcon sx={{ fontSize: 16 }} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Save change">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              disabled={savingIndex === idx || deletingIndex === idx}
                              onClick={() => handleSaveEdit(idx)}
                              aria-label="Save issue"
                            >
                              {savingIndex === idx ? (
                                <CircularProgress size={16} color="primary" />
                              ) : (
                                <CheckIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Cancel">
                          <span>
                            <IconButton
                              size="small"
                              color="inherit"
                              disabled={savingIndex === idx || deletingIndex === idx}
                              onClick={handleCancelEdit}
                              aria-label="Cancel editing"
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </Box>
                  </ListItem>
                );
              }

              return (
                <ListItem
                  key={item._id || idx}
                  disableGutters
                  sx={{
                    py: 1.25,
                    borderBottom:
                      idx < issues.length - 1
                        ? (theme) => `1px solid ${theme.palette.divider}`
                        : 'none',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'flex-start' },
                    justifyContent: 'space-between',
                    gap: { xs: 0.75, sm: 1.5 },
                  }}
                >
                  {/* Tier 1 on xs (Left block on sm): Icon + Full-width text with optical baseline alignment */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1, width: '100%', minWidth: 0 }}>
                    {item.status === 'completed' || item.status === 'no_issue' ? (
                      <CheckCircleOutlineIcon
                        sx={{
                          fontSize: 18,
                          color: 'success.main',
                          mt: '3px',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <WarningAmberIcon
                        sx={{
                          fontSize: 18,
                          color: item.status === 'reported' ? 'error.main' : 'warning.main',
                          mt: '3px',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <Typography
                      variant="body2"
                      sx={{
                        m: 0,
                        p: 0,
                        lineHeight: 1.5,
                        fontWeight: 500,
                        color:
                          item.status === 'reported'
                            ? 'error.main'
                            : item.status === 'in_progress'
                              ? 'warning.main'
                              : 'text.primary',
                        wordBreak: 'break-word',
                        flex: 1,
                      }}
                    >
                      {item.text}
                    </Typography>
                  </Box>

                  {/* Tier 2 on xs (Right block on sm): Status Chip + Edit button grouped right */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 1,
                      flexShrink: 0,
                      width: { xs: '100%', sm: 'auto' },
                      pl: 0,
                    }}
                  >
                    <MuiStatusChip
                      status={item.status || REPORT_CONSTANTS.DEFAULT_ISSUE_STATUS}
                      size="small"
                      label={ISSUE_STATUS_LABELS[item.status] || undefined}
                    />
                    {onUpdateIssues && (
                      <>
                        <Tooltip title="Edit Issue">
                          <span>
                            <IconButton
                              size="small"
                              disabled={savingIndex === idx || deletingIndex === idx}
                              onClick={() => handleStartEdit(idx, item)}
                              sx={{
                                p: 0.5,
                                color: 'text.secondary',
                                '&:hover': { color: 'primary.main' },
                              }}
                              aria-label="Edit issue"
                            >
                              <EditOutlinedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete Issue">
                          <span>
                            <IconButton
                              size="small"
                              disabled={savingIndex === idx || deletingIndex === idx}
                              onClick={() => handleDelete(idx)}
                              sx={{
                                p: 0.5,
                                color: 'text.secondary',
                                '&:hover': { color: 'error.main' },
                              }}
                              aria-label="Delete issue"
                            >
                              {deletingIndex === idx ? (
                                <CircularProgress size={16} color="error" />
                              ) : (
                                <DeleteOutlinedIcon sx={{ fontSize: 16 }} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                  </Box>
                </ListItem>
              );
            })}
          </List>
        </Box>
      )}
    </Paper>
  );
});

ReportIssuesCard.displayName = 'ReportIssuesCard';

ReportIssuesCard.propTypes = {
  issues: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      text: PropTypes.string,
      status: PropTypes.string,
    })
  ),
  onUpdateIssues: PropTypes.func,
};

export default ReportIssuesCard;
