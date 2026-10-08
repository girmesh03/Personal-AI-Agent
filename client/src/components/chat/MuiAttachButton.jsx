/**
 * @module components/chat/MuiAttachButton
 * @description Modular attachment trigger button for the chat composer.
 * Renders in the bottom composer toolbar left cluster.
 * Opens the native OS file picker and validates incoming files against
 * ATTACHMENT_CONSTANTS and AUDIO_CONSTANTS via validateChatAttachments before
 * registering them into the composer's draft store.
 */

import { useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { useChatComposer, useChatStatus } from '@mui/x-chat-headless';
import { validateChatAttachments } from '../../utils/validateChatAttachment.js';
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

      if (validation.isValid && Array.isArray(validation.validFiles)) {
        validation.validFiles.forEach((file) => {
          if (typeof composer?.addAttachment === 'function') {
            composer.addAttachment(file);
          }
        });
      }

      // Reset native input value so user can re-select the same file if needed
      e.target.value = '';
    },
    [composer]
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

MuiAttachButton.propTypes = {
  disabled: PropTypes.bool,
};

export default MuiAttachButton;
