/**
 * @module components/chat/MuiAudioRecorder
 * @description In-composer voice dictation and audio recording component.
 * Integrates useAudioRecorder hook with Addis AI / Gemini STT backend.
 * Features a compact morphing recording HUD with:
 * - Real-time acoustic frequency visualizer bars scaling with voice amplitude
 * - Monospace duration timer with pulsing red recording indicator
 * - 1-click stop & transcribe with automatic Amharic STT injection into composer
 * - Discard / cancel actions cleanly aborting hardware streams
 * - Zero-loss cached audio retry affordance on STT network failures
 * - Empty-audio / silence suppression ignoring empty dictations
 */

import { useState, forwardRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import MicIcon from '@mui/icons-material/Mic';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { useChatComposer, useChatStatus } from '@mui/x-chat-headless';
import { useAudioRecorder } from '../../hooks/useAudioRecorder.js';
import {
  useTranscribeAudioMutation,
  selectSttEngine,
  selectLanguage,
} from '../../redux/features/chatSlice.js';

/**
 * MuiAudioRecorder component.
 * Seamlessly morphs between idle microphone button and active recording HUD.
 */
export const MuiAudioRecorder = forwardRef((props, ref) => {
  const { disabled = false } = props;
  const composer = useChatComposer();
  const { isStreaming } = useChatStatus();
  const [transcribeAudio, { isLoading: isTranscribing }] = useTranscribeAudioMutation();
  const [hasTranscriptionError, setHasTranscriptionError] = useState(false);
  const sttEngine = useSelector(selectSttEngine);
  const language = useSelector(selectLanguage);

  const {
    isRecording,
    formattedDuration,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    cachedAudioBlob,
    clearCachedBlob,
  } = useAudioRecorder();

  const isDisabled = Boolean(disabled || isStreaming || composer?.isSubmitting || isTranscribing);

  /**
   * Executes audio transcription via backend /api/v1/chat/transcribe-audio endpoint.
   */
  const executeTranscription = useCallback(
    async (blobToTranscribe) => {
      if (!blobToTranscribe || blobToTranscribe.size === 0) {
        toast.info('No audio detected in recording.');
        clearCachedBlob();
        setHasTranscriptionError(false);
        return;
      }

      setHasTranscriptionError(false);
      const formData = new FormData();
      const ext = blobToTranscribe.type.includes('wav')
        ? '.wav'
        : blobToTranscribe.type.includes('ogg')
          ? '.ogg'
          : '.webm';
      const file = new File([blobToTranscribe], `recording-${Date.now()}${ext}`, {
        type: blobToTranscribe.type || 'audio/webm',
      });
      formData.append('audio', file);
      if (sttEngine) {
        formData.append('engine', sttEngine);
      }
      formData.append('language', language || 'am');

      try {
        const res = await transcribeAudio(formData).unwrap();
        const data = res?.data || res;
        const text = (data?.text || '').trim();

        if (!text || data?.noAudioDetected === true) {
          toast.info('No speech detected in recording.');
          clearCachedBlob();
          setHasTranscriptionError(false);
          return;
        }

        // Speech detected: append to existing composer draft
        const current = composer?.value || '';
        const updated = current.trim() ? `${current.trim()} ${text}` : text;
        if (typeof composer?.setValue === 'function') {
          composer.setValue(updated);
        }

        // Synchronize DOM textarea
        const textarea = document.querySelector('textarea[name="chat-prompt-input"]');
        if (textarea) {
          textarea.value = updated;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        toast.success('Voice transcribed successfully.');
        clearCachedBlob();
        setHasTranscriptionError(false);
      } catch (err) {
        const msg = err?.data?.message || err?.message || 'Failed to transcribe audio.';
        toast.error(msg);
        setHasTranscriptionError(true);
      }
    },
    [clearCachedBlob, composer, transcribeAudio, sttEngine, language]
  );

  /**
   * Starts microphone recording.
   */
  const handleStart = useCallback(async () => {
    setHasTranscriptionError(false);
    clearCachedBlob();
    await startRecording();
  }, [clearCachedBlob, startRecording]);

  /**
   * Discards active recording without transcribing.
   */
  const handleDiscard = useCallback(() => {
    cancelRecording();
    clearCachedBlob();
    setHasTranscriptionError(false);
  }, [cancelRecording, clearCachedBlob]);

  /**
   * Stops recording and executes speech transcription.
   */
  const handleStopAndTranscribe = useCallback(async () => {
    const blob = await stopRecording();
    if (blob) {
      await executeTranscription(blob);
    }
  }, [executeTranscription, stopRecording]);

  /**
   * Dismisses failed transcription error state.
   */
  const handleDismissError = useCallback(() => {
    setHasTranscriptionError(false);
    clearCachedBlob();
  }, [clearCachedBlob]);

  // State 1: Active Transcription Processing
  if (isTranscribing) {
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
          Transcribing...
        </Typography>
      </Box>
    );
  }

  // State 2: Transcription Error with Zero-Loss 1-Click Retry
  if (hasTranscriptionError && cachedAudioBlob && !isRecording) {
    return (
      <Box
        ref={ref}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: { xs: 0.5, sm: 0.75 },
          px: 1,
          py: 0.5,
          borderRadius: 2,
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(237, 108, 2, 0.12)' : 'rgba(237, 108, 2, 0.08)',
          border: '1px solid',
          borderColor: 'warning.main',
          maxWidth: { xs: 130, sm: 220 },
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <Tooltip title="Discard recorded audio">
          <IconButton
            size="small"
            onClick={handleDismissError}
            aria-label="Discard recorded audio"
            sx={{ p: 0.25 }}
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
            onClick={() => executeTranscription(cachedAudioBlob)}
            color="warning"
            aria-label="Retry transcription"
            sx={{ p: 0.25 }}
          >
            <ReplayIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  // State 3: Active Recording HUD with Live Waveform Bars
  if (isRecording) {
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
        }}
      >
        {/* Discard button */}
        <Tooltip title="Discard recording">
          <IconButton
            size="small"
            onClick={handleDiscard}
            color="error"
            aria-label="Discard recording"
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

        {/* Stop and transcribe checkmark button */}
        <Tooltip title="Stop and transcribe">
          <IconButton
            size="small"
            onClick={handleStopAndTranscribe}
            color="primary"
            aria-label="Stop and transcribe"
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

  // State 4: Idle Microphone Trigger Button
  return (
    <Tooltip title="Voice dictation (record & transcribe)">
      <span>
        <IconButton
          ref={ref}
          size="small"
          disabled={isDisabled}
          onClick={handleStart}
          aria-label="Voice dictation"
          sx={{
            p: 0.75,
            color: 'text.secondary',
            transition: 'color 150ms ease, transform 150ms ease',
            '&:hover': {
              color: 'primary.main',
              bgcolor: 'action.hover',
              transform: 'scale(1.05)',
            },
            '&.Mui-disabled': {
              color: 'action.disabled',
            },
          }}
        >
          <MicIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </span>
    </Tooltip>
  );
});

MuiAudioRecorder.displayName = 'MuiAudioRecorder';

export default MuiAudioRecorder;
