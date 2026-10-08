/**
 * @module components/chat/MuiComposerTopToolbar
 * @description Horizontal scroll preview bar for pending chat composer attachments (Row 1).
 * Serves as the ChatComposerAttachmentList slot override.
 * Invariant: Renders strictly null (0 height, 0 margin) when attachments are empty.
 * When attachments are present, renders a single-row flex container with horizontal scrolling,
 * displaying file thumbnails/type badges, truncated filenames, sizes, and dismiss buttons.
 */

import { forwardRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useChatComposer } from '@mui/x-chat-headless';
import { formatBytesToMb } from '../../utils/validateChatAttachment.js';
import { ATTACHMENT_CONSTANTS, AUDIO_CONSTANTS } from '../../utils/constants.js';

/**
 * Checks if a file represents an audio recording or note.
 * Uses centralized AUDIO_CONSTANTS from utils/constants.js.
 * @param {File} file
 * @returns {boolean}
 */
const isAudioAttachment = (file) => {
  if (!file) return false;
  if (file.type && AUDIO_CONSTANTS.ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return true;
  }
  const name = (file.name || '').toLowerCase();
  return AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
};

/**
 * Checks if a file represents an image inspection asset.
 * Uses centralized ATTACHMENT_CONSTANTS from utils/constants.js.
 * @param {File} file
 * @returns {boolean}
 */
const isImageAttachment = (file) => {
  if (!file) return false;
  if (file.type && ATTACHMENT_CONSTANTS.ALLOWED_IMAGE_MIME_TYPES.includes(file.type.toLowerCase())) {
    return true;
  }
  const name = (file.name || '').toLowerCase();
  return ATTACHMENT_CONSTANTS.ALLOWED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
};

/**
 * MuiComposerTopToolbar component.
 */
export const MuiComposerTopToolbar = forwardRef((props, ref) => {
  const composer = useChatComposer();
  const attachments = composer?.attachments || [];

  // Zero Attachment Invariant: Collapse completely when no files are pending
  if (attachments.length === 0) {
    return null;
  }

  return (
    <Box
      ref={ref}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.75,
        width: '100%',
        maxWidth: '100%',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        borderBottom: '1px solid',
        borderColor: 'divider',
        scrollbarWidth: 'thin',
        '&::-webkit-scrollbar': {
          height: 4,
        },
        '&::-webkit-scrollbar-thumb': {
          borderRadius: 2,
          bgcolor: 'divider',
        },
      }}
    >
      {attachments.map((attachment) => {
        const file = attachment.file;
        const fileName = file?.name || 'File';
        const fileSize = file?.size || 0;
        const isImage = isImageAttachment(file);
        const isAudio = isAudioAttachment(file);

        return (
          <Box
            key={attachment.localId}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1,
              py: 0.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              maxWidth: 220,
              flexShrink: 0,
              boxShadow: 'none',
              transition: 'none !important',
            }}
          >
            {/* Visual Icon / Thumbnail */}
            {isImage && attachment.previewUrl ? (
              <Box
                component="img"
                src={attachment.previewUrl}
                alt={fileName}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1,
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : isAudio ? (
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AudioFileIcon sx={{ fontSize: 16 }} />
              </Box>
            ) : (
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1,
                  bgcolor: 'action.selected',
                  color: 'text.secondary',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <InsertDriveFileIcon sx={{ fontSize: 16 }} />
              </Box>
            )}

            {/* Truncated File Name & Formatted Size */}
            <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 120,
                  fontSize: '0.75rem',
                  lineHeight: 1.2,
                }}
              >
                {fileName}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: 'block',
                  fontSize: '0.65rem',
                  lineHeight: 1.1,
                }}
              >
                {formatBytesToMb(fileSize)}
              </Typography>
            </Box>

            {/* Individual Dismiss Button */}
            <IconButton
              size="small"
              aria-label={`Remove attachment ${fileName}`}
              onClick={() => {
                if (typeof composer?.removeAttachment === 'function') {
                  composer.removeAttachment(attachment.localId);
                }
              }}
              sx={{
                p: 0.25,
                ml: 0.25,
                color: 'text.disabled',
                '&:hover': {
                  color: 'text.primary',
                  bgcolor: 'action.hover',
                },
                flexShrink: 0,
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        );
      })}
    </Box>
  );
});

MuiComposerTopToolbar.displayName = 'MuiComposerTopToolbar';

export default MuiComposerTopToolbar;
