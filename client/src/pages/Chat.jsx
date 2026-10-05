/**
 * @module pages/Chat
 * @description Dedicated fullscreen AI chat canvas orchestrating @mui/x-chat ChatBox,
 * native responsive layoutMode (standard >=600px, overlay 450-600px, split <450px),
 * two-tier message viewport centering (maxWidth: 850px), and multi-modal streaming pipeline.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import { ChatBox } from '@mui/x-chat';
import { toast } from 'react-toastify';

import { selectCurrentUser } from '../redux/features/authSlice.js';
import { setActiveChatId } from '../redux/features/chatSlice.js';
import { OperonChatAdapter } from '../adapters/OperonChatAdapter.js';

import {
  ReasoningPartRenderer,
  ToolPartRenderer,
  ReportCardPartRenderer,
  DirectiveAlertRenderer,
  MessageActionsBar,
  ChatComposerToolbar,
  neutralMessageBubbleSx,
} from '../components/chat/index.js';

/**
 * Primary authenticated AI chat and operational report synthesis canvas view.
 *
 * @component Chat
 * @returns {import('react').JSX.Element} Fullscreen chat canvas presentation.
 */
export const Chat = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const user = useSelector(selectCurrentUser);

  // Derive current user entity for @mui/x-chat runtime
  const currentUser = useMemo(() => {
    if (!user) return undefined;
    return {
      id: user._id || user.id,
      name:
        user.fullName ||
        `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
        'Supervisor',
    };
  }, [user]);

  // Synchronize Redux activeChatId with router path parameter
  useEffect(() => {
    dispatch(setActiveChatId(chatId || null));
  }, [chatId, dispatch]);

  // Handle active conversation switching from conversation list or new chat
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

  // Instantiates the streaming chat adapter connecting SSE backend to MUI X Chat runtime
  const adapter = useMemo(() => {
    return new OperonChatAdapter({
      onSessionCreated: ({ chatId: newChatId }) => {
        if (newChatId && !chatId) {
          // Seamless URL update without unmounting React Router tree
          window.history.replaceState(null, '', `/chat/${newChatId}`);
          dispatch(setActiveChatId(newChatId));
        }
      },
      onError: (err) => {
        toast.error(err?.message || 'Chat error occurred');
      },
    });
  }, [chatId, dispatch]);

  // Native @mui/x-chat feature toggles
  const features = useMemo(
    () => ({
      conversationList: true,
      conversationHeader: true,
      suggestions: true,
      scrollToBottom: true,
    }),
    [],
  );

  // Native container-query responsive breakpoints: standard >=600, overlay 450-600, split <450
  const layoutModeBreakpoints = useMemo(
    () => ({
      overlay: 600,
      split: 450,
    }),
    [],
  );

  // Operational prompt suggestion chips for empty state
  const suggestions = useMemo(
    () => [
      'Generate Daily Operational Summary',
      'Compare Branch Loan Disbursements',
      'Audit Overdue Follow-ups',
      'Check Weekly Growth Trends',
    ],
    [],
  );

  // Specialized message part renderers
  const partRenderers = useMemo(
    () => ({
      reasoning: ReasoningPartRenderer,
      tool: ToolPartRenderer,
      'dynamic-tool': ToolPartRenderer,
      'data-report': ReportCardPartRenderer,
      'data-directive': DirectiveAlertRenderer,
    }),
    [],
  );

  // Slot component overrides
  const slots = useMemo(
    () => ({
      composerToolbar: ChatComposerToolbar,
      composerAttachButton: null,
      composerSendButton: null,
      messageActions: MessageActionsBar,
    }),
    [],
  );

  // SlotProps: Enforces the Two-Tier Container Architecture
  const slotProps = useMemo(
    () => ({
      messageList: {
        sx: {
          width: '100%',
          overflowY: 'auto',
          '& .MuiChatMessageList-content': {
            width: '100%',
            maxWidth: 850,
            mx: 'auto',
            px: { xs: 1.5, sm: 2, md: 3 },
          },
        },
      },
      composerInput: {
        id: 'chat-composer-input',
        name: 'chatComposerInput',
        placeholder: 'Ask about branch operations, daily visits, or dictate report...',
      },
      composerToolbar: {
        hideInput: true,
      },
      composerRoot: {
        sx: {
          width: '100%',
          maxWidth: 850,
          mx: 'auto',
          mb: { xs: 1, sm: 1.5 },
          px: { xs: 1, sm: 1.5 },
        },
      },
      messageContent: {
        sx: neutralMessageBubbleSx,
      },
    }),
    [],
  );

  return (
    <Box
      sx={{
        width: '100%',
        height: '100dvh',
        maxHeight: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <ChatBox
        adapter={adapter}
        activeConversationId={chatId || undefined}
        onActiveConversationChange={handleActiveConversationChange}
        currentUser={currentUser}
        features={features}
        layoutModeBreakpoints={layoutModeBreakpoints}
        suggestions={suggestions}
        suggestionsAutoSubmit={false}
        partRenderers={partRenderers}
        slots={slots}
        slotProps={slotProps}
        sx={{
          height: '100%',
          width: '100%',
          border: 'none',
          borderRadius: 0,
          bgcolor: 'transparent',
        }}
      />
    </Box>
  );
};

export default Chat;
