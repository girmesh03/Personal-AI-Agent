/**
 * @module pages/Chat
 * @description Clean native MUI X Chat canvas mounted inside AppShell outlet.
 * Uses thread-only native layout (sidebar and appbar supplied by AppShell).
 * Powered by idiomatic MuiChatAdapter connecting to Express 5 SSE streaming pipeline and apiSlice.
 * Enforces zero-lag composer typing, side-by-side message alignment, and seamless Turn 1 lifecycle.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { ChatBox } from '@mui/x-chat';

import { selectCurrentUser } from '../redux/features/authSlice.js';
import { selectActiveModel } from '../redux/features/chatSlice.js';
import { MuiChatAdapter } from '../adapters/MuiChatAdapter.js';
import {
  MuiChatEmptyState,
  MuiComposerInput,
  MuiComposerBottomToolbar,
} from '../components/chat/index.js';

/**
 * Built-in feature toggles: thread-only mode (sidebar and header supplied by AppShell).
 * In Step 1 baseline, attachments are disabled until Step 2 multi-modal wiring.
 * @constant
 */
const FEATURES = Object.freeze({
  conversationList: false,
  conversationHeader: false,
  suggestions: false,
  scrollToBottom: true,
  autoScroll: true,
  attachments: false,
});

/**
 * Slot component overrides:
 * - personalized empty state
 * - zero-lag MuiComposerInput overriding native textarea
 * - MuiComposerBottomToolbar housing send button docked right
 * - null overrides for default buttons and attachment list to ensure single ownership
 * @constant
 */
const SLOTS = Object.freeze({
  emptyState: MuiChatEmptyState,
  composerInput: MuiComposerInput,
  composerToolbar: MuiComposerBottomToolbar,
  composerAttachButton: null,
  composerSendButton: null,
  composerAttachmentList: null,
});

/**
 * SlotProps: Zero-lag composer configuration & message list sizing.
 * Disables all CSS transitions and animations on composer descendants to ensure instantaneous typing.
 * @constant
 */
const SLOT_PROPS = Object.freeze({
  composerRoot: {
    sx: {
      maxWidth: 760,
      mx: 'auto',
      mb: 2,
      p: 1,
      width: '100%',
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
      boxShadow: 1,
      transition: 'none !important',
      '&:focus-within': {
        borderColor: 'primary.main',
        boxShadow: (theme) => `0 0 0 1px ${theme.palette.primary.main}`,
      },
      '&, & *, & *::before, & *::after': {
        transition: 'none !important',
        animation: 'none !important',
      },
    },
  },
  composerInput: {
    placeholder: 'Message your personal AI agent...',
  },
  messageList: {
    sx: {
      width: '100%',
      flexGrow: 1,
      '& .MuiChatMessageList-content': {
        maxWidth: 850,
        mx: 'auto',
        width: '100%',
        px: { xs: 1.5, sm: 2 },
      },
    },
  },
});

/**
 * ChatBox canvas styling: neutralizes user bubble background (zero blue fill) and enforces right-docked scrollbar.
 * @constant
 */
const CHATBOX_SX = Object.freeze({
  height: '100%',
  width: '100%',
  border: 'none',
  borderRadius: 0,
  bgcolor: 'transparent',
  px: 0.5,
  '& .MuiChatMessage-roleUser .MuiChatMessage-bubble, & .MuiChatMessage-roleUser .MuiChatMessageContent-root, & [data-is-own-message="true"] .MuiChatMessage-bubble': {
    bgcolor: 'background.paper !important',
    color: 'text.primary !important',
    border: '1px solid',
    borderColor: 'divider',
  },
  '& .MuiChatMessage-roleAssistant .MuiChatMessage-bubble, & .MuiChatMessage-roleAssistant .MuiChatMessageContent-root': {
    bgcolor: 'background.paper !important',
    color: 'text.primary !important',
    border: '1px solid',
    borderColor: 'divider',
  },
  '& .MuiChatMessage-roleUser .MuiChatMessageMeta-root, & [data-is-own-message="true"] .MuiChatMessageMeta-root': {
    color: 'text.secondary !important',
  },
});

/**
 * AI Chat and operational canvas view.
 *
 * @component Chat
 * @returns {import('react').JSX.Element} Clean native ChatBox interface.
 */
export const Chat = () => {
  const { chatId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const activeModel = useSelector(selectActiveModel);

  // Derive stable session key: matches conversation ID if viewing existing thread,
  // or unique new-chat token if user requested a fresh canvas via sidebar "+" or nav item.
  const sessionKey = chatId || (location.state?.newChatAt ? `new-${location.state.newChatAt}` : `new-${location.key}`);

  // Derive current user identity for MUI X Chat
  const currentUser = useMemo(() => {
    if (!user) {
      return { id: 'supervisor', name: 'Supervisor' };
    }
    return {
      id: user._id || user.id || 'supervisor',
      name:
        user.fullName ||
        `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
        'Supervisor',
    };
  }, [user]);

  // Stable author resolver ensuring user turn is on right and assistant turn is on left
  const getMessageAuthorId = useCallback(
    (msg) => {
      if (msg?.role === 'user' || msg?.author?.role === 'user') {
        return currentUser?.id || 'supervisor';
      }
      return 'assistant';
    },
    [currentUser?.id]
  );

  // Route synchronization callback on conversation selection
  const handleActiveConversationChange = useCallback(
    (newId) => {
      if (newId) {
        navigate(`/chat/${newId}`);
      } else {
        navigate('/chat');
      }
    },
    [navigate],
  );

  // Instantiates the idiomatic MuiChatAdapter with live store dispatcher and lifecycle callbacks
  const adapter = useMemo(() => {
    return new MuiChatAdapter({
      dispatch,
      onTurnCompleted: () => {
        // Stream completed: messages stay rendered in store without being wiped by route navigation.
        // The browser URL was already synchronized via replaceState on session creation.
      },
      onError: (err) => {
        if (err?.name !== 'AbortError') {
          console.warn('[Chat] Stream notice:', err?.message || err);
        }
      },
    });
  }, [dispatch]);

  // Keep active chat ID, current user, and model synchronized on state changes
  useEffect(() => {
    adapter.setActiveChatId(chatId || null);
    adapter.setCurrentUser(currentUser);
    adapter.setModel(activeModel);
  }, [adapter, chatId, currentUser, activeModel]);

  return (
    <ChatBox
      key={sessionKey}
      adapter={adapter}
      layoutMode="standard"
      activeConversationId={chatId || undefined}
      onActiveConversationChange={handleActiveConversationChange}
      currentUser={currentUser}
      getMessageAuthorId={getMessageAuthorId}
      features={FEATURES}
      slots={SLOTS}
      slotProps={SLOT_PROPS}
      sx={CHATBOX_SX}
    />
  );
};

export default Chat;
