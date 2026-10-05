/**
 * @module components/chat/ChatComposerToolbar
 * @description Multi-modal conversational composer toolbar integrating dual-cluster layout,
 * Send/Stop state machine, in-composer Addis AI voice transcription, compact audio recording HUD,
 * file attachment validation, and model governance controls.
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import MicIcon from '@mui/icons-material/Mic';
import SendIcon from '@mui/icons-material/Send';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import TuneIcon from '@mui/icons-material/Tune';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ImageIcon from '@mui/icons-material/Image';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import DescriptionIcon from '@mui/icons-material/Description';
import CloseIcon from '@mui/icons-material/Close';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';

import MuiTextField from '../reusable/MuiTextField.jsx';
import MuiButton from '../reusable/MuiButton.jsx';
import AudioRecordingHud from './AudioRecordingHud.jsx';
import InferenceSettingsSheet from './InferenceSettingsSheet.jsx';
import {
  selectActiveModel,
  selectLanguage,
  selectSttEngine,
  useTranscribeAudioMutation,
} from '../../redux/features/chatSlice.js';
import { useAudioRecorder } from '../../hooks/useAudioRecorder.js';
import {
  validateChatAttachments,
  formatBytesToMb,
} from '../../utils/validateChatAttachment.js';
import { ATTACHMENT_CONSTANTS } from '../../utils/constants.js';

/**
 * Resolves the appropriate icon for an attachment based on its MIME type or file name.
 *
 * @function getAttachmentIcon
 * @param {File} file - Attached file object.
 * @returns {JSX.Element} Icon element.
 */
const getAttachmentIcon = (file) => {
  const type = (file?.type || '').toLowerCase();
  const name = (file?.name || '').toLowerCase();

  if (type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/.test(name)) {
    return <ImageIcon sx={{ fontSize: 16 }} />;
  }
  if (type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|webm)$/.test(name)) {
    return <AudiotrackIcon sx={{ fontSize: 16 }} />;
  }
  return <DescriptionIcon sx={{ fontSize: 16 }} />;
};

/**
 * Multi-Modal Composer Toolbar Component.
 *
 * @component ChatComposerToolbar
 * @param {object} props - Component properties.
 * @param {string} [props.text=''] - Current draft prompt text.
 * @param {Function} [props.onTextChange] - Callback when text changes.
 * @param {Function} [props.onSend] - Callback to dispatch user message turn.
 * @param {Function} [props.onStop] - Callback to abort active streaming generation.
 * @param {boolean} [props.isStreaming=false] - Whether assistant reply is currently streaming.
 * @param {boolean} [props.disabled=false] - Whether composer controls are disabled.
 * @param {File[]} [props.attachments=[]] - Active draft attached files.
 * @param {Function} [props.onAttachmentsChange] - Callback when attached files array updates.
 * @param {object} [props.recorder] - Optional external audio recorder instance from useAudioRecorder.
 * @param {string} [props.chatId] - Active chat session identifier.
 * @param {boolean} [props.isQuotaExhausted=false] - Whether 429 quota exhaustion alert is active.
 * @param {Function} [props.onQuotaRecover] - Callback when 429 fallback switch completes.
 * @param {string} [props.placeholder='Ask about branch operations, daily visits, or dictate report...'] - Placeholder text.
 * @param {boolean} [props.hideInput=false] - Whether to hide the textarea and render only toolbar buttons.
 * @param {object} [props.sx] - Material-UI sx style overrides.
 * @returns {JSX.Element} Rendered composer toolbar.
 */
export const ChatComposerToolbar = ({
  text = '',
  onTextChange,
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  attachments = [],
  onAttachmentsChange,
  recorder: externalRecorder,
  chatId,
  isQuotaExhausted = false,
  onQuotaRecover,
  placeholder = 'Ask about branch operations, daily visits, or dictate report...',
  hideInput = false,
  sx = {},
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const activeModel = useSelector(selectActiveModel);
  const currentLanguage = useSelector(selectLanguage);
  const currentSttEngine = useSelector(selectSttEngine);

  const internalRecorder = useAudioRecorder();
  const activeRecorder = externalRecorder || internalRecorder;

  const [transcribeAudio, { isLoading: isTranscribing }] =
    useTranscribeAudioMutation();

  const fileInputRef = useRef(null);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState(null);
  const [transcriptionError, setTranscriptionError] = useState(false);

  const isSettingsOpen = Boolean(settingsAnchorEl);

  // Model display label
  const modelLabel = useMemo(() => {
    switch (activeModel) {
      case 'gemini-2.5-flash-lite':
        return 'Flash-Lite';
      case 'gemini-2.5-pro':
        return 'Gemini Pro';
      case 'gemini-2.5-flash':
      default:
        return 'Gemini Flash';
    }
  }, [activeModel]);

  // Open & close model settings sheet
  const handleOpenSettings = useCallback((event) => {
    setSettingsAnchorEl(event.currentTarget);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsAnchorEl(null);
  }, []);

  // File picker trigger
  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // File selection & 4-gate pre-validation
  const handleFileSelect = useCallback(
    (event) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const validation = validateChatAttachments(files, attachments);
      if (validation.isValid) {
        const nextAttachments = [...attachments, ...validation.validFiles];
        onAttachmentsChange?.(nextAttachments);
      }

      // Reset file input so identical file can be re-selected if removed
      event.target.value = '';
    },
    [attachments, onAttachmentsChange]
  );

  // Remove individual attachment chip
  const handleRemoveAttachment = useCallback(
    (indexToRemove) => {
      const nextAttachments = attachments.filter((_, idx) => idx !== indexToRemove);
      onAttachmentsChange?.(nextAttachments);
    },
    [attachments, onAttachmentsChange]
  );

  // Voice recording: start
  const handleStartRecording = useCallback(async () => {
    setTranscriptionError(false);
    await activeRecorder.startRecording();
  }, [activeRecorder]);

  // Voice recording: stop and execute ephemeral transcription
  const handleAcceptRecording = useCallback(async () => {
    const blob = await activeRecorder.stopRecording();
    if (!blob) return;

    setTranscriptionError(false);

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('engine', currentSttEngine);
      formData.append('language', currentLanguage);

      const res = await transcribeAudio(formData).unwrap();
      const transcribedText = res?.data?.text || res?.text || '';

      if (transcribedText.trim()) {
        const updated = text && text.trim().length > 0
          ? `${text} ${transcribedText.trim()}`
          : transcribedText.trim();
        onTextChange?.(updated);
        toast.success('Voice transcribed successfully.');
        activeRecorder.clearCachedBlob();
      } else {
        toast.info('No speech recognized in audio note.');
      }
    } catch {
      setTranscriptionError(true);
      toast.error('Failed to transcribe audio. Click retry to try again.');
    }
  }, [
    activeRecorder,
    currentSttEngine,
    currentLanguage,
    transcribeAudio,
    text,
    onTextChange,
  ]);

  // Voice recording: discard
  const handleDiscardRecording = useCallback(() => {
    activeRecorder.cancelRecording();
    activeRecorder.clearCachedBlob();
    setTranscriptionError(false);
  }, [activeRecorder]);

  // Voice recording: zero-loss in-memory retry
  const handleRetryTranscription = useCallback(async () => {
    const cachedBlob = activeRecorder.cachedAudioBlob;
    if (!cachedBlob) return;

    setTranscriptionError(false);

    try {
      const formData = new FormData();
      formData.append('audio', cachedBlob, 'recording.webm');
      formData.append('engine', currentSttEngine);
      formData.append('language', currentLanguage);

      const res = await transcribeAudio(formData).unwrap();
      const transcribedText = res?.data?.text || res?.text || '';

      if (transcribedText.trim()) {
        const updated = text && text.trim().length > 0
          ? `${text} ${transcribedText.trim()}`
          : transcribedText.trim();
        onTextChange?.(updated);
        toast.success('Voice transcribed successfully.');
        activeRecorder.clearCachedBlob();
      } else {
        toast.info('No speech recognized in audio note.');
      }
    } catch {
      setTranscriptionError(true);
      toast.error('Retry failed. Please check network connection.');
    }
  }, [
    activeRecorder,
    currentSttEngine,
    currentLanguage,
    transcribeAudio,
    text,
    onTextChange,
  ]);

  // Keyboard shortcut: Enter to submit, Shift+Enter for newline
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const hasContent =
          (text && text.trim().length > 0) || (attachments && attachments.length > 0);
        if (hasContent && !disabled && !isStreaming && !isTranscribing) {
          onSend?.();
        }
      }
    },
    [text, attachments, disabled, isStreaming, isTranscribing, onSend]
  );

  const hasText = Boolean(text && text.trim().length > 0);
  const hasAttachments = Boolean(attachments && attachments.length > 0);
  const isSendDisabled =
    (!hasText && !hasAttachments) ||
    disabled ||
    isTranscribing ||
    activeRecorder.isRecording;

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        p: 1.25,
        boxShadow: (themeMode) =>
          themeMode.palette.mode === 'dark'
            ? '0 2px 8px rgba(0,0,0,0.4)'
            : '0 2px 8px rgba(0,0,0,0.04)',
        ...sx,
      }}
    >
      {/* 1. Attachment Chips Preview Row */}
      {hasAttachments && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.75,
            mb: 1,
            maxHeight: 90,
            overflowY: 'auto',
          }}
        >
          {attachments.map((file, idx) => (
            <Chip
              key={`${file.name}-${idx}`}
              icon={getAttachmentIcon(file)}
              label={`${file.name} (${formatBytesToMb(file.size)})`}
              size="small"
              variant="outlined"
              onDelete={() => handleRemoveAttachment(idx)}
              deleteIcon={<CloseIcon sx={{ fontSize: 14 }} />}
              sx={{
                maxWidth: 240,
                fontSize: '0.75rem',
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }}
            />
          ))}
        </Box>
      )}

      {/* 2. Composer Multiline Input Area */}
      {!hideInput && (
        <MuiTextField
          fullWidth
          multiline
          minRows={1}
          maxRows={6}
          value={text}
          onChange={(e) => onTextChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || activeRecorder.isRecording}
          helperText=""
          slotProps={{
            formHelperText: {
              sx: { display: 'none' },
            },
            input: {
              sx: {
                py: 0.75,
                px: 1,
                fontSize: '0.9375rem',
                border: 'none',
                '& fieldset': { border: 'none' },
              },
            },
          }}
        />
      )}

      {/* 3. Toolbar Row: Dual-Cluster Layout */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pt: hideInput ? 0 : 0.5,
        }}
      >
        {/* LEFT CLUSTER: [📎 Attach] + Model Selector */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          {/* File Picker Trigger */}
          <Tooltip title="Attach files (up to 5, max 25MB each)">
            <span>
              <IconButton
                size="small"
                onClick={handleAttachClick}
                disabled={disabled || isStreaming || activeRecorder.isRecording}
                aria-label="Attach files"
                sx={{ p: 0.75 }}
              >
                <AttachFileIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </span>
          </Tooltip>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ATTACHMENT_CONSTANTS.ALLOWED_EXTENSIONS.join(',')}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {/* Model Selector: Mobile Icon (TuneIcon) vs Desktop Pill */}
          {isMobile ? (
            <Tooltip title={`Model: ${modelLabel}`}>
              <IconButton
                size="small"
                onClick={handleOpenSettings}
                aria-label="Model inference settings"
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  width: 32,
                  height: 32,
                  p: 0.5,
                }}
              >
                <TuneIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          ) : (
            <MuiButton
              size="small"
              variant="outlined"
              onClick={handleOpenSettings}
              startIcon={<AutoAwesomeIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
              endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: 'none',
                color: 'text.secondary',
                borderColor: 'divider',
                borderRadius: 2,
                px: 1,
                py: 0.25,
                fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              {modelLabel}
            </MuiButton>
          )}
        </Box>

        {/* RIGHT CLUSTER: [🎙 Mic / HUD] + [➤ Send / ⏹ Stop] */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          {/* Audio Dictation Control / Morphing HUD */}
          {activeRecorder.isRecording || isTranscribing || transcriptionError ? (
            <AudioRecordingHud
              recorder={activeRecorder}
              isTranscribing={isTranscribing}
              hasError={transcriptionError}
              onAccept={handleAcceptRecording}
              onDiscard={handleDiscardRecording}
              onRetry={handleRetryTranscription}
            />
          ) : (
            <Tooltip title="Voice dictation (record & transcribe)">
              <span>
                <IconButton
                  size="small"
                  color="default"
                  onClick={handleStartRecording}
                  disabled={disabled || isStreaming}
                  aria-label="Voice dictation"
                  sx={{ p: 0.75 }}
                >
                  <MicIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {/* Send / Stop State Machine Button */}
          {isStreaming ? (
            <Tooltip title="Stop generation">
              <IconButton
                size="small"
                color="error"
                onClick={onStop}
                aria-label="Stop response generation"
                sx={{
                  p: 0.75,
                  bgcolor: (themeMode) =>
                    themeMode.palette.mode === 'dark'
                      ? 'rgba(244, 67, 54, 0.15)'
                      : 'rgba(211, 47, 47, 0.1)',
                  '&:hover': {
                    bgcolor: (themeMode) =>
                      themeMode.palette.mode === 'dark'
                        ? 'rgba(244, 67, 54, 0.25)'
                        : 'rgba(211, 47, 47, 0.2)',
                  },
                }}
              >
                <StopCircleIcon sx={{ fontSize: 22 }} />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Send message">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={onSend}
                  disabled={isSendDisabled}
                  aria-label="Send message"
                  sx={{
                    p: 0.75,
                    bgcolor: isSendDisabled
                      ? 'action.disabledBackground'
                      : (themeMode) =>
                          themeMode.palette.mode === 'dark'
                            ? 'rgba(33, 150, 243, 0.15)'
                            : 'rgba(25, 118, 210, 0.1)',
                    '&:hover': {
                      bgcolor: isSendDisabled
                        ? 'action.disabledBackground'
                        : (themeMode) =>
                            themeMode.palette.mode === 'dark'
                              ? 'rgba(33, 150, 243, 0.25)'
                              : 'rgba(25, 118, 210, 0.2)',
                    },
                  }}
                >
                  <SendIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Model Governance Settings Sheet */}
      <InferenceSettingsSheet
        open={isSettingsOpen}
        anchorEl={settingsAnchorEl}
        onClose={handleCloseSettings}
        chatId={chatId}
        isQuotaExhausted={isQuotaExhausted}
        onQuotaRecover={onQuotaRecover}
      />
    </Box>
  );
};

ChatComposerToolbar.propTypes = {
  text: PropTypes.string,
  onTextChange: PropTypes.func,
  onSend: PropTypes.func,
  onStop: PropTypes.func,
  isStreaming: PropTypes.bool,
  disabled: PropTypes.bool,
  attachments: PropTypes.arrayOf(PropTypes.any),
  onAttachmentsChange: PropTypes.func,
  recorder: PropTypes.object,
  chatId: PropTypes.string,
  isQuotaExhausted: PropTypes.bool,
  onQuotaRecover: PropTypes.func,
  placeholder: PropTypes.string,
  hideInput: PropTypes.bool,
  sx: PropTypes.object,
};

export default ChatComposerToolbar;
