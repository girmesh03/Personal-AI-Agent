/**
 * @module components/chat/chatMessageStyles
 * @description Centralized styling configurations for MUI X Chat message items.
 * Enforces neutral outlined Paper/Card styling (variant="outlined", borderColor: 'divider',
 * bgcolor: 'background.paper'), eliminating saturated blue bubble fills in light and dark themes.
 */

/**
 * Common style rules for neutral outlined message cards.
 * @constant
 * @type {object}
 */
export const neutralMessageBubbleSx = {
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.primary',
  boxShadow: 'none',
  p: { xs: 1.5, sm: 2 },
  maxWidth: '100%',
  wordBreak: 'break-word',
  '&:hover': {
    borderColor: 'text.secondary',
  },
};

/**
 * Message slot configurations for ChatBox or ChatMessage.
 * Applies neutral card styling and configures slot components.
 * @constant
 * @type {object}
 */
export const chatMessageSlotProps = {
  root: {
    sx: {
      mb: 1.5,
      '& .MuiChatMessage-bubble': {
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.primary',
        boxShadow: 'none',
        p: { xs: 1.5, sm: 2 },
      },
    },
  },
};
