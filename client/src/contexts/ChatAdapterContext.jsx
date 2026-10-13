/**
 * @module contexts/ChatAdapterContext
 * @description React Context providing access to the active MuiChatAdapter instance
 * across all chat message and toolbar components.
 */

import { createContext, useContext } from 'react';

export const ChatAdapterContext = createContext(null);

/**
 * Accessor hook for the active ChatAdapter instance.
 *
 * @returns {import('../adapters/MuiChatAdapter.js').MuiChatAdapter|null} Active adapter or null.
 */
export const useChatAdapter = () => useContext(ChatAdapterContext);

export default ChatAdapterContext;
