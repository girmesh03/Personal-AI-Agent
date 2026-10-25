/**
 * @module components/reports/ReportAudioPlayerDeck
 * @description Evidentiary Voice Notes & Audio Player Deck (Row 6 of Report Detail).
 * Renders audio recordings attached to the operational report:
 * - Original file name, MIME type format badge, file size in MB
 * - Audio duration and HTML5 audio playback controls
 * - Speech-to-text transcript preview snippet.
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import { alpha } from '@mui/material/styles';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import GraphicEqOutlinedIcon from '@mui/icons-material/GraphicEqOutlined';

/**
 * Audio voice notes evidentiary player deck.
 *
 * @component ReportAudioPlayerDeck
 * @param {object} props - Component properties.
 * @param {Array<object>} [props.audios=[]] - Array of Audio document records.
 * @returns {import('react').JSX.Element} Rendered audio deck.
 */
export const ReportAudioPlayerDeck = memo(({ audios = [] }) => {
  const formatDuration = (seconds) => {
    if (!seconds || Number.isNaN(Number(seconds))) return '—';
    const totalSec = Math.round(Number(seconds));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || Number.isNaN(Number(bytes))) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <Paper
      variant="outlined"
      className="report-audio-deck"
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <MicNoneOutlinedIcon color="primary" sx={{ fontSize: 22 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
          Evidentiary Voice Notes ({audios.length})
        </Typography>
      </Box>

      {/* Audio Items Grid with Scroll Bounds */}
      {audios.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 1 }}>
          No audio voice notes recorded or attached to this inspection report.
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
          <Grid container spacing={2}>
            {audios.map((audio, idx) => {
              const fileName = audio.originalName || audio.fileName || `Voice Note #${idx + 1}`;
              const mimeType = audio.mimeType || 'audio/webm';
              const durationStr = formatDuration(audio.duration);
              const sizeStr = formatFileSize(audio.size);
              const audioSrc =
                audio.url ||
                (audio.fileName ? `/uploads/audios/${audio.fileName}` : '') ||
                (audio.path ? `/${audio.path.replace(/\\/g, '/')}` : '');

              return (
                <Grid key={audio._id || idx} size={{ xs: 12, md: 6 }}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      bgcolor: 'action.hover',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                  {/* File Metadata Row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                      <GraphicEqOutlinedIcon color="primary" sx={{ fontSize: 20, flexShrink: 0 }} />
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fileName}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Chip
                        label={mimeType.replace('audio/', '').toUpperCase()}
                        size="small"
                        sx={{ fontSize: '0.68rem', height: 20, fontWeight: 700 }}
                      />
                      {durationStr !== '—' && (
                        <Chip
                          label={durationStr}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.68rem', height: 20, fontWeight: 600 }}
                        />
                      )}
                      {sizeStr && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                          {sizeStr}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* HTML5 Native Audio Player */}
                  {audioSrc && (
                    <Box sx={{ width: '100%' }}>
                      <audio
                        controls
                        src={audioSrc}
                        style={{
                          width: '100%',
                          height: 36,
                          borderRadius: 8,
                          outline: 'none',
                        }}
                      >
                        Your browser does not support audio playback.
                      </audio>
                    </Box>
                  )}

                  {/* Transcript Snippet */}
                  {audio.transcription && (
                    <Box
                      sx={{
                        p: 1,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        border: (theme) => `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.25 }}>
                        STT Transcript:
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.primary',
                          fontFamily: "'Noto Sans Ethiopic', 'Nyala', sans-serif",
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {audio.transcription}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Grid>
            );
          })}
        </Grid>
        </Box>
      )}
    </Paper>
  );
});

ReportAudioPlayerDeck.displayName = 'ReportAudioPlayerDeck';

ReportAudioPlayerDeck.propTypes = {
  audios: PropTypes.arrayOf(PropTypes.object),
};

export default ReportAudioPlayerDeck;
