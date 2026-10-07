/**
 * @module components/chat/MuiChatEmptyState
 * @description Universal empty state greeting for the personal AI agent canvas.
 * Neutral, general-purpose presentation without restrictive domain-specific prompt chips.
 * Eradicates empty-state greeting flicker during route navigation and history loading on /chat/:chatId.
 */

import { useParams } from 'react-router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { useChatStatus } from '@mui/x-chat-headless';

/**
 * Universal empty state canvas presentation.
 * On root /chat without a conversation ID, displays the onboarding agent greeting.
 * On /chat/:chatId or while history is loading, suppresses the greeting and presents a centered loading indicator.
 *
 * @component MuiChatEmptyState
 * @returns {import('react').JSX.Element} Rendered empty state or loading indicator.
 */
export const MuiChatEmptyState = () => {
  const { chatId } = useParams();
  let isLoadingHistory;

  try {
    const status = useChatStatus();
    isLoadingHistory = Boolean(status?.isLoadingHistory);
  } catch {
    // Graceful fallback if rendered outside ChatProvider context in isolated test suites
    isLoadingHistory = false;
  }

  // Prevent flash of empty state greeting when viewing or loading an existing conversation thread
  if (chatId || isLoadingHistory) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          py: 8,
        }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: { xs: 4, sm: 8 },
        px: 2,
        height: '100%',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          bgcolor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2.5,
          color: 'primary.main',
        }}
      >
        <SmartToyOutlinedIcon sx={{ fontSize: 32 }} />
      </Box>

      <Typography
        variant="h5"
        component="h1"
        sx={{
          fontWeight: 700,
          color: 'text.primary',
          mb: 1,
          letterSpacing: -0.5,
        }}
      >
        Your Personal AI Agent
      </Typography>

      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          maxWidth: 460,
          lineHeight: 1.6,
        }}
      >
        Ask anything, brainstorm ideas, analyze operational tasks, draft communications, or manage daily workflows.
      </Typography>
    </Box>
  );
};

export default MuiChatEmptyState;
