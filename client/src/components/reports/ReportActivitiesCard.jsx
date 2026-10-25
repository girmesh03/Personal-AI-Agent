/**
 * @module components/reports/ReportActivitiesCard
 * @description Structured subdocument panel displaying operational activities and checklist items.
 * Features:
 * - Clean English title strictly formatted as "Activities (N)"
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

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

import MuiStatusChip from '../reusable/MuiStatusChip.jsx';
import MuiButton from '../reusable/MuiButton.jsx';
import { REPORT_CONSTANTS } from '../../utils/constants.js';

const ACTIVITY_STATUS_LABELS = {
  completed: 'Completed',
  in_progress: 'In Progress',
};

/**
 * Operational activities checklist panel.
 *
 * @component ReportActivitiesCard
 * @param {object} props - Component properties.
 * @param {Array<object>} [props.activities=[]] - Array of activity subdocuments.
 * @param {(updatedActivities: Array<object>) => void} [props.onUpdateActivities] - Item-level edit callback.
 * @returns {import('react').JSX.Element} Rendered activities card.
 */
export const ReportActivitiesCard = memo(({ activities = [], onUpdateActivities }) => {
  const completedCount = activities.filter((a) => a.status === 'completed').length;
  const inProgressCount = activities.filter((a) => a.status === 'in_progress').length;

  // Uncontrolled input ref for zero-lag editing (0 React re-renders on keystroke)
  const editInputRef = useRef(null);
  const addInputRef = useRef(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editStatus, setEditStatus] = useState(REPORT_CONSTANTS.DEFAULT_ACTIVITY_STATUS);
  const [isAdding, setIsAdding] = useState(false);
  const [addStatus, setAddStatus] = useState(REPORT_CONSTANTS.DEFAULT_ACTIVITY_STATUS);
  const [savingIndex, setSavingIndex] = useState(null);
  const [deletingIndex, setDeletingIndex] = useState(null);
  const [isAddSaving, setIsAddSaving] = useState(false);

  const handleStartEdit = useCallback((idx, item) => {
    setEditingIndex(idx);
    const validStatus = REPORT_CONSTANTS.ACTIVITY_STATUSES.includes(item?.status)
      ? item.status
      : REPORT_CONSTANTS.DEFAULT_ACTIVITY_STATUS;
    setEditStatus(validStatus);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditStatus(REPORT_CONSTANTS.DEFAULT_ACTIVITY_STATUS);
  }, []);

  const handleDelete = useCallback(
    async (idx) => {
      if (!onUpdateActivities) return;
      const updated = activities.filter((_, i) => i !== idx);
      try {
        setDeletingIndex(idx);
        await onUpdateActivities(updated);
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
    [activities, onUpdateActivities, editingIndex]
  );

  const handleSaveEdit = useCallback(
    async (idx) => {
      if (!onUpdateActivities) {
        setEditingIndex(null);
        return;
      }
      const newText = editInputRef.current ? editInputRef.current.value.trim() : '';
      if (!newText) return;

      const updated = activities.map((item, i) =>
        i === idx ? { ...item, text: newText, status: editStatus } : item
      );
      try {
        setSavingIndex(idx);
        await onUpdateActivities(updated);
        setEditingIndex(null);
      } catch {
        // Keep in edit mode so edits are preserved if update fails
      } finally {
        setSavingIndex(null);
      }
    },
    [activities, editStatus, onUpdateActivities]
  );

  const handleSaveAdd = useCallback(async () => {
    if (!onUpdateActivities) {
      setIsAdding(false);
      return;
    }
    const newText = addInputRef.current ? addInputRef.current.value.trim() : '';
    if (!newText) return;

    try {
      setIsAddSaving(true);
      await onUpdateActivities([...activities, { text: newText, status: addStatus }]);
      setIsAdding(false);
      setAddStatus('completed');
    } catch {
      // Keep adding form open so input is preserved
    } finally {
      setIsAddSaving(false);
    }
  }, [activities, addStatus, onUpdateActivities]);

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
          <AssignmentTurnedInOutlinedIcon color="primary" sx={{ fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
            Activities ({activities.length})
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {completedCount > 0 && (
            <MuiStatusChip status="completed" label={`${completedCount} done`} size="small" />
          )}
          {inProgressCount > 0 && (
            <MuiStatusChip status="in_progress" label={`${inProgressCount} prog`} size="small" />
          )}
          {onUpdateActivities && (
            <Tooltip title="Add Activity">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => setIsAdding((prev) => !prev)}
                  disabled={isAddSaving}
                  aria-label="Add Activity"
                  sx={{ border: (t) => `1px solid ${t.palette.divider}`, p: 0.5 }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Inline Add Activity Form */}
      {isAdding && (
        <Box
          sx={{
            p: 1.5,
            mb: 1.5,
            borderRadius: 1.5,
            border: (t) => `1px solid ${t.palette.primary.main}`,
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
            placeholder="Describe new operational activity..."
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
                {REPORT_CONSTANTS.ACTIVITY_STATUSES.map((statusKey) => (
                  <MenuItem key={statusKey} value={statusKey}>
                    {ACTIVITY_STATUS_LABELS[statusKey] || statusKey}
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

      {/* List of Activities with Scroll Bounds */}
      {activities.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 2 }}>
          No operational activities recorded for this inspection.
        </Typography>
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
            {activities.map((item, idx) => {
              const isEditing = editingIndex === idx;

              if (isEditing) {
                return (
                  <ListItem
                    key={item._id || idx}
                    disableGutters
                    sx={{
                      py: 1.5,
                      borderBottom:
                        idx < activities.length - 1
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
                      placeholder="Activity description"
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
                        {REPORT_CONSTANTS.ACTIVITY_STATUSES.map((statusKey) => (
                          <MenuItem key={statusKey} value={statusKey}>
                            {ACTIVITY_STATUS_LABELS[statusKey] || statusKey}
                          </MenuItem>
                        ))}
                      </Select>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title="Delete Activity">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={savingIndex === idx || deletingIndex === idx}
                              onClick={() => handleDelete(idx)}
                              aria-label="Delete activity"
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
                              aria-label="Save activity"
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
                      idx < activities.length - 1
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
                    <CheckCircleOutlineIcon
                      sx={{
                        fontSize: 18,
                        color: item.status === 'completed' ? 'success.main' : 'warning.main',
                        mt: '3px',
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        m: 0,
                        p: 0,
                        lineHeight: 1.5,
                        fontWeight: 500,
                        color: 'text.primary',
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
                      status={item.status || REPORT_CONSTANTS.DEFAULT_ACTIVITY_STATUS}
                      size="small"
                      label={ACTIVITY_STATUS_LABELS[item.status] || undefined}
                    />
                    {onUpdateActivities && (
                      <>
                        <Tooltip title="Edit Activity">
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
                              aria-label="Edit activity"
                            >
                              <EditOutlinedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete Activity">
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
                              aria-label="Delete activity"
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

ReportActivitiesCard.displayName = 'ReportActivitiesCard';

ReportActivitiesCard.propTypes = {
  activities: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      text: PropTypes.string,
      status: PropTypes.string,
    })
  ),
  onUpdateActivities: PropTypes.func,
};

export default ReportActivitiesCard;
