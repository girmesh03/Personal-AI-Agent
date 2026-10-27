/**
 * @module components/chat/MuiUserMessage
 * @description Outlined Paper card representing a user message turn in Operon AI Chat.
 * Adheres strictly to the 10 Constitutional Invariants:
 * 1. Zero avatar, zero author label, neutral outlined Paper card (no blue primary fill).
 * 2. 3-row architecture: Row 1 Media Shelf, Row 2 Conversational Body, Row 3 Actions & Retry Deck.
 * 3. Min/Max width geometry clamping ({ xs: 140, sm: 160 } to { xs: '92%', md: '80%', lg: '75%' }).
 * 4. Auto-collapse at 220px with bottom gradient fade, and absolute zero scrollbars in Edit Mode.
 * 5. Edit-only attachment deletion and addition with client validation.
 * 6. Dual-mode attachment layout: View Mode flex-wrap (zero scrollbars) vs Edit Mode single-line scroll.
 * 7. Action deck on hover, replaced by inline warning recovery strip on error with transparent bgcolor.
 * 8. Strict 1rem / 16px typography.
 * 9. Linear history pruning dispatch on edit submit and retry.
 * 10. Native MUI X Chat integration via useMessage, useChatActions, and useChatStore.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useMessage, useChatActions, useChatStore, useMessageIds } from '@mui/x-chat-headless';

import MuiUserAttachmentShelf from './MuiUserAttachmentShelf.jsx';
import MuiUserMessageBody from './MuiUserMessageBody.jsx';
import MuiUserMessageBottomBar from './MuiUserMessageBottomBar.jsx';
import { useChatAdapter } from '../../contexts/ChatAdapterContext.js';
import { ATTACHMENT_CONSTANTS, AUDIO_CONSTANTS } from '../../utils/constants.js';
import { toast } from 'react-toastify';

/**
 * Clamping height threshold in pixels (8 full text lines at 25.6px line-height = 204.8px).
 * @constant {number}
 */
const CLAMP_HEIGHT_PX = 206;

/**
 * Outlined user message card component.
 *
 * @component MuiUserMessage
 * @param {object} props
 * @param {string} props.messageId - Unique identifier of the message turn.
 * @returns {import('react').JSX.Element|null} Rendered user message card.
 */
export const MuiUserMessage = ({ messageId }) => {
  const adapter = useChatAdapter();
  const message = useMessage(messageId);
  const actions = useChatActions(true);
  const store = useChatStore();
  const messageIds = useMessageIds();

  // Extract raw text from message parts or content
  const initialText = useMemo(() => {
    if (!message) return '';
    if (typeof message.content === 'string') return message.content;
    const textPart = message.parts?.find((p) => p.type === 'text');
    return textPart?.text || message.text || '';
  }, [message]);

  // Extract and normalize initial attachments and audio records
  const initialAttachments = useMemo(() => {
    if (!message) return [];
    const list = [];
    const seenKeys = new Set();

    const addAttachment = (raw) => {
      if (!raw) return;
      const id = String(
        raw.id ||
        raw._id ||
        raw.fileName ||
        raw.filename ||
        raw.name ||
        (raw.file && (raw.file.id || raw.file.name)) ||
        ''
      );
      const name =
        raw.originalName ||
        raw.name ||
        raw.fileName ||
        raw.filename ||
        (raw.file && raw.file.name) ||
        'Attachment';
      const size = raw.size || (raw.file && raw.file.size) || 0;
      const dedupeKey = id ? `id:${id}` : `name:${name}-${size}`;
      if (seenKeys.has(dedupeKey)) return;
      seenKeys.add(dedupeKey);
      if (id) seenKeys.add(`id:${id}`);
      if (name) seenKeys.add(`name:${name}-${size}`);
      if (raw.fileName) seenKeys.add(`fn:${raw.fileName}`);
      if (raw.filename) seenKeys.add(`fn:${raw.filename}`);

      const mimeType =
        raw.mimeType ||
        raw.mediaType ||
        raw.type ||
        (raw.file && raw.file.type) ||
        '';

      const rawPath = raw.path ? raw.path.replace(/\\/g, '/') : null;
      let url = raw.url || (raw.file && raw.file.url) || null;
      if (!url && rawPath) {
        url = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
      }

      list.push({
        id: id || dedupeKey,
        _id: raw._id || (id && /^[0-9a-fA-F]{24}$/.test(id) ? id : null),
        name,
        fileName: raw.fileName || raw.filename || name,
        originalName: raw.originalName || name,
        size,
        mimeType,
        type: mimeType,
        url,
        path: rawPath,
        duration: raw.duration || null,
        file: raw.file || null,
      });
    };

    // 1. Check message.attachments
    if (Array.isArray(message.attachments)) {
      message.attachments.forEach(addAttachment);
    }

    // 2. Check message.audios
    if (Array.isArray(message.audios)) {
      message.audios.forEach((aud) => {
        if (aud) {
          addAttachment({
            ...aud,
            mimeType: aud.mimeType || 'audio/webm',
            name: aud.originalName || aud.fileName || 'Voice Recording',
          });
        }
      });
    }

    // 3. Check message.parts for file or audio parts
    if (Array.isArray(message.parts)) {
      message.parts.forEach((p) => {
        if (p.type === 'file' || p.type === 'audio') {
          addAttachment({
            id: p.id || (p.file && p.file.id),
            _id: p._id || p.id || (p.file && p.file.id),
            name: p.filename || p.name || (p.file && p.file.name),
            originalName: p.originalName || p.filename || p.name || (p.file && p.file.name),
            fileName: p.filename || p.name || (p.file && p.file.name),
            size: p.size || (p.file && p.file.size),
            mimeType: p.mediaType || p.mimeType || (p.file && p.file.type) || (p.type === 'audio' ? 'audio/webm' : ''),
            url: p.url || (p.file && p.file.url),
            path: p.path,
            duration: p.duration,
            file: p.file || null,
          });
        }
      });
    }

    return list;
  }, [message]);

  // Local interaction states
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const draftTextRef = useRef(initialText);
  const hasDraftTextRef = useRef(Boolean(initialText && initialText.trim()));
  const [hasDraftText, setHasDraftText] = useState(Boolean(initialText && initialText.trim()));
  const [draftAttachments, setDraftAttachments] = useState(initialAttachments);

  // Snapshot ref for restoring state on cancel
  const snapshotRef = useRef({ text: initialText, attachments: initialAttachments });
  const [isModified, setIsModified] = useState(false);
  const contentRef = useRef(null);
  const inputRef = useRef(null);
  const editContainerRef = useRef(null);

  // Measure content scrollHeight in View Mode to determine if auto-collapse clamping applies
  const measureHeight = useCallback(() => {
    if (!isEditing && contentRef.current) {
      const scrollH = contentRef.current.scrollHeight;
      setHasOverflow(scrollH > CLAMP_HEIGHT_PX);
    }
  }, [isEditing]);

  useEffect(() => {
    measureHeight();
    window.addEventListener('resize', measureHeight);
    return () => window.removeEventListener('resize', measureHeight);
  }, [measureHeight, initialText]);

  // 1. EDIT MODE LIFECYCLE HANDLERS
  const handleDraftTextChange = useCallback((val) => {
    draftTextRef.current = val;
    const hasNow = Boolean(val && val.trim().length > 0);
    if (hasNow !== hasDraftTextRef.current) {
      hasDraftTextRef.current = hasNow;
      setHasDraftText(hasNow);
    }
    const textChanged = (val ?? '').trim() !== (snapshotRef.current.text ?? '').trim();
    const attsChanged = draftAttachments.length !== snapshotRef.current.attachments.length;
    setIsModified(textChanged || attsChanged);
  }, [draftAttachments.length]);

  const handleStartEdit = useCallback(() => {
    draftTextRef.current = initialText;
    hasDraftTextRef.current = Boolean(initialText && initialText.trim());
    setHasDraftText(Boolean(initialText && initialText.trim()));
    setDraftAttachments(initialAttachments);
    snapshotRef.current = {
      text: initialText,
      attachments: [...initialAttachments],
    };
    setIsModified(false);
    setIsExpanded(true);
    setIsEditing(true);
  }, [initialText, initialAttachments]);

  const handleCancelEdit = useCallback(() => {
    draftTextRef.current = snapshotRef.current.text;
    hasDraftTextRef.current = Boolean(snapshotRef.current.text && snapshotRef.current.text.trim());
    setHasDraftText(Boolean(snapshotRef.current.text && snapshotRef.current.text.trim()));
    setDraftAttachments(snapshotRef.current.attachments);
    setIsModified(false);
    setIsEditing(false);
  }, []);

  // Click-outside listener on edit container to safely auto-collapse back to view mode on blur
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event) => {
      if (editContainerRef.current && editContainerRef.current.contains(event.target)) {
        return;
      }
      if (event.target && event.target.tagName === 'INPUT' && event.target.type === 'file') {
        return;
      }
      handleCancelEdit();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isEditing, handleCancelEdit]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleRemoveAttachment = useCallback((idToRemove) => {
    setDraftAttachments((prev) => {
      const next = prev.filter((att) => {
        const id = att.id || att._id || att.fileName || att.name;
        return (
          id !== idToRemove &&
          att.id !== idToRemove &&
          att._id !== idToRemove &&
          att.fileName !== idToRemove
        );
      });
      const textChanged = (draftTextRef.current ?? '').trim() !== (snapshotRef.current.text ?? '').trim();
      const attsChanged = next.length !== snapshotRef.current.attachments.length;
      setIsModified(textChanged || attsChanged);
      return next;
    });
  }, []);

  const handleAttachFiles = useCallback((newFiles) => {
    if (!Array.isArray(newFiles) || newFiles.length === 0) return;

    setDraftAttachments((prev) => {
      const currentCount = prev.length;
      const allowedCount = ATTACHMENT_CONSTANTS.MAX_FILES_COUNT - currentCount;
      if (allowedCount <= 0) {
        toast.warning(`Maximum ${ATTACHMENT_CONSTANTS.MAX_FILES_COUNT} files allowed per message.`);
        return prev;
      }

      const currentBatchSize = prev.reduce((acc, att) => acc + (Number(att.size) || 0), 0);
      const filesToAdd = newFiles.slice(0, allowedCount);
      let cumulativeAddedSize = 0;
      const validFiles = [];

      for (const f of filesToAdd) {
        // Enforce single file size limit (25MB)
        if (f.size > ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES) {
          toast.error(`"${f.name}" exceeds the maximum single file size of 25MB.`);
          continue;
        }

        // Enforce extension whitelist
        const name = (f.name || '').toLowerCase();
        const hasValidExt =
          ATTACHMENT_CONSTANTS.ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext)) ||
          AUDIO_CONSTANTS.ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
        if (!hasValidExt) {
          toast.error(`"${f.name}" has an unsupported file format.`);
          continue;
        }

        // Enforce cumulative batch size limit (50MB)
        if (currentBatchSize + cumulativeAddedSize + f.size > ATTACHMENT_CONSTANTS.MAX_BATCH_SIZE_BYTES) {
          toast.error('Total attachment batch size cannot exceed 50MB.');
          break;
        }

        cumulativeAddedSize += f.size;
        validFiles.push(f);
      }

      if (validFiles.length === 0) return prev;

      const formatted = validFiles.map((f, idx) => ({
        id: `draft-${Date.now()}-${idx}`,
        name: f.name,
        fileName: f.name,
        originalName: f.name,
        size: f.size,
        mimeType: f.type,
        type: f.type,
        file: f,
      }));

      const next = [...prev, ...formatted];
      setIsModified(true);
      return next;
    });
  }, []);

  // 2. LINEAR PRUNING SUBMISSION HANDLER
  const handleSubmitEdit = useCallback(async () => {
    const textToSubmit = (inputRef.current?.value ?? draftTextRef.current ?? '').trim();
    if (!textToSubmit && draftAttachments.length === 0) return;

    // Validate cumulative batch size before submission
    const totalBatchSize = draftAttachments.reduce((sum, att) => sum + (Number(att.size) || 0), 0);
    if (totalBatchSize > ATTACHMENT_CONSTANTS.MAX_BATCH_SIZE_BYTES) {
      toast.error('Total attachment batch size cannot exceed 50MB. Please remove some attachments.');
      return;
    }

    // Resolve target turn index k in conversation
    const currentIds = Array.isArray(messageIds) ? messageIds : store.state.messageIds;
    const turnIndex = currentIds.indexOf(messageId);

    // Apply linear history pruning to client store: slice all messages > turnIndex
    if (turnIndex !== -1 && store && typeof store.update === 'function') {
      const slicedIds = currentIds.slice(0, turnIndex);
      const slicedById = {};
      slicedIds.forEach((id) => {
        if (store.state.messagesById[id]) {
          slicedById[id] = store.state.messagesById[id];
        }
      });
      store.update({
        messageIds: slicedIds,
        messagesById: slicedById,
      });
    }

    setIsEditing(false);

    // Build complete parts array containing both text and attachments
    const parts = [];
    if (textToSubmit) {
      parts.push({ type: 'text', text: textToSubmit });
    }
    draftAttachments.forEach((att) => {
      const actualFile = (att instanceof File || att instanceof Blob) ? att : att.file;
      const mime = (att.mimeType || att.type || (actualFile && actualFile.type) || '').toLowerCase();
      const name = (att.name || att.originalName || att.fileName || (actualFile && actualFile.name) || '').toLowerCase();
      const isAudio =
        mime.startsWith('audio/') ||
        mime.includes('webm') ||
        name.endsWith('.webm') ||
        name.endsWith('.wav') ||
        name.endsWith('.mp3');

      parts.push({
        type: isAudio ? 'audio' : 'file',
        id: att.id || att._id,
        _id: att._id || att.id,
        filename: att.originalName || att.name || att.fileName || (actualFile && actualFile.name),
        name: att.originalName || att.name || att.fileName || (actualFile && actualFile.name),
        originalName: att.originalName || att.name || att.fileName || (actualFile && actualFile.name),
        fileName: att.fileName || att.originalName || att.name || (actualFile && actualFile.name),
        mediaType: att.mimeType || att.type || (actualFile && actualFile.type),
        mimeType: att.mimeType || att.type || (actualFile && actualFile.type),
        size: att.size || (actualFile && actualFile.size),
        url: att.url,
        path: att.path,
        duration: att.duration,
        file: actualFile,
      });
    });

    // Dispatch edited turn through actions.sendMessage with editTurnIndex and isEdit metadata
    if (actions && typeof actions.sendMessage === 'function') {
      await actions.sendMessage({
        parts,
        attachments: draftAttachments,
        metadata: {
          isEdit: true,
          editTurnIndex: turnIndex >= 0 ? turnIndex : undefined,
          anchorUserMessageId: messageId,
        },
      });
    }
  }, [draftAttachments, messageId, messageIds, store, actions]);

  // 3. RETRY HANDLER FOR FAILED TURNS
  const handleRetry = useCallback(async () => {
    const currentIds = Array.isArray(messageIds) ? messageIds : store?.state?.messageIds || [];
    const turnIndex = currentIds.findIndex((id) => String(id) === String(messageId));
    const nextAssistantId = turnIndex >= 0 && turnIndex + 1 < currentIds.length ? currentIds[turnIndex + 1] : null;

    if (nextAssistantId && actions && typeof actions.regenerate === 'function') {
      try {
        await actions.regenerate(nextAssistantId);
        return;
      } catch (err) {
        console.warn('[MuiUserMessage] actions.regenerate fallback to retry:', err);
      }
    }

    if (adapter && typeof adapter.retryTurn === 'function') {
      try {
        await adapter.retryTurn({
          conversationId: message?.conversationId || adapter.currentChatId,
          targetAssistantMessageId: nextAssistantId,
          anchorUserMessageId: messageId,
          store,
        });
        return;
      } catch (adapterErr) {
        console.warn('[MuiUserMessage] adapter.retryTurn fallback:', adapterErr);
      }
    }

    if (actions && typeof actions.retry === 'function') {
      await actions.retry(messageId);
    }
  }, [actions, adapter, message, messageId, messageIds, store]);

  if (!message) return null;

  const status = message.status || 'idle';
  const disabledSubmit = !isModified || (!hasDraftText && draftAttachments.length === 0);

  // 1. EDIT MODE: Unified single outlined editor card ("Keep the UI on edit mode as it is")
  if (isEditing) {
    return (
      <Paper
        ref={editContainerRef}
        variant="outlined"
        className="MuiUserMessage-root"
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignSelf: 'flex-end',
          justifySelf: 'end',
          gridArea: 'content',
          ml: 'auto',
          width: '100%',
          minWidth: { xs: '90%', sm: 420 },
          maxWidth: { xs: '92%', sm: '85%', md: '80%', lg: '75%' },
          bgcolor: 'background.paper',
          color: 'text.primary',
          border: 1,
          borderColor: 'primary.main',
          borderRadius: '16px',
          p: 1.5,
          boxShadow: 'none',
        }}
      >
        {/* ROW 1: TOP MEDIA & ATTACHMENT SHELF (single-line horizontal scroll) */}
        <MuiUserAttachmentShelf
          attachments={draftAttachments}
          isEditing={true}
          onRemoveAttachment={handleRemoveAttachment}
        />

        {/* ROW 2: MIDDLE CONVERSATIONAL BODY (auto-expanding InputBase, 0 scrollbars) */}
        <MuiUserMessageBody
          text={initialText}
          isEditing={true}
          isExpanded={isExpanded}
          hasOverflow={hasOverflow}
          draftText={initialText}
          onDraftTextChange={handleDraftTextChange}
          contentRef={contentRef}
          inputRef={inputRef}
        />

        {/* ROW 3: BOTTOM ACTIONS (Attach on left, Cancel and Send on right) */}
        <MuiUserMessageBottomBar
          status={status}
          text={initialText}
          isEditing={true}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onSubmitEdit={handleSubmitEdit}
          onRetry={handleRetry}
          onAttachFiles={handleAttachFiles}
          disabledSubmit={disabledSubmit}
          createdAt={message.createdAt}
          editedAt={message.editedAt}
        />
      </Paper>
    );
  }

  // 2. VIEW MODE: Decoupled topology (media_1791646169233.png)
  // Row 1 (Top outside): Standalone attachment pills flex-wrapped to the right
  // Row 2 (Middle): The ONLY outlined card (only text, with docked [⌵] chevron if clamped)
  // Row 3 (Bottom outside): Action buttons deck or inline error recovery strip
  const hasText = Boolean(initialText && initialText.trim());

  // Defensive Guard for Empty/Ghost User Turns (Case 1):
  // If a user turn contains neither text nor attachments, it possesses zero conversational payload
  // and must strictly emit null to prevent rendering orphan floating timestamps and action buttons.
  if (!hasText && initialAttachments.length === 0) {
    return null;
  }

  return (
    <Box
      className="MuiUserMessage-root"
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        alignSelf: 'flex-end',
        justifySelf: 'end',
        gridArea: 'content',
        ml: 'auto',
        width: 'fit-content',
        minWidth: { xs: 140, sm: 160 },
        maxWidth: { xs: '92%', sm: '85%', md: '80%', lg: '75%' },
        gap: 0.75,
      }}
    >
      {/* ROW 1 (OUTSIDE CARD): STANDALONE ATTACHMENT PILLS */}
      <MuiUserAttachmentShelf
        attachments={initialAttachments}
        isEditing={false}
      />

      {/* ROW 2 (THE ONLY OUTLINED CARD): MESSAGE BODY */}
      {hasText && (
        <Paper
          variant="outlined"
          sx={{
            position: 'relative',
            width: 'fit-content',
            minWidth: { xs: 140, sm: 180 },
            maxWidth: '100%',
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: 1,
            borderColor: 'divider',
            borderRadius: '16px',
            p: 1.5,
            boxShadow: 'none',
            transition: 'border-color 150ms ease',
            '&:hover': {
              borderColor: 'text.secondary',
            },
          }}
        >
          <MuiUserMessageBody
            text={initialText}
            isEditing={false}
            isExpanded={isExpanded}
            hasOverflow={hasOverflow}
            contentRef={contentRef}
          />

          {hasOverflow && (
            <Tooltip title={isExpanded ? 'Show less' : 'Show more'}>
              <IconButton
                size="small"
                onClick={handleToggleExpand}
                aria-label={isExpanded ? 'Show less' : 'Show more'}
                sx={{
                  position: 'absolute',
                  right: 8,
                  bottom: 8,
                  width: 24,
                  height: 24,
                  minWidth: 24,
                  minHeight: 24,
                  p: 0,
                  borderRadius: '50%',
                  color: 'text.secondary',
                  bgcolor: (theme) => alpha(theme.palette.background.paper, 0.85),
                  border: 1,
                  borderColor: 'divider',
                  boxShadow: 'none',
                  backdropFilter: 'blur(4px)',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.action.hover, 0.9),
                    color: 'text.primary',
                  },
                }}
              >
                {isExpanded ? (
                  <ExpandLessIcon sx={{ fontSize: 16 }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Paper>
      )}

      {/* ROW 3 (OUTSIDE CARD): BOTTOM ACTIONS & RETRY DECK */}
      <MuiUserMessageBottomBar
        status={status}
        text={initialText}
        isEditing={false}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onSubmitEdit={handleSubmitEdit}
        onRetry={handleRetry}
        onAttachFiles={handleAttachFiles}
        disabledSubmit={disabledSubmit}
        createdAt={message.createdAt}
        editedAt={message.editedAt}
      />
    </Box>
  );
};

MuiUserMessage.propTypes = {
  messageId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default MuiUserMessage;
