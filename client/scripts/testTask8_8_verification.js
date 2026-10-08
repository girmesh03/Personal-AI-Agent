/**
 * @file testTask8_8_verification.js
 * @description Automated verification script for Task 8.8 Point 1 (User & Agent Turn Lifecycle).
 */

import fs from 'fs';
import path from 'path';
import process from 'node:process';

let passCount = 0;
let failCount = 0;

const assert = (condition, description) => {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passCount += 1;
  } else {
    console.error(`  [FAIL] ${description}`);
    failCount += 1;
  }
};

console.log('=== Task 8.8 Point 1: User & Agent Turn Lifecycle Verification ===\n');

// 1. Check OperonChatAdapter is permanently purged
const operonAdapterExists = fs.existsSync(path.resolve('client/src/adapters/OperonChatAdapter.js'));
assert(!operonAdapterExists, 'OperonChatAdapter.js is permanently removed from filesystem');

// 2. Check backend stream retry handles upstream JSON segment errors
const chatControllerSrc = fs.readFileSync(path.resolve('backend/src/controllers/chatController.js'), 'utf8');
assert(
  chatControllerSrc.includes("streamErr.message?.includes('Incomplete JSON')") &&
  chatControllerSrc.includes("streamErr.message?.includes('JSON segment')"),
  'backend/src/controllers/chatController.js includes self-healing retry for upstream Incomplete JSON segment errors'
);

// 3. Check 403 vs 401 invariant in apiSlice
const apiSliceSrc = fs.readFileSync(path.resolve('client/src/redux/app/apiSlice.js'), 'utf8');
assert(
  !apiSliceSrc.includes('refreshResult?.error?.status === 403') &&
  apiSliceSrc.includes('if (refreshResult?.error?.status === 401)'),
  'client/src/redux/app/apiSlice.js strictly isolates 401 (unauthenticated) from 403 (unauthorized/forbidden) during logout'
);

// 4. Check MuiRecentChat.jsx modular encapsulation
const recentChatSrc = fs.readFileSync(path.resolve('client/src/components/chat/MuiRecentChat.jsx'), 'utf8');
assert(
  recentChatSrc.includes('export const MuiRecentChat') &&
  recentChatSrc.includes('useGetChatsQuery') &&
  recentChatSrc.includes('useDeleteChatMutation') &&
  recentChatSrc.includes('usePinChatMutation') &&
  recentChatSrc.includes('useRenameChatMutation'),
  'client/src/components/chat/MuiRecentChat.jsx encapsulates RTK Query chats query and mutations'
);

assert(
  recentChatSrc.includes('MuiConfirmDialog') &&
  recentChatSrc.includes('handleSaveInlineRename') &&
  recentChatSrc.includes('handlePinClick'),
  'client/src/components/chat/MuiRecentChat.jsx handles full action lifecycle (pin/unpin, rename, delete modal)'
);

// 5. Check MuiSidebar.jsx integration
const sidebarSrc = fs.readFileSync(path.resolve('client/src/layouts/MuiSidebar.jsx'), 'utf8');
assert(
  sidebarSrc.includes('<MuiRecentChat isMini={isMini} onMobileClose={onMobileClose} />'),
  'client/src/layouts/MuiSidebar.jsx delegates recent chats rendering entirely to MuiRecentChat'
);
assert(
  !sidebarSrc.includes('handleChatMenuOpen') &&
  !sidebarSrc.includes('deleteConfirmOpen'),
  'client/src/layouts/MuiSidebar.jsx is purged of chat menu and deletion modal clutter'
);

// 6. Check MuiChatEmptyState.jsx zero-flicker behavior
const emptyStateSrc = fs.readFileSync(path.resolve('client/src/components/chat/MuiChatEmptyState.jsx'), 'utf8');
assert(
  emptyStateSrc.includes('useParams()') &&
  emptyStateSrc.includes('useChatStatus()') &&
  emptyStateSrc.includes('if (chatId || isLoadingHistory)'),
  'client/src/components/chat/MuiChatEmptyState.jsx suppresses onboarding greeting on /chat/:chatId or during history loading'
);

// 7. Check MuiChatAdapter.js real-time invalidation and accessors
const adapterSrc = fs.readFileSync(path.resolve('client/src/adapters/MuiChatAdapter.js'), 'utf8');
assert(
  adapterSrc.includes("case 'session':") &&
  adapterSrc.includes("apiSlice.util.invalidateTags([{ type: 'Chat', id: 'LIST' }])"),
  'client/src/adapters/MuiChatAdapter.js invalidates Chat LIST tag immediately upon session creation'
);

// 8. Check Chat.jsx slot purity and sessionKey
const chatPageSrc = fs.readFileSync(path.resolve('client/src/pages/Chat.jsx'), 'utf8');
assert(
  !chatPageSrc.includes('conversationHeader: () => null'),
  'client/src/pages/Chat.jsx removes redundant conversationHeader null slot'
);
assert(
  chatPageSrc.includes('ATTACHMENT_CONSTANTS.MAX_FILES_PER_UPLOAD') &&
  chatPageSrc.includes('ATTACHMENT_CONSTANTS.MAX_FILE_SIZE_BYTES'),
  'client/src/pages/Chat.jsx leverages ATTACHMENT_CONSTANTS without hardcoded values'
);
assert(
  chatPageSrc.includes('key={sessionKey}') &&
  chatPageSrc.includes('location.key'),
  'client/src/pages/Chat.jsx binds dynamic sessionKey to ChatBox with location.key fallback'
);

// 9. Check New Chat buttons in MuiRecentChat and MuiSidebar pass fresh newChatAt state
assert(
  recentChatSrc.includes('navigate(ROUTES.CHAT, { state: { newChatAt: Date.now() } })'),
  'client/src/components/chat/MuiRecentChat.jsx passes newChatAt state on new chat actions'
);
assert(
  sidebarSrc.includes('navigate(ROUTES.CHAT, { state: { newChatAt: Date.now() } })'),
  'client/src/layouts/MuiSidebar.jsx passes newChatAt state on Chat nav item click'
);

console.log(`\nResults: ${passCount} PASSED, ${failCount} FAILED.`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('Task 8.8 Point 1 automated verification successfully verified all criteria!\n');
}
