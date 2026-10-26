/**
 * @module components/reports/ReportAmharicDossier
 * @description Synthesized Corporate Amharic Dossier Canvas (Row 4 of Report Detail).
 * Features:
 * - Authoritative Single Source of Truth (SSOT) Amharic text presentation
 * - Ge'ez typography ('Noto Sans Ethiopic', 'Nyala', sans-serif) with 1.8 line-height
 * - Pre-line whitespace preservation
 * - Top-right 1-click clipboard copy shortcut.
 */

import { useState, useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { toast } from 'react-toastify';

import MuiButton from '../reusable/MuiButton.jsx';

/**
 * Authoritative Amharic report transcription canvas.
 *
 * @component ReportAmharicDossier
 * @param {object} props - Component properties.
 * @param {string} [props.transcription=''] - Authoritative Amharic operational text.
 * @param {(newTranscription: string) => Promise<any>} [props.onUpdateTranscription] - Optional update handler for in-place editing.
 * @returns {import('react').JSX.Element} Rendered Amharic dossier canvas.
 */
export const ReportAmharicDossier = memo(({ transcription = '', onUpdateTranscription }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editInputRef = useRef(null);
  const charCountRef = useRef(null);

  const handleCopy = useCallback(async () => {
    if (!transcription) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(transcription);
        toast.success('Amharic text copied to clipboard!');
      } else {
        toast.error('Clipboard access not supported in this browser.');
      }
    } catch {
      toast.error('Failed to copy text.');
    }
  }, [transcription]);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!onUpdateTranscription) {
      setIsEditing(false);
      return;
    }
    const newText = editInputRef.current ? editInputRef.current.value.trim() : '';
    if (!newText) {
      toast.error('Dossier transcription text cannot be empty.');
      return;
    }

    try {
      setIsSaving(true);
      await onUpdateTranscription(newText);
      setIsEditing(false);
    } catch {
      // Keep edit state open on error so edits are not lost
    } finally {
      setIsSaving(false);
    }
  }, [onUpdateTranscription]);

  const handleInput = useCallback((e) => {
    if (charCountRef.current) {
      charCountRef.current.textContent = `${e.target.value.length} / 50000 chars`;
    }
  }, []);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5, md: 3 },
        borderRadius: 2,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* Dossier Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          pb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TranslateOutlinedIcon color="primary" sx={{ fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
            Authoritative Amharic Dossier
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* In-place Edit Button (only rendered when onUpdateTranscription is provided) */}
          {Boolean(onUpdateTranscription) && !isEditing && (
            <Tooltip title="Edit Amharic transcription" arrow>
              <span>
                <MuiButton
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={<EditOutlinedIcon fontSize="small" />}
                  onClick={handleStartEdit}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' }, fontWeight: 600, fontSize: '0.78rem' }}
                >
                  Edit Text
                </MuiButton>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={handleStartEdit}
                  aria-label="Edit Amharic text"
                  sx={{ display: { xs: 'inline-flex', sm: 'none' }, border: (t) => `1px solid ${t.palette.divider}` }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {/* Copy Text Button */}
          {transcription && !isEditing && (
            <Tooltip title="Copy Amharic text to clipboard" arrow>
              <span>
                <MuiButton
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={<ContentCopyOutlinedIcon fontSize="small" />}
                  onClick={handleCopy}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' }, fontWeight: 600, fontSize: '0.78rem' }}
                >
                  Copy Text
                </MuiButton>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={handleCopy}
                  aria-label="Copy Amharic text"
                  sx={{ display: { xs: 'inline-flex', sm: 'none' }, border: (t) => `1px solid ${t.palette.divider}` }}
                >
                  <ContentCopyOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Amharic Text Body: Edit Mode vs View Mode */}
      {isEditing ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: { xs: 0.5, sm: 1 } }}>
          <TextField
            inputRef={editInputRef}
            defaultValue={transcription}
            multiline
            minRows={5}
            maxRows={14}
            fullWidth
            onInput={handleInput}
            aria-label="Amharic dossier transcription text editor"
            placeholder="የዕለቱ የስራ ክንውን ሪፖርት ጽሑፍ..."
            slotProps={{
              input: {
                sx: {
                  fontFamily: "'Noto Sans Ethiopic', 'Nyala', sans-serif",
                  fontSize: { xs: '0.95rem', sm: '1.05rem' },
                  lineHeight: 1.8,
                  bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                },
              },
            }}
          />

          {/* Edit Toolbar: Character Counter & Action Buttons */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
              pt: 0.5,
            }}
          >
            <Typography
              ref={charCountRef}
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 500 }}
            >
              {transcription.length} / 50000 chars
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MuiButton
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<CloseIcon fontSize="small" />}
                onClick={handleCancelEdit}
                disabled={isSaving}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Cancel
              </MuiButton>
              <MuiButton
                size="small"
                variant="contained"
                color="primary"
                startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <CheckIcon fontSize="small" />}
                onClick={handleSaveEdit}
                disabled={isSaving}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {isSaving ? 'Saving...' : 'Save Text'}
              </MuiButton>
            </Box>
          </Box>
        </Box>
      ) : transcription ? (
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography
            component="div"
            sx={{
              fontFamily: "'Noto Sans Ethiopic', 'Nyala', sans-serif",
              fontSize: { xs: '0.95rem', sm: '1.05rem' },
              lineHeight: 1.8,
              color: 'text.primary',
              whiteSpace: 'pre-line',
              wordBreak: 'break-word',
            }}
          >
            {transcription}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            No Amharic transcription text recorded for this report.
          </Typography>
        </Box>
      )}
    </Paper>
  );
});

ReportAmharicDossier.displayName = 'ReportAmharicDossier';

ReportAmharicDossier.propTypes = {
  transcription: PropTypes.string,
  onUpdateTranscription: PropTypes.func,
};

export default ReportAmharicDossier;
