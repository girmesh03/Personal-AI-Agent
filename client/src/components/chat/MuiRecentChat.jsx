/**
 * @module components/chat/MuiRecentChat
 * @description Encapsulated Recent Chat component adhering to the React Single Responsibility Principle.
 * Manages chat list querying, pinning, accessible inline renaming, deletion modal,
 * and responsive presentation (full list vs. mini icon rail) with zero parent drawer coupling.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';

import AddIcon from '@mui/icons-material/Add';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

import { selectCurrentUser } from '../../redux/features/authSlice.js';
import {
  useGetChatsQuery,
  useDeleteChatMutation,
  usePinChatMutation,
  useRenameChatMutation,
} from '../../redux/features/chatSlice.js';
import { MuiConfirmDialog } from '../reusable/MuiConfirmDialog.jsx';
import { ROUTES } from '../../utils/constants.js';

/**
 * Encapsulated Recent Chats component.
 *
 * @component MuiRecentChat
 * @param {object} props - Component properties.
 * @param {boolean} [props.isMini=false] - Whether sidebar drawer is rendered in collapsed mini mode.
 * @param {() => void} [props.onMobileClose] - Optional callback to close temporary mobile drawer on item selection.
 * @returns {import('react').JSX.Element} Rendered recent chats interface.
 */
export const MuiRecentChat = ({ isMini = false, onMobileClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSelector(selectCurrentUser);

  // RTK Query: chat list query & lifecycle mutations
  const { data: chatData, isLoading: isLoadingChats } = useGetChatsQuery(undefined, { skip: !user });
  const chats = useMemo(() => chatData?.chats || [], [chatData?.chats]);

  const [deleteChat, { isLoading: isDeletingChat }] = useDeleteChatMutation();
  const [pinChat] = usePinChatMutation();
  const [renameChat, { isLoading: isRenamingChat }] = useRenameChatMutation();

  // 3-dots action menu state
  const [chatMenuAnchorEl, setChatMenuAnchorEl] = useState(null);
  const [activeMenuChat, setActiveMenuChat] = useState(null);

  // Accessible inline renaming state
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef(null);
  const editStartTimeRef = useRef(0);

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Auto-focus and select text when entering inline edit mode
  useEffect(() => {
    if (editingChatId) {
      const timer = setTimeout(() => {
        if (editInputRef.current) {
          editInputRef.current.focus();
          editInputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editingChatId]);

  // Action Menu Handlers
  const handleChatMenuOpen = (event, chat) => {
    event.preventDefault();
    event.stopPropagation();
    setChatMenuAnchorEl(event.currentTarget);
    setActiveMenuChat(chat);
  };

  const handleChatMenuClose = () => {
    setChatMenuAnchorEl(null);
  };

  const handlePinClick = async () => {
    if (!activeMenuChat) return;
    const targetChat = activeMenuChat;
    handleChatMenuClose();
    try {
      await pinChat(targetChat._id).unwrap();
    } catch (err) {
      console.error('[MuiRecentChat] Failed to pin chat:', err);
    }
  };

  const handleRenameClick = () => {
    if (!activeMenuChat) return;
    const targetChat = activeMenuChat;

    // Explicitly blur focused element so closing Menu paper never retains focus while aria-hidden
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }

    setChatMenuAnchorEl(null);
    setActiveMenuChat(null);

    editStartTimeRef.current = Date.now();
    setEditingChatId(targetChat._id);
    setEditingTitle(targetChat.title || '');
  };

  const handleSaveInlineRename = async (chatId, currentTitle) => {
    const trimmed = editingTitle.trim();
    if (!trimmed || trimmed === currentTitle) {
      setEditingChatId(null);
      setEditingTitle('');
      return;
    }
    if (isRenamingChat) return;

    try {
      await renameChat({
        chatId,
        title: trimmed,
      }).unwrap();
    } catch (err) {
      console.error('[MuiRecentChat] Failed to rename chat:', err);
    } finally {
      setEditingChatId(null);
      setEditingTitle('');
    }
  };

  const handleCancelInlineRename = () => {
    setEditingChatId(null);
    setEditingTitle('');
  };

  const handleDeleteClick = () => {
    handleChatMenuClose();
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!activeMenuChat) return;
    const targetId = activeMenuChat._id;
    try {
      await deleteChat(targetId).unwrap();
      if (location.pathname === `/chat/${targetId}`) {
        navigate(ROUTES.CHAT, { state: { newChatAt: Date.now() } });
      }
    } catch (err) {
      console.error('[MuiRecentChat] Failed to delete chat:', err);
    } finally {
      setDeleteConfirmOpen(false);
      setActiveMenuChat(null);
    }
  };

  // Mini Drawer Render
  if (isMini) {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : location.pathname;
    return (
      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
        <Divider sx={{ my: 1, mx: 1, flexShrink: 0 }} />
        <Tooltip title="New Chat" placement="right" arrow>
          <IconButton
            size="small"
            aria-label="New chat"
            onClick={() => navigate(ROUTES.CHAT, { state: { newChatAt: Date.now() } })}
            sx={{ mx: 'auto', display: 'flex', mb: 0.5, color: 'text.secondary', flexShrink: 0 }}
          >
            <AddIcon fontSize="small" sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <List
          dense
          disablePadding
          aria-label="Recent chats mini"
          sx={{
            flexGrow: 1,
            minHeight: 0,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {chats.slice(0, 5).map((chat) => {
            const chatPath = `/chat/${chat._id}`;
            const isChatSelected = location.pathname === chatPath || currentPath === chatPath;
            return (
              <Tooltip
                key={chat._id}
                title={`${chat.isPinned ? '[Pinned] ' : ''}${chat.title || 'Untitled Chat'}`}
                placement="right"
                arrow
              >
                <ListItemButton
                  component={NavLink}
                  to={chatPath}
                  selected={isChatSelected}
                  sx={{
                    mx: 1,
                    my: 0.25,
                    borderRadius: 1,
                    justifyContent: 'center',
                    px: 0,
                    py: 0.5,
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      justifyContent: 'center',
                      color: isChatSelected ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {chat.isPinned ? (
                      <PushPinIcon
                        sx={{
                          fontSize: 16,
                          color: 'primary.main',
                          transform: 'rotate(45deg)',
                        }}
                      />
                    ) : (
                      <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
                    )}
                  </ListItemIcon>
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
      </Box>
    );
  }

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : location.pathname;

  // Full Expanded Drawer Render
  return (
    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
      <Divider sx={{ my: 1, mx: 1.5, flexShrink: 0 }} />
      {/* Header section with [+ New Chat] */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 0.5,
          flexShrink: 0,
        }}
      >
        <Typography
          variant="overline"
          sx={{
            color: 'text.secondary',
            fontWeight: 700,
            letterSpacing: '0.08em',
            fontSize: '0.7rem',
          }}
        >
          Recent Chats
        </Typography>
        <Tooltip title="New Chat" arrow placement="top">
          <IconButton
            size="small"
            aria-label="Create new chat"
            onClick={() => {
              navigate(ROUTES.CHAT, { state: { newChatAt: Date.now() } });
              if (onMobileClose) onMobileClose();
            }}
            sx={{
              p: 0.5,
              color: 'text.secondary',
              '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
            }}
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Scrollable chat thread items list */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          minHeight: 0,
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'action.hover',
            borderRadius: 2,
          },
        }}
      >
        {isLoadingChats && chats.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : (
          <List dense disablePadding aria-label="Recent chats list">
            {chats.map((chat) => {
              const chatPath = `/chat/${chat._id}`;
              const isChatSelected = location.pathname === chatPath || currentPath === chatPath;
              const isEditing = editingChatId === chat._id;

              if (isEditing) {
                return (
                  <Box
                    key={chat._id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1.5,
                      py: 0.5,
                      mx: 1,
                      my: 0.25,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <TextField
                      inputRef={editInputRef}
                      size="small"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveInlineRename(chat._id, chat.title);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          handleCancelInlineRename();
                        }
                      }}
                      onBlur={(e) => {
                        if (Date.now() - editStartTimeRef.current < 300) return;
                        if (e.relatedTarget && e.relatedTarget.closest('.inline-rename-btn')) return;
                        handleSaveInlineRename(chat._id, chat.title);
                      }}
                      variant="standard"
                      autoFocus
                      disabled={isRenamingChat}
                      slotProps={{
                        input: {
                          disableUnderline: false,
                          sx: {
                            fontSize: '0.82rem',
                            fontWeight: 500,
                            py: 0.25,
                          },
                        },
                      }}
                      sx={{ flexGrow: 1, minWidth: 0 }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                      <Tooltip title="Save (Enter)" arrow>
                        <IconButton
                          size="small"
                          className="inline-rename-btn"
                          aria-label="Save title"
                          onClick={() => handleSaveInlineRename(chat._id, chat.title)}
                          disabled={isRenamingChat}
                          sx={{
                            p: 0.25,
                            color: 'primary.main',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <CheckIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Cancel (Esc)" arrow>
                        <IconButton
                          size="small"
                          className="inline-rename-btn"
                          aria-label="Cancel rename"
                          onClick={handleCancelInlineRename}
                          disabled={isRenamingChat}
                          sx={{
                            p: 0.25,
                            color: 'text.secondary',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              }

              return (
                <ListItemButton
                  key={chat._id}
                  component={NavLink}
                  to={chatPath}
                  selected={isChatSelected}
                  onClick={() => {
                    if (onMobileClose) onMobileClose();
                  }}
                  sx={{
                    mx: 1,
                    my: 0.25,
                    borderRadius: 1,
                    px: 1.5,
                    pr: 4.5,
                    py: 0.5,
                    position: 'relative',
                    '&:hover': {
                      bgcolor: 'action.hover',
                      '& .chat-item-more-btn': {
                        opacity: 1,
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 26,
                      justifyContent: 'center',
                      color: isChatSelected ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
                  </ListItemIcon>
                  <ListItemText
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingChatId(chat._id);
                      setEditingTitle(chat.title || '');
                      editStartTimeRef.current = Date.now();
                    }}
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 0.5 }}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            fontSize: '0.82rem',
                            fontWeight: isChatSelected ? 600 : 400,
                            flexGrow: 1,
                            minWidth: 0,
                          }}
                        >
                          {chat.title || 'Untitled Chat'}
                        </Typography>
                        {chat.isPinned && (
                          <Tooltip title="Pinned" arrow placement="top">
                            <PushPinIcon
                              sx={{
                                fontSize: 13,
                                color: 'primary.main',
                                flexShrink: 0,
                                transform: 'rotate(45deg)',
                              }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    }
                  />
                  <IconButton
                    size="small"
                    className="chat-item-more-btn"
                    aria-label="Chat options"
                    onClick={(e) => handleChatMenuOpen(e, chat)}
                    sx={{
                      position: 'absolute',
                      right: 4,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      p: 0.25,
                      color: 'text.secondary',
                      bgcolor: 'transparent !important',
                      opacity: isChatSelected ? 1 : 0,
                      transition: 'opacity 0.15s ease',
                      '&:hover': {
                        color: 'text.primary',
                        bgcolor: 'action.hover !important',
                      },
                    }}
                  >
                    <MoreVertIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </ListItemButton>
              );
            })}
            {chats.length === 0 && (
              <Typography
                variant="caption"
                sx={{ px: 2, py: 1, color: 'text.disabled', display: 'block' }}
              >
                No recent chats
              </Typography>
            )}
          </List>
        )}
      </Box>

      {/* Chat session 3-dots actions menu */}
      <Menu
        anchorEl={chatMenuAnchorEl}
        open={Boolean(chatMenuAnchorEl)}
        onClose={handleChatMenuClose}
        transitionDuration={0}
        disableRestoreFocus
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          root: {
            disableEnforceFocus: true,
          },
          paper: {
            sx: { minWidth: 150, boxShadow: 3 },
          },
        }}
      >
        <MenuItem onClick={handlePinClick} sx={{ fontSize: '0.82rem' }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            {activeMenuChat?.isPinned ? (
              <PushPinIcon fontSize="small" sx={{ fontSize: 18, color: 'primary.main' }} />
            ) : (
              <PushPinOutlinedIcon fontSize="small" sx={{ fontSize: 18 }} />
            )}
          </ListItemIcon>
          {activeMenuChat?.isPinned ? 'Unpin thread' : 'Pin thread'}
        </MenuItem>
        <MenuItem onClick={handleRenameClick} sx={{ fontSize: '0.82rem' }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <EditOutlinedIcon fontSize="small" sx={{ fontSize: 18 }} />
          </ListItemIcon>
          Rename
        </MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ fontSize: '0.82rem', color: 'error.main' }}>
          <ListItemIcon sx={{ minWidth: 28, color: 'error.main' }}>
            <DeleteOutlinedIcon fontSize="small" sx={{ fontSize: 18 }} />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      {/* Delete chat confirmation modal */}
      <MuiConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Conversation"
        message={`Are you sure you want to delete "${activeMenuChat?.title || 'this conversation'}"? All messages and attachments in this thread will be permanently deleted.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        loading={isDeletingChat}
      />
    </Box>
  );
};

MuiRecentChat.propTypes = {
  isMini: PropTypes.bool,
  onMobileClose: PropTypes.func,
};

export default MuiRecentChat;
