/**
 * @module components/chat/MuiUserMessageBody
 * @description Middle conversational row of the user message card.
 * In View Mode: Formatted typography (1rem / 16px, pre-wrap, line-height 1.6) with auto-collapse clamping (>220px) and bottom gradient fade.
 * In Edit Mode: Unconstrained auto-expanding InputBase drafting pad with absolute zero scrollbars.
 */

import { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';


/**
 * Middle-row conversational body for User Message.
 *
 * @component MuiUserMessageBody
 * @param {object} props
 * @param {string} props.text - Persisted message text.
 * @param {boolean} [props.isEditing=false] - Whether card is in Edit Mode.
 * @param {boolean} [props.isExpanded=false] - Whether long text is expanded.
 * @param {boolean} [props.hasOverflow=false] - Whether text height exceeds clamp threshold.
 * @param {string} [props.draftText=''] - Edit buffer text.
 * @param {Function} [props.onDraftTextChange] - Callback when edit buffer updates.
 * @param {import('react').RefObject} [props.contentRef] - Ref to measure content height.
 * @param {import('react').RefObject} [props.inputRef] - Ref to the editing InputBase DOM textarea.
 * @returns {import('react').JSX.Element} Rendered message body.
 */
export const MuiUserMessageBody = ({
  text = '',
  isEditing = false,
  isExpanded = false,
  hasOverflow = false,
  draftText = '',
  onDraftTextChange,
  contentRef,
  inputRef,
}) => {
  const localInputRef = useRef(null);
  const activeInputRef = inputRef || localInputRef;

  // Auto-focus and place caret at the end of text when entering Edit Mode
  useEffect(() => {
    if (isEditing && activeInputRef.current) {
      const textarea = activeInputRef.current;
      textarea.value = draftText;
      textarea.focus();
      const len = textarea.value?.length || 0;
      textarea.setSelectionRange?.(len, len);
    }
  }, [isEditing, draftText, activeInputRef]);

  if (isEditing) {
    return (
      <Box
        sx={{
          width: '100%',
          minHeight: 48,
          py: 0.5,
        }}
      >
        <InputBase
          inputRef={activeInputRef}
          multiline
          minRows={2}
          maxRows={undefined}
          defaultValue={draftText}
          onChange={(e) => {
            if (typeof onDraftTextChange === 'function') {
              onDraftTextChange(e.target.value);
            }
          }}
          placeholder="Edit your message..."
          fullWidth
          sx={{
            fontSize: '1rem',
            lineHeight: 1.6,
            color: 'text.primary',
            overflow: 'hidden',
            scrollbarWidth: 'none',
            '& textarea': {
              overflow: 'hidden !important',
              scrollbarWidth: 'none !important',
              resize: 'none',
              lineHeight: 1.6,
              fontSize: '1rem',
              p: 0,
            },
            '& ::-webkit-scrollbar': {
              display: 'none',
            },
          }}
        />
      </Box>
    );
  }

  // In View Mode, if there is no text content (e.g. attachment-only message), collapse completely
  if (!isEditing && (!text || !text.trim())) {
    return null;
  }

  const shouldClamp = hasOverflow && !isExpanded;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        overflow: 'visible',
      }}
    >
      <Typography
        ref={contentRef}
        variant="body1"
        component="div"
        sx={{
          fontSize: '1rem',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'text.primary',
          ...(shouldClamp
            ? {
                display: '-webkit-box',
                WebkitLineClamp: 8,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
            : {
                display: 'block',
                overflow: 'visible',
              }),
        }}
      >
        {text}
      </Typography>
    </Box>
  );
};

MuiUserMessageBody.propTypes = {
  text: PropTypes.string,
  isEditing: PropTypes.bool,
  isExpanded: PropTypes.bool,
  hasOverflow: PropTypes.bool,
  draftText: PropTypes.string,
  onDraftTextChange: PropTypes.func,
  contentRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  inputRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default MuiUserMessageBody;
