/**
 * @module components/chat/MuiSendButton
 * @description Decoupled circular action button for MUI X Chat composer.
 * Adheres strictly to the 7-state edge-case matrix while completely eliminating typing lag:
 * 1. Empty/whitespace: Disabled
 * 2. Non-empty text: Active Send mode (ArrowUpward)
 * 3. Generation in progress: Active Stop mode (Stop icon), wired to actions.stopStreaming()
 * 4. Submitting handshake: Handled by form submission
 * 5. IME composition: Protected by input composition handlers
 * 6. Multiline: Handled by InputBase / TextareaAutosize
 * 7. Offline/disabled: Disabled
 *
 * Performance Invariant: Subscribes to boolean selectors via useChatStore() + useStore(),
 * guaranteeing 0 re-renders while typing between character 1 and character 500.
 */

import React from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import StopIcon from '@mui/icons-material/Stop';
import { useChatStatus, useChatActions, useChatStore } from '@mui/x-chat-headless';
import { useStore } from '@mui/x-internals/store';

/**
 * MuiSendButton component.
 * @param {object} props - Component props.
 * @param {boolean} [props.disabled] - Optional external disabled override.
 * @returns {React.ReactElement}
 */
export const MuiSendButton = (props) => {
  const store = useChatStore();
  const status = useChatStatus();
  const actions = useChatActions();

  // Boolean selectors: strictly 0 re-renders while typing characters 2 through 500!
  const hasValue = useStore(store, (state) => Boolean(state.composerValue && state.composerValue.trim().length > 0));
  const hasAttachments = useStore(store, (state) => Boolean(state.composerAttachments && state.composerAttachments.length > 0));

  const isStreaming = Boolean(status?.isStreaming);
  const isDisabledExternally = Boolean(props.disabled);
  const canSend = (hasValue || hasAttachments) && !isStreaming && !isDisabledExternally;

  const handleSendTrigger = React.useCallback(
    (e) => {
      if (!canSend) {
        e.preventDefault();
        return;
      }
      // Synchronously flush the composer textarea's current DOM text to the store
      // before native type="submit" form submission triggers composer.submit()
      const form = e.currentTarget.closest('form');
      const textarea = form?.querySelector('textarea');
      if (textarea && typeof store?.setComposerValue === 'function') {
        store.setComposerValue(textarea.value);
      }
    },
    [canSend, store]
  );

  // State 3: Active Streaming Generation (Stop Mode)
  if (isStreaming) {
    return (
      <Tooltip title="Stop generating" arrow>
        <IconButton
          type="button"
          aria-label="Stop generating"
          size="small"
          onClick={() => {
            if (typeof actions?.stopStreaming === 'function') {
              actions.stopStreaming();
            }
          }}
          sx={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            bgcolor: 'error.main',
            color: 'error.contrastText',
            transition: 'none !important',
            '&:hover': {
              bgcolor: 'error.dark',
              color: 'error.contrastText',
            },
            boxShadow: 1,
            flexShrink: 0,
          }}
        >
          <StopIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    );
  }

  // States 1 & 2: Idle Drafting (Send Mode)
  return (
    <Tooltip title={canSend ? 'Send message' : ''} arrow disableHoverListener={!canSend}>
      <span>
        <IconButton
          type="submit"
          aria-label="Send message"
          size="small"
          disabled={!canSend}
          onPointerDown={handleSendTrigger}
          onClick={handleSendTrigger}
          sx={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            bgcolor: canSend ? 'primary.main !important' : 'action.disabledBackground !important',
            color: canSend ? 'primary.contrastText !important' : 'action.disabled !important',
            transition: 'none !important',
            cursor: canSend ? 'pointer' : 'not-allowed',
            '&:hover': canSend
              ? {
                bgcolor: 'primary.dark !important',
              }
              : {},
            boxShadow: canSend ? 1 : 0,
            flexShrink: 0,
          }}
        >
          <ArrowUpwardIcon sx={{ fontSize: 19 }} />
        </IconButton>
      </span>
    </Tooltip>
  );
};

MuiSendButton.displayName = 'MuiSendButton';

export default React.memo(MuiSendButton);
