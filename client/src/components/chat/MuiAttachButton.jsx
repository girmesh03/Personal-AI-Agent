/**
 * @module components/chat/MuiAttachButton
 * @description Modular attachment trigger button for the chat composer.
 * Renders in the bottom composer toolbar left cluster.
 * Opens the native OS file picker and validates incoming files against
 * ATTACHMENT_CONSTANTS and AUDIO_CONSTANTS via validateChatAttachments before
 * registering them into the composer's draft store.
 */

import { useRef, useCallback } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { useChatComposer, useChatStatus } from '@mui/x-chat-headless';
import {
  useUploadAttachmentsMutation,
  useUploadAudioMutation,
  useDeleteComposerAttachmentMutation,
} from '../../redux/features/chatSlice.js';
import { registerUpload } from '../../utils/attachmentRegistry.js';
import { validateChatAttachments, isAudioAttachment } from '../../utils/validateChatAttachment.js';
import { CHAT_FILE_ACCEPT } from '../../utils/constants.js';

/**
 * MuiAttachButton component.
 * @param {object} props - Component props.
 * @param {boolean} [props.disabled] - Optional external disabled override.
 * @returns {React.ReactElement}
 */
export const MuiAttachButton = ({ disabled = false }) => {
  const inputRef = useRef(null);
  const composer = useChatComposer();
  const status = useChatStatus();
  const [uploadAttachments] = useUploadAttachmentsMutation();
  const [uploadAudio] = useUploadAudioMutation();
  const [deleteComposerAttachment] = useDeleteComposerAttachmentMutation();

  const isStreaming = Boolean(status?.isStreaming);
  const isComposerDisabled = Boolean(composer?.disabled);
  const isDisabled = disabled || isStreaming || isComposerDisabled;

  const handleOpenPicker = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback(
    (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const currentFiles = (composer?.attachments || [])
        .map((att) => att.file)
        .filter(Boolean);

      const validation = validateChatAttachments(files, currentFiles, { showToast: true });

      if (validation.isValid && Array.isArray(validation.validFiles) && validation.validFiles.length > 0) {
        validation.validFiles.forEach((file) => {
          if (typeof composer?.addAttachment === 'function') {
            composer.addAttachment(file);
          }

          const isAudio = isAudioAttachment(file);
          const formData = new FormData();
          let mutationPromise;

          if (isAudio) {
            formData.append('audios', file);
            mutationPromise = uploadAudio(formData);
          } else {
            formData.append('attachments', file);
            mutationPromise = uploadAttachments(formData);
          }

          const uploadPromise = mutationPromise
            .unwrap()
            .then((res) => {
              if (isAudio) {
                const audioList = res?.data?.audios || res?.audios || [];
                const first = audioList[0] || null;
                if (first && file) {
                  file._id = first._id || first.id;
                  file.audioId = first._id || first.id;
                  file.fileName = first.fileName;
                  file.publicId = first.publicId;
                  file.cloudUrl = first.cloudUrl;
                }
                return first ? { ...first, isAudio: true } : null;
              }
              const uploadedList = res?.data?.attachments || res?.attachments || [];
              const first = uploadedList[0] || null;
              if (first && file) {
                file._id = first._id || first.id;
                file.fileName = first.fileName;
                file.publicId = first.publicId;
                file.cloudUrl = first.cloudUrl;
              }
              return first ? { ...first, isAudio: false } : null;
            });

          const abortFn = () => {
            try {
              if (mutationPromise && typeof mutationPromise.abort === 'function') {
                mutationPromise.abort();
              }
            } catch {
              // Ignored on abort
            }
          };

          const onResolvedAfterCancelCleanup = (result) => {
            if (result) {
              const publicId = result.publicId;
              const fileName = result.fileName;
              const mimeType = result.mimeType || file.type;
              void deleteComposerAttachment({ publicId, fileName, mimeType });
            }
          };

          registerUpload(file, uploadPromise, abortFn, onResolvedAfterCancelCleanup);
        });
      }

      // Reset native input value so user can re-select the same file if needed
      e.target.value = '';
    },
    [composer, uploadAttachments, uploadAudio, deleteComposerAttachment]
  );

  return (
    <Tooltip title={isDisabled ? '' : 'Attach files'} arrow disableHoverListener={isDisabled}>
      <span>
        <IconButton
          type="button"
          aria-label="Attach files"
          size="small"
          onClick={handleOpenPicker}
          disabled={isDisabled}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary',
              bgcolor: 'action.hover',
            },
            transition: 'none !important',
            p: 0.75,
          }}
        >
          <AttachFileIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <input
          type="file"
          multiple
          ref={inputRef}
          style={{ display: 'none' }}
          accept={CHAT_FILE_ACCEPT}
          onChange={handleFileChange}
        />
      </span>
    </Tooltip>
  );
};

MuiAttachButton.displayName = 'MuiAttachButton';

export default MuiAttachButton;
