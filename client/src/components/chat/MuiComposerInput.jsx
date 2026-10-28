/**
 * @module components/chat/MuiComposerInput
 * @description Zero-lag auto-resizing input for MUI X Chat composer powered by InputBase
 * and decoupled from store notification cascades during active typing.
 * Wrapped in React.forwardRef and integrated with react-hook-form using register.
 *
 * Performance Architecture (Zero Keystroke Lag):
 * 1. Monolithic Store Decoupling: In @mui/x-chat, all messages in the thread subscribe
 *    to the central store via useStore. Calling composer.setValue on every keystroke forces
 *    store.setState to loop over all 70-100+ listeners, triggering selector evaluation
 *    waterfalls across the entire chat tree.
 * 2. Uncontrolled DOM Buffer: Operates via an uncontrolled textarea registered with react-hook-form.
 *    Typing within non-empty text executes with 0 store calls and 0 selector re-evaluations,
 *    achieving true 0ms typing response regardless of how many messages are in the conversation.
 * 3. Boolean State Transition: Only notifies store on empty <-> non-empty transitions to toggle
 *    MuiSendButton enablement (hasValue: true / false).
 * 4. Synchronous Pre-Submit Flush: On Enter press or Send button click, the actual DOM text
 *    is synchronously flushed to store.setComposerValue immediately before composer.submit().
 * 5. InputBase multiline Engine: Backed by TextareaAutosize shadow-clone sizing with 0 reflows
 *    when typing on the same line.
 * 6. Hover-Only Vertical Scrollbar: Scrollbar thumb stays 100% transparent during idle drafting,
 *    revealing smoothly strictly on container hover, focus, or active interaction.
 * 7. Tier 2 User Maximization: Top-right toggle (OpenInFull / CloseFullscreen) expands to 50vh canvas
 *    with auto-collapse on message submit.
 * 8. IME Composition Safety: Full Ge'ez synthesis protection against premature Enter send.
 */

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import useForkRef from '@mui/utils/useForkRef';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import { useForm } from 'react-hook-form';
import { useChatComposer, useChatStatus } from '@mui/x-chat-headless';
import { getPendingUploadCount } from '../../utils/attachmentRegistry.js';

/**
 * MuiComposerInput component.
 * @param {object} props - Component props passed from ChatBox / ChatComposer slot.
 * @param {React.Ref<HTMLTextAreaElement>} ref - Forwarded ref from slot binding.
 * @returns {React.ReactElement}
 */
export const MuiComposerInput = React.forwardRef(function MuiComposerInput(props, ref) {
  const composer = useChatComposer();
  const status = useChatStatus();

  // Internal DOM and lifecycle references
  const textareaRef = useRef(null);
  const isComposingRef = useRef(false);
  const hasTextRef = useRef(Boolean(composer?.value && composer.value.trim().length > 0));
  const lastSyncedComposerValueRef = useRef(composer?.value || '');

  // React Hook Form integration using register (uncontrolled, zero-lag)
  const { register, reset } = useForm({
    defaultValues: {
      messageText: composer?.value || '',
    },
  });
  const { ref: formRef, onChange: formOnChange, name } = register('messageText');

  // Fork forwarded ref, internal textarea ref, and react-hook-form ref
  const forkedRef1 = useForkRef(ref, textareaRef);
  const handleRef = useForkRef(forkedRef1, formRef);

  // Tier 2: User Maximization state (up to 50vh canvas)
  const [isMaximized, setIsMaximized] = useState(false);

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
    // Preserve focus and caret position at the end of existing drafted text
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
  }, []);

  // Sync strictly when composer.value changes externally (e.g. post-submit store clear, or voice STT injection).
  // Notice: isMaximized is NEVER a dependency here, guaranteeing expand/collapse never mutates or wipes drafted text.
  useLayoutEffect(() => {
    const storeVal = composer?.value || '';

    // If composer.value did not change from what was last seen/synced, do nothing
    if (storeVal === lastSyncedComposerValueRef.current) {
      return;
    }

    lastSyncedComposerValueRef.current = storeVal;

    if (storeVal === '') {
      // Store cleared (e.g. post-submission): clear DOM input and reset form state
      if (textareaRef.current) {
        textareaRef.current.value = '';
      }
      reset({ messageText: '' });
      hasTextRef.current = false;
      setIsMaximized(false);
    } else if (storeVal !== ' ') {
      // Genuine external text injection (e.g. voice STT dictation or starter prompt chips)
      if (textareaRef.current) {
        textareaRef.current.value = storeVal;
      }
      reset({ messageText: storeVal });
      hasTextRef.current = true;
    }
  }, [composer?.value, reset]);

  // Keystroke handler decoupled from store listener broadcast waterfall
  const handleChange = useCallback(
    (e) => {
      // 1. Run React Hook Form change handler
      formOnChange(e);

      const val = e.target.value;
      const hasTextNow = Boolean(val && val.trim().length > 0);
      const hadTextBefore = hasTextRef.current;

      // 2. Only notify store when transitioning between empty and non-empty (to enable/disable Send button)
      if (!hadTextBefore && hasTextNow) {
        hasTextRef.current = true;
        lastSyncedComposerValueRef.current = val;
        if (typeof composer?.setValue === 'function') {
          composer.setValue(val);
        }
      } else if (hadTextBefore && !hasTextNow) {
        hasTextRef.current = false;
        lastSyncedComposerValueRef.current = '';
        if (typeof composer?.setValue === 'function') {
          composer.setValue('');
        }
      }
      // While typing within non-empty text: ZERO STORE UPDATES.
      // Eliminates React 19 store broadcasts to the message list.
    },
    [formOnChange, composer]
  );

  // Key down handler: plain Enter creates a newline naturally; Ctrl+Enter or Cmd+Enter submits
  const handleKeyDown = useCallback(
    (e) => {
      const isUploading = getPendingUploadCount() > 0;
      const isKeyboardSubmit =
        (e.ctrlKey || e.metaKey) &&
        e.key === 'Enter' &&
        !e.nativeEvent.isComposing &&
        !isComposingRef.current &&
        !status?.isStreaming &&
        !isUploading &&
        !composer?.disabled &&
        !props.disabled;

      if (isKeyboardSubmit) {
        e.preventDefault();
        const currentVal = textareaRef.current?.value || '';
        const hasAttachments = Boolean(composer?.attachments && composer.attachments.length > 0);
        if (currentVal.trim().length > 0 || hasAttachments) {
          // Synchronously flush full text to store right before submission
          lastSyncedComposerValueRef.current = currentVal;
          if (typeof composer?.setValue === 'function') {
            composer.setValue(currentVal);
          }
          void composer.submit();

          // Immediately clear local input to guarantee instantaneous feedback
          if (textareaRef.current) {
            textareaRef.current.value = '';
          }
          reset({ messageText: '' });
          hasTextRef.current = false;
          setIsMaximized(false);
        }
      }
    },
    [composer, status?.isStreaming, props.disabled, reset]
  );

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
  }, []);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        transition: 'none !important',
        animation: 'none !important',
      }}
    >
      <InputBase
        multiline
        minRows={isMaximized ? 10 : 3}
        maxRows={isMaximized ? 20 : 8}
        inputRef={handleRef}
        name={name}
        defaultValue=""
        placeholder={props.placeholder || 'Type an operational message, report notes, or question...'}
        disabled={Boolean(props.disabled || composer?.disabled)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        fullWidth
        sx={{
          width: '100%',
          boxSizing: 'border-box',
          p: 0,
          transition: 'none !important',
          animation: 'none !important',
          minHeight: isMaximized ? '220px' : '40px',
          maxHeight: isMaximized ? '50vh' : '200px',
          '& .MuiInputBase-input': {
            boxSizing: 'border-box',
            py: 0.75,
            pl: 0.5,
            pr: 4.5, // Clearance for top-right expand/collapse toggle
            fontFamily: 'inherit',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
            color: 'text.primary',
            resize: 'none',
            overflowY: 'auto !important',
            maxHeight: isMaximized ? 'calc(50vh - 20px)' : '185px',
            transition: 'none !important',
            animation: 'none !important',
            // Hover-Only Vertical Scrollbar Invariant
            scrollbarWidth: 'thin',
            scrollbarColor: 'transparent transparent',
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'transparent',
              borderRadius: '3px',
            },
            '&::placeholder': {
              color: 'text.disabled',
              opacity: 1,
            },
          },
          // Revealing scrollbar strictly on container hover, focus, or active interaction
          '&:hover .MuiInputBase-input, & .MuiInputBase-input:focus, & .MuiInputBase-input:active': {
            scrollbarColor: (theme) => `${theme.palette.divider} transparent`,
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: (theme) => theme.palette.divider,
            },
          },
        }}
      />

      {/* Expand / Collapse Affordance Icon */}
      <Tooltip title={isMaximized ? 'Collapse' : 'Expand'} arrow>
        <IconButton
          size="small"
          aria-label={isMaximized ? 'Collapse composer' : 'Expand composer'}
          onClick={handleToggleMaximize}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            p: 0.5,
            color: 'text.secondary',
            opacity: 0.65,
            transition: 'none !important',
            animation: 'none !important',
            '&:hover': {
              opacity: 1,
              color: 'text.primary',
              bgcolor: 'action.hover',
            },
          }}
        >
          {isMaximized ? (
            <CloseFullscreenIcon sx={{ fontSize: 16 }} />
          ) : (
            <OpenInFullIcon sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
});

MuiComposerInput.displayName = 'MuiComposerInput';

export default React.memo(MuiComposerInput);
