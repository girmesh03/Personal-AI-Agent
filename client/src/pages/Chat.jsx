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
import {
  selectActiveModel,
  selectThinkingBudget,
  selectLanguage,
  selectSttEngine,
  setActiveChatId,
  setActiveModel,
  setThinkingBudget,
  setLanguage,
  setSttEngine,
  useGetChatByIdQuery,
} from '../redux/features/chatSlice.js';
import { MuiChatAdapter } from '../adapters/MuiChatAdapter.js';
import { ChatAdapterContext } from '../contexts/ChatAdapterContext.js';
import {
  MuiChatEmptyState,
  MuiComposerInput,
  MuiComposerTopToolbar,
  MuiComposerBottomToolbar,
  MuiMessageContent,
  MuiChatMessageListContent,
} from '../components/chat/index.js';
import { CHAT_PAGINATION } from '../utils/constants.js';
import { toast } from 'react-toastify';
import { ATTACHMENT_CONSTANTS } from '../utils/constants.js';

/**
 * Built-in feature toggles: thread-only mode (sidebar and header supplied by AppShell).
 * Multi-modal attachments enabled with native validation boundaries from ATTACHMENT_CONSTANTS.
 * @constant
 */
const FEATURES = Object.freeze({
  conversationList: false,
  conversationHeader: false,
  suggestions: false,
  scrollToBottom: true,
  autoScroll: true,
  attachments: {
    maxFileCount: ATTACHMENT_CONSTANTS.MAX_FILES_COUNT,
    maxFileSize: ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES,
  },
});

/**
 * Slot component overrides:
 * - personalized empty state
 * - zero-lag MuiComposerInput overriding native textarea
 * - MuiComposerTopToolbar for horizontal attachment cards preview
 * - MuiComposerBottomToolbar housing attach button (left) and send button (right)
 * - null overrides for default buttons to ensure single ownership
 * - MuiMessageContent for user message 3-row architecture & assistant delegation
 * - null overrides for avatar, authorName, and external actions to ensure clean user card layout
 * @constant
 */
const SLOTS = Object.freeze({
  emptyState: MuiChatEmptyState,
  composerInput: MuiComposerInput,
  composerToolbar: MuiComposerBottomToolbar,
  composerAttachmentList: MuiComposerTopToolbar,
  composerAttachButton: null,
  composerSendButton: null,
  messageContent: MuiMessageContent,
  messageAvatar: null,
  messageAuthorName: null,
  messageActions: null,
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
      mb: { xs: 1, sm: 2 },
      p: { xs: 0.75, sm: 1 },
      width: { xs: 'calc(100% - 16px)', sm: '100%' },
      boxSizing: 'border-box',
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
      '& .MuiInputBase-root, & .MuiInputBase-input': {
        transition: 'none !important',
      },
    },
  },
  composerInput: {
    placeholder: 'Message your personal AI agent...',
  },
  messageList: {
    slots: {
      messageListContent: MuiChatMessageListContent,
    },
    sx: {
      width: '100%',
      flexGrow: 1,
      '& .MuiChatMessageList-content': {
        maxWidth: 850,
        mx: 'auto',
        width: '100%',
        px: { xs: 0, sm: 2 },
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
  flex: '1 1 0%',
  minHeight: 0,
  border: 'none',
  borderRadius: 0,
  bgcolor: 'transparent',
  '& .MuiChatComposer-root': {
    pb: 'calc(env(safe-area-inset-bottom, 0px))',
  },
  '& .MuiChatMessage-root': {
    px: { xs: 1, sm: 2 },
  },
  '& .MuiChatMessage-roleUser .MuiChatMessage-bubble, & .MuiChatMessage-roleUser .MuiChatMessageContent-root, & [data-is-own-message="true"] .MuiChatMessage-bubble': {
    bgcolor: 'transparent !important',
    color: 'text.primary !important',
    border: 'none !important',
  },
  '& .MuiChatMessage-roleAssistant .MuiChatMessage-bubble, & .MuiChatMessage-roleAssistant .MuiChatMessageContent-root': {
    bgcolor: 'transparent !important',
    color: 'text.primary !important',
    border: 'none !important',
  },
  '& .MuiChatMessage-roleUser .MuiChatMessageMeta-root, & [data-is-own-message="true"] .MuiChatMessageMeta-root': {
    color: 'text.secondary !important',
  },
  '& .MuiChatStreamingIndicator-bubble, & [class*="MuiChatStreamingIndicator-bubble"]': {
    bgcolor: 'transparent !important',
    backgroundColor: 'transparent !important',
    boxShadow: 'none !important',
    border: 'none !important',
    padding: '0 !important',
  },
  '& .MuiChatStreamingIndicator-root, & [class*="MuiChatStreamingIndicator-root"]': {
    bgcolor: 'transparent !important',
    backgroundColor: 'transparent !important',
    boxShadow: 'none !important',
    border: 'none !important',
  },
  '& .MuiChatTypingIndicator-root, & [class*="MuiChatTypingIndicator-root"]': {
    bgcolor: 'transparent !important',
    backgroundColor: 'transparent !important',
    boxShadow: 'none !important',
    border: 'none !important',
    padding: '0 !important',
  },
  '& .MuiChatScrollToBottomAffordance-root, & [class*="MuiChatScrollToBottomAffordance"]': {
    backgroundColor: 'background.paper !important',
    color: 'text.primary !important',
    borderRadius: '50% !important',
    boxShadow: 3,
    zIndex: 10,
    '&:hover': {
      backgroundColor: 'background.paper !important',
      boxShadow: 6,
    },
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
  const thinkingBudget = useSelector(selectThinkingBudget);
  const language = useSelector(selectLanguage);
  const sttEngine = useSelector(selectSttEngine);
  const reduxActiveChatId = useSelector((state) => state.chat.activeChatId);

  // Instantiates the idiomatic MuiChatAdapter with live store dispatcher and lifecycle callbacks
  const adapter = useMemo(() => {
    return new MuiChatAdapter({
      dispatch,
      onSessionCreated: ({ chatId: createdId }) => {
        if (createdId) {
          dispatch(setActiveChatId(createdId));
        }
      },
      onTurnCompleted: ({ chatId: completedId }) => {
        // Stream completed: messages stay rendered in store without being wiped by route navigation.
        // The browser URL was already synchronized via replaceState on session creation.
        if (completedId) {
          dispatch(setActiveChatId(completedId));
        }
      },
      onError: (err) => {
        if (err?.name !== 'AbortError') {
          console.warn('[Chat] Stream notice:', err?.message || err);
        }
      },
    });
  }, [dispatch]);

  // Synchronize activeChatId in Redux on route param changes
  useEffect(() => {
    if (chatId) {
      dispatch(setActiveChatId(chatId));
    } else {
      dispatch(setActiveChatId(null));
      adapter.clearActiveChatId?.();
    }
  }, [dispatch, chatId, adapter]);

  // Handle Google Drive OAuth callback redirect parameters (?google_auth=success or ?google_auth=error)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const googleAuth = params.get('google_auth');
    if (googleAuth) {
      if (googleAuth === 'success') {
        toast.success(
          'Google Drive connected successfully! Your Personal AI Agent can now author docs and sheets in your Drive.'
        );
      } else if (googleAuth === 'error') {
        const message = params.get('message') || 'Authentication failed or was cancelled.';
        toast.error(`Failed to connect Google Drive: ${message}`);
      }
      const newSearch = new URLSearchParams(location.search);
      newSearch.delete('google_auth');
      newSearch.delete('message');
      const searchStr = newSearch.toString();
      const newUrl = `${location.pathname}${searchStr ? `?${searchStr}` : ''}`;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [location.search, location.pathname]);

  // Hydrate config if opening an existing chat thread
  const {
    data: chatData,
    error: chatError,
    isError: isChatError,
  } = useGetChatByIdQuery(
    { chatId, limit: CHAT_PAGINATION.MESSAGES_PAGE_SIZE },
    { skip: !chatId }
  );

  // Handle non-existent or inaccessible chat session (404 / 400)
  useEffect(() => {
    if (chatId && isChatError) {
      const isNotFound =
        chatError?.status === 404 ||
        chatError?.status === 400 ||
        chatError?.data?.message?.toLowerCase()?.includes('not found') ||
        chatError?.data?.message?.toLowerCase()?.includes('invalid');

      const errorMessage =
        chatError?.data?.message ||
        (isNotFound ? 'Chat not found or has been deleted.' : 'Failed to load chat.');

      toast.error(errorMessage, { toastId: 'chat-not-found-error' });

      if (isNotFound || chatError?.status === 404) {
        dispatch(setActiveChatId(null));
        adapter.clearActiveChatId?.();
        navigate('/chat', { replace: true, state: { newChatAt: Date.now() } });
      }
    }
  }, [chatId, isChatError, chatError, dispatch, adapter, navigate]);

  useEffect(() => {
    if (chatId && chatData?.chat?.config) {
      const cfg = chatData.chat.config;
      if (cfg.model) dispatch(setActiveModel(cfg.model));
      if (cfg.thinkingBudget !== undefined) dispatch(setThinkingBudget(cfg.thinkingBudget));
      if (cfg.language) dispatch(setLanguage(cfg.language));
    } else if (!chatId && user?.settings) {
      // Pristine /chat session: initialize from user account defaults
      if (user.settings.agentConfig?.defaultModel) {
        dispatch(setActiveModel(user.settings.agentConfig.defaultModel));
      }
      if (user.settings.agentConfig?.defaultThinkingBudget !== undefined) {
        dispatch(setThinkingBudget(user.settings.agentConfig.defaultThinkingBudget));
      }
      if (user.settings.agentConfig?.defaultLanguage) {
        dispatch(setLanguage(user.settings.agentConfig.defaultLanguage));
      }
      if (user.settings.sttEngine) {
        dispatch(setSttEngine(user.settings.sttEngine));
      }
    }
  }, [chatId, chatData, user, dispatch]);

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


  // Keep active chat ID, current user, model, thinkingBudget, language, and sttEngine synchronized on state changes
  useEffect(() => {
    const effectiveChatId = chatId || reduxActiveChatId || null;
    if (effectiveChatId) {
      adapter.setActiveChatId(effectiveChatId);
    } else if (location.state?.newChatAt) {
      adapter.clearActiveChatId?.();
    }
    adapter.setCurrentUser(currentUser);
    adapter.setModel(activeModel);
    adapter.setThinkingBudget(thinkingBudget);
    adapter.setLanguage(language);
    adapter.setSttEngine(sttEngine);
  }, [adapter, chatId, reduxActiveChatId, location.state?.newChatAt, currentUser, activeModel, thinkingBudget, language, sttEngine]);

  return (
    <ChatAdapterContext.Provider value={adapter}>
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
    </ChatAdapterContext.Provider>
  );
};

export default Chat;
