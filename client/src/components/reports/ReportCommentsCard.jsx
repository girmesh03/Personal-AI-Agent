/**
 * @module components/reports/ReportCommentsCard
 * @description Structured subdocument panel displaying supervisory observations and recommendations.
 * Features:
 * - Clean English title strictly formatted as "Observations (N)"
 * - Deprecated props purged in favor of modern MUI slotProps
 * - MaxHeight scroll bounds with custom theme scrollbars for collection scalability
 * - Item-level editing and creation capability with zero-lag uncontrolled multiline text input
 * - In-situ item deletion with item-scoped inline error circular spinner
 * - Strict schema purity: guaranteed never to transmit 'status' property, preventing HTTP 422
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
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';

import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import FormatQuoteOutlinedIcon from '@mui/icons-material/FormatQuoteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

import MuiButton from '../reusable/MuiButton.jsx';

/**
 * Strips all prohibited fields (especially 'status') from comment subdocuments.
 * Express-validator in reportValidation.js explicitly throws HTTP 422 if comments.*.status !== undefined.
 *
 * @param {Array<object>} list - Array of comment objects.
 * @returns {Array<{ text: string, _id?: string }>} Sanitized comment array.
 */
const sanitizeComments = (list) =>
  (list || []).map((c) => ({
    text: (c.text || '').trim(),
    ...(c._id ? { _id: c._id } : {}),
  }));

/**
 * Supervisory comments and observations card.
 *
 * @component ReportCommentsCard
 * @param {object} props - Component properties.
 * @param {Array<object>} [props.comments=[]] - Array of comment subdocuments.
 * @param {(updatedComments: Array<object>) => Promise<any>} [props.onUpdateComments] - Item-level mutation callback.
 * @returns {import('react').JSX.Element} Rendered comments card.
 */
export const ReportCommentsCard = memo(({ comments = [], onUpdateComments }) => {
  // Uncontrolled input ref for zero-lag editing (0 React re-renders on keystroke)
  const editInputRef = useRef(null);
  const addInputRef = useRef(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [savingIndex, setSavingIndex] = useState(null);
  const [deletingIndex, setDeletingIndex] = useState(null);
  const [isAddSaving, setIsAddSaving] = useState(false);

  const handleStartEdit = useCallback((idx) => {
    setEditingIndex(idx);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const handleSaveEdit = useCallback(
    async (idx) => {
      if (!onUpdateComments) {
        setEditingIndex(null);
        return;
      }
      const newText = editInputRef.current ? editInputRef.current.value.trim() : '';
      if (!newText) return;

      const updated = sanitizeComments(
        comments.map((item, i) => (i === idx ? { ...item, text: newText } : item))
      );
      try {
        setSavingIndex(idx);
        await onUpdateComments(updated);
        setEditingIndex(null);
      } catch {
        // Keep in edit mode so edits are preserved if update fails
      } finally {
        setSavingIndex(null);
      }
    },
    [comments, onUpdateComments]
  );

  const handleSaveAdd = useCallback(async () => {
    if (!onUpdateComments) {
      setIsAdding(false);
      return;
    }
    const newText = addInputRef.current ? addInputRef.current.value.trim() : '';
    if (!newText) return;

    const updated = sanitizeComments([...comments, { text: newText }]);
    try {
      setIsAddSaving(true);
      await onUpdateComments(updated);
      setIsAdding(false);
    } catch {
      // Keep adding form open so input is preserved
    } finally {
      setIsAddSaving(false);
    }
  }, [comments, onUpdateComments]);

  const handleDelete = useCallback(
    async (idx) => {
      if (!onUpdateComments) return;
      const updated = sanitizeComments(comments.filter((_, i) => i !== idx));
      try {
        setDeletingIndex(idx);
        await onUpdateComments(updated);
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
    [comments, onUpdateComments, editingIndex]
  );

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
          <CommentOutlinedIcon color="primary" sx={{ fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
            Observations ({comments.length})
          </Typography>
        </Box>

        {onUpdateComments && (
          <Tooltip title="Add Observation">
            <IconButton
              size="small"
              color="primary"
              disabled={isAdding || isAddSaving}
              onClick={() => setIsAdding((prev) => !prev)}
              aria-label="Add Observation"
              sx={{ border: (t) => `1px solid ${t.palette.divider}`, p: 0.5 }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Inline Add Observation Form */}
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
            placeholder="Record general supervisory directive or operational observation..."
            autoFocus
            fullWidth
            disabled={isAddSaving}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveAdd();
              if (e.key === 'Escape' && !isAddSaving) setIsAdding(false);
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
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
      )}

      {/* List of Comments with Scroll Bounds */}
      {comments.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 2 }}>
          No supervisory observations or directives recorded.
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
            {comments.map((item, idx) => {
              const isEditing = editingIndex === idx;

              if (isEditing) {
                return (
                  <ListItem
                    key={item._id || idx}
                    disableGutters
                    sx={{
                      py: 1.5,
                      borderBottom:
                        idx < comments.length - 1
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
                      placeholder="Observation text"
                      slotProps={{
                        input: {
                          sx: { fontSize: '0.875rem' },
                        },
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          handleSaveEdit(idx);
                        }
                        if (e.key === 'Escape' && savingIndex !== idx && deletingIndex !== idx) {
                          handleCancelEdit();
                        }
                      }}
                    />
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 0.5,
                      }}
                    >
                      <Tooltip title="Delete Observation">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={savingIndex === idx || deletingIndex === idx}
                            onClick={() => handleDelete(idx)}
                            aria-label="Delete observation"
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
                            aria-label="Save observation"
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
                      idx < comments.length - 1
                        ? (theme) => `1px solid ${theme.palette.divider}`
                        : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1, minWidth: 0 }}>
                    <FormatQuoteOutlinedIcon
                      sx={{
                        fontSize: 20,
                        color: 'primary.main',
                        mt: '3px',
                        flexShrink: 0,
                        transform: 'rotate(180deg)',
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        m: 0,
                        p: 0,
                        lineHeight: 1.5,
                        color: 'text.primary',
                        fontStyle: 'italic',
                        wordBreak: 'break-word',
                        flex: 1,
                      }}
                    >
                      {item.text}
                    </Typography>
                  </Box>

                  {onUpdateComments && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Tooltip title="Edit Observation">
                        <span>
                          <IconButton
                            size="small"
                            disabled={savingIndex === idx || deletingIndex === idx}
                            onClick={() => handleStartEdit(idx)}
                            sx={{
                              p: 0.5,
                              color: 'text.secondary',
                              '&:hover': { color: 'primary.main' },
                            }}
                            aria-label="Edit observation"
                          >
                            <EditOutlinedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete Observation">
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
                            aria-label="Delete observation"
                          >
                            {deletingIndex === idx ? (
                              <CircularProgress size={16} color="error" />
                            ) : (
                              <DeleteOutlinedIcon sx={{ fontSize: 16 }} />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  )}
                </ListItem>
              );
            })}
          </List>
        </Box>
      )}
    </Paper>
  );
});

ReportCommentsCard.displayName = 'ReportCommentsCard';

ReportCommentsCard.propTypes = {
  comments: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      text: PropTypes.string,
    })
  ),
  onUpdateComments: PropTypes.func,
};

export default ReportCommentsCard;
