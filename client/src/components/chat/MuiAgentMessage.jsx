/**
 * @module components/chat/MuiAgentMessage
 * @description Outlined Paper card representing an agent turn in Operon AI Chat.
 * Adheres strictly to the Task 8.11 specifications:
 * - 4-Row Visual Topology:
 *   * ROW 1: Deliberative Reasoning Accordion (MuiReasoningAccordion)
 *   * ROW 2: Autonomous Tool Shelf (MuiToolCallPart)
 *   * ROW 3: Primary Conversational Body (MuiAgentMessageBody with dynamic Markdown, tables, ChatCodeBlock)
 *   * ROW 4: Contextual Actions Deck (MuiAgentMessageBottomBar with text-only copy and linear pruning retry)
 * - Universal Error Handling & Failover Awareness (MuiErrorNotice).
 * - Left-aligned geometry with responsive width constraints.
 * - 16px / 1rem typography standard.
 */

import { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useDispatch, useSelector } from 'react-redux';
import { useMessage, useMessageError, useChatActions, useChatStore, useMessageIds } from '@mui/x-chat-headless';

import { setActiveModel, selectPipelineStatus, selectActiveModel } from '../../redux/features/chatSlice.js';
import { useChatAdapter } from '../../contexts/ChatAdapterContext.js';
import MuiAgentExecutionTimeline from './MuiAgentExecutionTimeline.jsx';
import MuiAgentMessageBody from './MuiAgentMessageBody.jsx';
import MuiAgentMessageBottomBar from './MuiAgentMessageBottomBar.jsx';
import MuiCloudDocumentCard from './MuiCloudDocumentCard.jsx';
import MuiErrorNotice from './MuiErrorNotice.jsx';

/**
 * Primary Agent Turn Container.
 *
 * @component MuiAgentMessage
 * @param {object} props
 * @param {string} props.messageId - Unique identifier of the assistant message turn.
 * @returns {import('react').JSX.Element|null} Rendered agent turn card.
 */
export const MuiAgentMessage = ({ messageId }) => {
  const dispatch = useDispatch();
  const adapter = useChatAdapter();
  const message = useMessage(messageId);
  const messageError = useMessageError(messageId);
  const actions = useChatActions(true);
  const store = useChatStore();
  const messageIds = useMessageIds();
  const reduxPipelineStatus = useSelector(selectPipelineStatus);
  const activeModel = useSelector(selectActiveModel);

  // Decompose message parts into semantic layers
  const parts = useMemo(() => message?.parts || [], [message?.parts]);

  const reasoningParts = useMemo(
    () => parts.filter((p) => p.type === 'reasoning'),
    [parts]
  );

  const toolParts = useMemo(
    () => parts.filter((p) => p.type === 'tool' || p.type === 'dynamic-tool'),
    [parts]
  );

  const textParts = useMemo(
    () => parts.filter((p) => p.type === 'text'),
    [parts]
  );

  // Synthesize pure text for copy target (strictly excluding thoughts, tools, metadata)
  const fullText = useMemo(() => {
    if (textParts.length > 0) {
      return textParts.map((p) => p.text).join('\n');
    }
    return message?.text || (typeof message?.content === 'string' ? message.content : '');
  }, [textParts, message]);

  const isStreaming = message?.status === 'streaming';
  const isError = Boolean(
    message?.status === 'error' ||
    Boolean(messageError) ||
    message?.metadata?.isError ||
    message?.finishReason === 'error' ||
    message?.error ||
    message?.metadata?.error
  );
  const isStopped = Boolean(
    message?.status === 'cancelled' ||
    message?.metadata?.isStopped ||
    message?.finishReason === 'stop' ||
    message?.isStopped
  );
  const errorObj = messageError || message?.metadata?.error || message?.error || 'Generation failed.';

  // Linear history pruning & regeneration handler (Case 1: zero phantom user messages)
  const handleRegenerate = useCallback(async (alternateModel) => {
    if (alternateModel) {
      dispatch(setActiveModel(alternateModel));
      adapter?.setModel?.(alternateModel);
    }
    const currentIds = Array.isArray(messageIds) ? messageIds : store?.state?.messageIds || [];
    const turnIndex = currentIds.indexOf(messageId);
    const anchorUserMessageId = turnIndex > 0 ? currentIds[turnIndex - 1] : null;

    if (actions && typeof actions.regenerate === 'function') {
      try {
        await actions.regenerate(messageId);
        return;
      } catch (err) {
        console.warn('[MuiAgentMessage] actions.regenerate fallback:', err);
      }
    }

    // Direct adapter retryTurn fallback if actions.regenerate failed or not mounted
    if (adapter && typeof adapter.retryTurn === 'function') {
      try {
        await adapter.retryTurn({
          conversationId: message?.conversationId || adapter.currentChatId,
          targetAssistantMessageId: messageId,
          anchorUserMessageId,
          model: alternateModel,
          store,
        });
        return;
      } catch (adapterErr) {
        console.warn('[MuiAgentMessage] adapter.retryTurn error:', adapterErr);
      }
    }

    // Fallback if actions.regenerate not mounted or failed:
    // Resolve anchor user message index and retry it directly
    if (anchorUserMessageId && actions && typeof actions.retry === 'function') {
      await actions.retry(anchorUserMessageId);
    }
  }, [actions, adapter, dispatch, message, messageId, messageIds, store]);

  const handleSelectModel = useCallback(
    (newModel) => {
      handleRegenerate(newModel);
    },
    [handleRegenerate]
  );

  // Resilient Continue Generating handler for stopped turns (Model A: In-Place Resumption)
  const handleContinue = useCallback(async () => {
    if (adapter && typeof adapter.continueGeneration === 'function') {
      try {
        await adapter.continueGeneration({
          conversationId: message?.conversationId || adapter.currentChatId,
          messageId,
          store,
        });
      } catch (err) {
        console.warn('[MuiAgentMessage] adapter.continueGeneration error:', err);
      }
    }
  }, [adapter, message, messageId, store]);

  if (!message) return null;

  return (
    <Box
      className="MuiAgentMessage-root"
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignSelf: 'flex-start',
        justifySelf: 'start',
        gridArea: 'content',
        mr: 'auto',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        bgcolor: 'transparent !important',
        backgroundColor: 'transparent !important',
        border: 'none !important',
        boxShadow: 'none !important',
        p: 0,
        m: 0,
        color: 'text.primary',
      }}
    >
      {/* ROW 1 + ROW 2 UNIFIED: SINGLE FRAMELESS VERTICAL TIMELINE ACCORDION */}
      <MuiAgentExecutionTimeline
        reasoningParts={reasoningParts}
        toolParts={toolParts}
        pipelineStatus={isStreaming ? reduxPipelineStatus : (message?.metadata?.pipelineStatus || '')}
        isStreaming={isStreaming}
        isStopped={isStopped}
        createdAt={message?.createdAt}
        thoughtDuration={message?.metadata?.thoughtDuration}
        hasTextStarted={Boolean(fullText && fullText.trim())}
      />

      {/* ROW 3: PRIMARY CONVERSATIONAL BODY (DYNAMIC MARKDOWN, TABLES & CHATCODEBLOCK) */}
      <MuiAgentMessageBody text={fullText} isStreaming={isStreaming} />

      {/* ROW 3.5: CLOUD DOCUMENTS & DOWNLOAD ACTION CARDS */}
      <MuiCloudDocumentCard toolParts={toolParts} />

      {/* STOPPED NOTICE WHEN INTERRUPTED BEFORE TEXT OUTPUT */}
      {isStopped && (!fullText || !fullText.trim()) && (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontStyle: 'italic',
            my: 1,
            fontSize: '0.875rem',
          }}
        >
          Generation stopped by user.
        </Typography>
      )}

      {/* TERMINAL OR MID-STREAM ERROR NOTICE */}
      {isError && (
        <MuiErrorNotice
          error={errorObj}
          onRetry={() => handleRegenerate()}
          failedModel={message?.metadata?.model}
          onSelectModel={handleSelectModel}
          isPartial={Boolean(fullText)}
        />
      )}

      {/* ROW 4: BOTTOM CONTEXTUAL ACTIONS DECK (Rendered after response completes or when stopped) */}
      {!isError && !isStreaming && !store?.state?.isStreaming && (Boolean(fullText && fullText.trim()) || isStopped) && (
        <MuiAgentMessageBottomBar
          text={fullText}
          model={message?.metadata?.model || activeModel}
          usage={message?.metadata?.usage}
          createdAt={message?.createdAt}
          onRegenerate={() => handleRegenerate()}
          onContinue={handleContinue}
          isStreaming={false}
          isStopped={isStopped}
        />
      )}
    </Box>
  );
};

MuiAgentMessage.propTypes = {
  messageId: PropTypes.string.isRequired,
};

export default MuiAgentMessage;
