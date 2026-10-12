/**
 * @module components/chat/MuiMessageContent
 * @description Slot dispatcher mounted for messageContent in ChatBox.
 * Inspects message role via useMessageContext:
 * - If role === 'user', delegates to MuiUserMessage (Task 8.10 3-row neutral outlined Paper card).
 * - If role === 'assistant', delegates to native ChatMessageContent (preserving all streaming markdown & parts for Task 8.11).
 */

import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { useMessageContext } from '@mui/x-chat-headless';
import MuiAgentMessage from './MuiAgentMessage.jsx';
import MuiUserMessage from './MuiUserMessage.jsx';

/**
 * Message content slot dispatcher.
 *
 * @component MuiMessageContent
 * @param {object} props - Props forwarded by MUI X Chat.
 * @returns {import('react').JSX.Element} Rendered user or assistant message content.
 */
export const MuiMessageContent = () => {
  const context = useMessageContext();
  const isUser = context.role === 'user' || context.isOwnMessage === true;

  if (isUser) {
    return (
      <Box
        sx={{
          gridArea: 'content',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          width: '100%',
          minWidth: 0,
        }}
      >
        <MuiUserMessage messageId={context.messageId} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        gridArea: 'content',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        minWidth: 0,
      }}
    >
      <MuiAgentMessage messageId={context.messageId} />
    </Box>
  );
};

MuiMessageContent.propTypes = {
  afterContent: PropTypes.node,
};

export default MuiMessageContent;
