/**
 * @module components/reports/ReportAmharicDossier
 * @description Synthesized Corporate Amharic Dossier Canvas (Row 4 of Report Detail).
 * Features:
 * - Authoritative Single Source of Truth (SSOT) Amharic text presentation
 * - Ge'ez typography ('Noto Sans Ethiopic', 'Nyala', sans-serif) with 1.8 line-height
 * - Pre-line whitespace preservation
 * - Top-right 1-click clipboard copy shortcut.
 */

import { useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import { toast } from 'react-toastify';

import MuiButton from '../reusable/MuiButton.jsx';

/**
 * Authoritative Amharic report transcription canvas.
 *
 * @component ReportAmharicDossier
 * @param {object} props - Component properties.
 * @param {string} [props.transcription=''] - Authoritative Amharic operational text.
 * @returns {import('react').JSX.Element} Rendered Amharic dossier canvas.
 */
export const ReportAmharicDossier = memo(({ transcription = '' }) => {
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

        {transcription && (
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

      {/* Amharic Text Body */}
      {transcription ? (
        <Box sx={{
          p: { xs: 1.5, sm: 2 },
        }}
        >
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
};

export default ReportAmharicDossier;
