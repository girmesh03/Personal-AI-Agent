/**
 * @module components/chat/AudioRecordingHud
 * @description Compact responsive audio recording heads-up display (HUD).
 * Provides a live pulsing duration timer, real-time frequency level animation,
 * discard and accept controls, icon-only transcription loaders, and in-memory retry retention.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ReplayIcon from '@mui/icons-material/Replay';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import PropTypes from 'prop-types';

/**
 * Compact audio recording HUD component designed to seamlessly morph within the composer toolbar.
 * Enforces a strict maximum width limit on mobile viewports (xs <= 120px) to prevent toolbar wrapping.
 *
 * @component AudioRecordingHud
 * @param {object} props - Component properties.
 * @param {object} [props.recorder] - Active recorder instance from useAudioRecorder hook.
 * @param {boolean} [props.isTranscribing=false] - Whether speech-to-text mutation is actively processing.
 * @param {boolean} [props.hasError=false] - Whether transcription failed and requires retry affordance.
 * @param {Function} [props.onAccept] - Callback when user accepts and stops the recording.
 * @param {Function} [props.onDiscard] - Callback when user cancels and discards the recording.
 * @param {Function} [props.onRetry] - Callback to retry transcription using cached audio blob.
 * @param {object} [props.sx] - Material-UI sx style overrides.
 * @returns {JSX.Element|null} Rendered recording HUD or null when inactive.
 */
export const AudioRecordingHud = ({
  recorder,
  isTranscribing = false,
  hasError = false,
  onAccept,
  onDiscard,
  onRetry,
  sx = {},
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const isRecording = Boolean(recorder?.isRecording);
  const formattedDuration = recorder?.formattedDuration || '00:00';
  const audioLevel = recorder?.audioLevel || 0;
  const hasCachedAudio = Boolean(recorder?.cachedAudioBlob);

  // Early return after unconditional hooks if HUD has no active lifecycle state
  if (!isRecording && !isTranscribing && !hasError && !hasCachedAudio) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: { xs: 0.5, sm: 1 },
        px: { xs: 0.75, sm: 1.25 },
        py: 0.5,
        borderRadius: 2,
        bgcolor: (themeMode) =>
          themeMode.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.06)'
            : 'rgba(0, 0, 0, 0.04)',
        border: '1px solid',
        borderColor: hasError ? 'warning.main' : 'divider',
        maxWidth: { xs: 120, sm: 220 },
        flexShrink: 0,
        overflow: 'hidden',
        ...sx,
      }}
    >
      {/* 1. Transcribing State: Icon-only loader preserving compact mobile geometry */}
      {isTranscribing && (
        <Tooltip title="Transcribing audio...">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5 }}>
            <CircularProgress size={18} sx={{ color: 'primary.main', flexShrink: 0 }} />
            {!isMobile && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                Transcribing...
              </Typography>
            )}
          </Box>
        </Tooltip>
      )}

      {/* 2. Error / Retry State: Zero-loss cached audio retry affordance */}
      {!isTranscribing && hasError && hasCachedAudio && (
        <>
          <Tooltip title="Discard recorded audio">
            <IconButton
              size="small"
              onClick={onDiscard}
              aria-label="Discard recorded audio"
              sx={{ p: 0.5 }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              fontWeight: 600,
              fontSize: '0.75rem',
              color: 'warning.main',
              letterSpacing: '0.02em',
              flexShrink: 0,
            }}
          >
            {formattedDuration}
          </Typography>

          <Tooltip title="Retry transcription">
            <IconButton
              size="small"
              onClick={onRetry}
              color="warning"
              aria-label="Retry transcription"
              sx={{ p: 0.5 }}
            >
              <ReplayIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </>
      )}

      {/* 3. Active Recording State: Discard, Pulsing Dot + Timer, Frequency Bars, and Checkmark */}
      {!isTranscribing && !hasError && isRecording && (
        <>
          <Tooltip title="Discard recording">
            <IconButton
              size="small"
              onClick={onDiscard}
              aria-label="Discard recording"
              color="error"
              sx={{ p: 0.5 }}
            >
              <DeleteOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'error.main',
                flexShrink: 0,
                animation: 'audioPulse 1.5s infinite ease-in-out',
                '@keyframes audioPulse': {
                  '0%': { opacity: 1, transform: 'scale(1)' },
                  '50%': { opacity: 0.3, transform: 'scale(0.8)' },
                  '100%': { opacity: 1, transform: 'scale(1)' },
                },
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: '0.75rem',
                color: 'text.primary',
                letterSpacing: '0.02em',
              }}
            >
              {formattedDuration}
            </Typography>
          </Box>

          {/* Real-time Frequency visualizer bars (tablet/desktop sm+ only) */}
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              gap: '2px',
              height: 16,
              px: 0.5,
            }}
          >
            {[0.6, 1.0, 0.4].map((multiplier, idx) => {
              const barHeight = Math.max(
                3,
                Math.min(14, Math.round(audioLevel * 14 * multiplier + 3))
              );
              return (
                <Box
                  key={idx}
                  sx={{
                    width: 2.5,
                    height: `${barHeight}px`,
                    bgcolor: 'error.main',
                    borderRadius: 0.5,
                    transition: 'height 80ms ease',
                  }}
                />
              );
            })}
          </Box>

          <Tooltip title="Stop and transcribe">
            <IconButton
              size="small"
              onClick={onAccept}
              aria-label="Stop and transcribe"
              color="primary"
              sx={{
                p: 0.5,
                bgcolor: (themeMode) =>
                  themeMode.palette.mode === 'dark'
                    ? 'rgba(33, 150, 243, 0.15)'
                    : 'rgba(25, 118, 210, 0.1)',
                '&:hover': {
                  bgcolor: (themeMode) =>
                    themeMode.palette.mode === 'dark'
                      ? 'rgba(33, 150, 243, 0.25)'
                      : 'rgba(25, 118, 210, 0.2)',
                },
              }}
            >
              <CheckIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
};

AudioRecordingHud.propTypes = {
  recorder: PropTypes.shape({
    isRecording: PropTypes.bool,
    duration: PropTypes.number,
    formattedDuration: PropTypes.string,
    audioLevel: PropTypes.number,
    cachedAudioBlob: PropTypes.any,
  }),
  isTranscribing: PropTypes.bool,
  hasError: PropTypes.bool,
  onAccept: PropTypes.func,
  onDiscard: PropTypes.func,
  onRetry: PropTypes.func,
  sx: PropTypes.object,
};

export default AudioRecordingHud;
