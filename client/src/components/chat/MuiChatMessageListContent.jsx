/**
 * @module components/chat/MuiChatMessageListContent
 * @description Custom MessageListContent slot component providing:
 * 1. An accessible "Load earlier messages" affordance when hasMoreHistory is true,
 *    guaranteeing reverse pagination works even on short conversations that do not overflow the viewport.
 * 2. Visual loading indicator when history turns are being fetched.
 * 3. Default message items rendering with complete MUI X Chat styling preservation.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { styled } from '@mui/material/styles';
import { useChat } from '@mui/x-chat-headless';

const ChatListContentRoot = styled('div', {
  name: 'MuiChatMessageList',
  slot: 'content',
})({
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  flex: '1 1 auto',
  minHeight: '100%',
  justifyContent: 'flex-end',
  gap: 'var(--ChatMessageList-gap, 0px)',
});

export const MuiChatMessageListContent = React.forwardRef(function MuiChatMessageListContent(props, ref) {
  const { children, className, ...other } = props;
  const { hasMoreHistory, isLoadingHistory, loadMoreHistory } = useChat();

  return (
    <ChatListContentRoot
      ref={ref}
      className={`MuiChatMessageList-content ${className || ''}`}
      {...other}
    >
      {hasMoreHistory && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: 1.5,
            width: '100%',
            flexShrink: 0,
          }}
        >
          <Button
            size="small"
            variant="outlined"
            startIcon={
              isLoadingHistory ? (
                <CircularProgress size={13} color="inherit" />
              ) : (
                <KeyboardArrowUpIcon fontSize="small" />
              )
            }
            disabled={isLoadingHistory}
            onClick={() => {
              if (typeof loadMoreHistory === 'function') {
                loadMoreHistory();
              }
            }}
            sx={{
              fontSize: '0.78rem',
              fontWeight: 500,
              textTransform: 'none',
              color: 'text.secondary',
              borderColor: 'divider',
              borderRadius: 4,
              px: 2,
              py: 0.35,
              bgcolor: 'background.paper',
              boxShadow: 1,
              '&:hover': {
                bgcolor: 'action.hover',
                borderColor: 'text.secondary',
                color: 'text.primary',
              },
            }}
          >
            {isLoadingHistory ? 'Loading earlier messages...' : 'Load earlier messages'}
          </Button>
        </Box>
      )}
      {children}
    </ChatListContentRoot>
  );
});

MuiChatMessageListContent.displayName = 'MuiChatMessageListContent';

export default MuiChatMessageListContent;
