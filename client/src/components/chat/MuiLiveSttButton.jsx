/**
 * @module components/chat/MuiLiveSttButton
 * @description Decoupled, reusable Live Speech-to-Text (STT) button powered by Addis AI Scribe.
 * When idle, sits side-by-side with the microphone button.
 * When activated, hides the mic and renders an exact visual twin HUD matching MuiAudioRecorder:
 * - Identical container styling, border, and responsive dimensions
 * - Discard button (DeleteOutlineIcon, color: error)
 * - Pulsing live indicator dot + monospace duration timer
 * - Real-time acoustic frequency visualizer bars scaling with voice audioLevel
 * - Finish checkmark button (CheckIcon, color: primary)
 *
 * Agnostic of chat - can be used anywhere in the application.
 */

import { forwardRef, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { useChatComposer, useChatStatus } from '@mui/x-chat-headless';
import { useAddisLiveStt } from '../../hooks/useAddisLiveStt.js';
import { selectLanguage } from '../../redux/features/chatSlice.js';

export const MuiLiveSttButton = forwardRef((props, ref) => {
  const {
    onTranscript: customOnTranscript,
    onActiveChange,
    disabled = false,
    size = 'small',
    sx = {},
  } = props;

  const composer = useChatComposer();
  const { isStreaming } = useChatStatus();
  const defaultLanguage = useSelector(selectLanguage);

  const baseTextRef = useRef('');

  // Handle live incoming transcripts
  const handleTranscript = useCallback(
    ({ partial, final, text, isFinal }) => {
      if (typeof customOnTranscript === 'function') {
        customOnTranscript({ partial, final, text, isFinal });
        return;
      }

      const base = baseTextRef.current || '';
      const incoming = (final || partial || text || '').trim();
      if (!incoming) return;

      const combined = base.trim() ? `${base.trim()} ${incoming}` : incoming;

      if (typeof composer?.setValue === 'function') {
        composer.setValue(combined);
      }

      const textarea = document.querySelector('textarea[name="chat-prompt-input"]');
      if (textarea) {
        textarea.value = combined;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (isFinal) {
        baseTextRef.current = combined;
      }
    },
    [composer, customOnTranscript]
  );

  const handleError = useCallback((err) => {
    toast.error(err?.message || 'Addis AI Live STT error.');
  }, []);

  const {
    isListening,
    isConnecting,
    formattedDuration,
    audioLevel,
    startListening,
    stopListening,
    cancelListening,
  } = useAddisLiveStt({
    onTranscript: handleTranscript,
    onError: handleError,
    language: defaultLanguage || 'am',
  });

  // Notify parent toolbar to hide/show the mic button
  useEffect(() => {
    onActiveChange?.(isListening || isConnecting);
  }, [isListening, isConnecting, onActiveChange]);

  const handleStart = useCallback(() => {
    baseTextRef.current = composer?.value || '';
    startListening();
  }, [composer, startListening]);

  const handleStop = useCallback(() => {
    stopListening();
    toast.success('Live transcription complete.');
  }, [stopListening]);

  const handleDiscard = useCallback(() => {
    cancelListening();
    if (typeof composer?.setValue === 'function') {
      composer.setValue(baseTextRef.current || '');
    }
  }, [cancelListening, composer]);

  const isButtonDisabled = Boolean(
    disabled || isStreaming || composer?.isSubmitting
  );

  // State 1: Active Connecting State
  if (isConnecting) {
    return (
      <Box
        ref={ref}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: { xs: 0.75, sm: 1.25 },
          py: 0.5,
          borderRadius: 2,
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
          border: '1px solid',
          borderColor: 'divider',
          maxWidth: { xs: 130, sm: 220 },
          flexShrink: 0,
          overflow: 'hidden',
          ...sx,
        }}
      >
        <CircularProgress size={16} sx={{ color: 'primary.main', flexShrink: 0 }} />
        <Typography
          variant="caption"
          sx={{
            display: { xs: 'none', sm: 'inline' },
            fontSize: '0.75rem',
            color: 'text.secondary',
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}
        >
          Connecting...
        </Typography>
      </Box>
    );
  }

  // State 2: Active Listening Recording HUD (Exact Visual Twin of MuiAudioRecorder)
  if (isListening) {
    return (
      <Box
        ref={ref}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: { xs: 0.5, sm: 0.75 },
          px: { xs: 0.75, sm: 1.25 },
          py: 0.5,
          borderRadius: 2,
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
          border: '1px solid',
          borderColor: 'divider',
          maxWidth: { xs: 130, sm: 220 },
          flexShrink: 0,
          overflow: 'hidden',
          ...sx,
        }}
      >
        {/* Discard button */}
        <Tooltip title="Discard live dictation">
          <IconButton
            size="small"
            onClick={handleDiscard}
            color="error"
            aria-label="Discard live dictation"
            sx={{ p: 0.25 }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        {/* Pulsing indicator + Duration timer */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'error.main',
              flexShrink: 0,
              animation: 'audioPulse 1.4s infinite ease-in-out',
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

        {/* Real-time acoustic frequency visualizer bars */}
        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            gap: '2px',
            height: 16,
            px: 0.25,
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

        {/* Stop and finish checkmark button */}
        <Tooltip title="Finish live dictation">
          <IconButton
            size="small"
            onClick={handleStop}
            color="primary"
            aria-label="Finish live dictation"
            sx={{
              p: 0.25,
              bgcolor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(33, 150, 243, 0.2)'
                  : 'rgba(25, 118, 210, 0.12)',
              '&:hover': {
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(33, 150, 243, 0.35)'
                    : 'rgba(25, 118, 210, 0.22)',
              },
            }}
          >
            <CheckIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  // State 3: Idle Live STT Waveform Button
  return (
    <Tooltip title="Live Speech-to-Text (Addis AI)" arrow>
      <span>
        <IconButton
          ref={ref}
          size={size}
          onClick={handleStart}
          disabled={isButtonDisabled}
          color="inherit"
          aria-label="Live Speech-to-Text"
          sx={{
            p: 0.5,
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary',
              bgcolor: 'action.hover',
            },
            '&:disabled': {
              color: 'text.disabled',
            },
            ...sx,
          }}
        >
          <GraphicEqIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </span>
    </Tooltip>
  );
});

MuiLiveSttButton.displayName = 'MuiLiveSttButton';

MuiLiveSttButton.propTypes = {
  onTranscript: PropTypes.func,
  onActiveChange: PropTypes.func,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  sx: PropTypes.object,
};

export default MuiLiveSttButton;
