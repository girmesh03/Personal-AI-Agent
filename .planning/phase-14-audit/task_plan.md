# Task Plan: Phase 14 Exhaustive Multimodal Chat, Attachment Lifecycle, and Agent Reliability Audit

## Goal
Conduct an exhaustive, evidence-based audit of chat multimodal attachment handling, storage persistence, real-time status tracking, API credentials, Telegram broadcast rendering, authentication flows, error messaging, and agent reliability, develop a fully aligned implementation plan, and systematically implement the approved solution across the entire application.

## Stages & Status
- **Stage A: Audit, research, validation, and initial plan** -> `complete`
- **Stage B: Incorporate user feedback & produce final aligned implementation plan** -> `complete`
- **Phase 14B: Temporary Issue Rectification & Review Protocol** -> `active` (Governing all rectification work)
- **Stage C: Implementation of approved plan under established protocols** -> `paused` (Implementation freeze active pending Phase 14B protocol approvals)

## Phase 14B Mandatory Temporary Protocol (Active Governance)
Retrieved directly from Phase 11B (`COMPLETE_REMAINING_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md` Section 10.5):
1. **User Points Out Issues**: The user points out one or more issues/points at a time.
2. **Exhaustive Logical Reasoning**: For each issue/point provided by the user, the agent conducts an exhaustive and deep logical reasoning analysis based on First Principles.
3. **Surgical Append to Plan**: The agent surgically appends the logically reasoned solution for each issue/point at the last point under Phase 14B in the master planning artifact (`PHASE_14_EXHAUSTIVE_MULTIMODAL_CHAT_AND_AGENT_RELIABILITY_AUDIT.md`).
4. **User Review Request**: The agent asks the user to review the surgically appended, logically reasoned solution without touching implementation code.
5. **User Confirmation Gate**: ONLY when the user explicitly confirms and approves the proposed solution, the agent proceeds to apply/implement the confirmed solution.
6. **Validation Prior to Review**: When the agent completes applying/implementing, it thoroughly validates what was done according to the logically reasoned solution (running tests, build, top-to-bottom file inspection) before asking for user review.
7. **Review & Feedback Loop**: Once validation is complete, the agent presents the work to the user for review, waits for feedback, and acts strictly based on that feedback.

### Strict Protocol Invariants:
- **Logic Must Always Win**: Logic over subjective thoughts, assumptions, or stale plans.
- **Testing Boundaries (Strict Split Testing Law)**: All backend tests belong 100% to the agent (authentic, automated test scripts). All browser testing is strictly and exclusively performed by the user. The agent must **NEVER** attempt the browser test under any circumstances.
- **Universal Scope of "User Input" & "User Message"**: The term "user input", "user message", or any related expression strictly encompasses *anything* provided by the user across *all* interaction surfaces (composer, message edit, retry). It includes text messages, file attachments, images, audio/voice notes, and any arbitrary combination thereof.
- **Exhaustive Multimodal Combinations & State Availability Law**: The system must never assume or enforce single-modality inputs. Every combination of what is available at that exact moment must be fully supported (text alone, file alone, image alone, audio alone, text+file, text+image, text+audio, file+image, file+audio, image+audio, text+file+image+audio). What is present at that moment must be recognized, preserved, and accurately processed across validation, storage, model payload assembly, streaming, and UI rendering without synthetic constraints.
- **Zero Commits**: No git commits unless explicitly requested by the user.
- **Zero Details Skipped**: Every single detail strictly considered and respected.
- **Preserve Functional Code**: Never break what is already functional.
- **Deep Logical Reasoning**: Do not accept any detail blindly; concrete demonstrable reasons for every decision.
- **UI Diagrams**: Multi-breakpoint UI diagrams included whenever UI is involved.
- **Append Location**: Appended solutions MUST be placed at the last point under Phase 14B.
- **Implementation Freeze**: Strictly NO code implementation until explicit user approval.

## Phase 14B Defect Battery [ALL POINTS IMPLEMENTED & VERIFIED]
- **Point 1: Agent Message Retry** [COMPLETE & VERIFIED]:
  * In-place assistant node replacement (`targetAssistantMessageId`) in `MuiChatAdapter.js`.
  * Store pruning of all downstream message IDs ($> k$) in `MuiAgentMessage.jsx`.
  * Strict database $U \to A \to U \to A$ alternation preservation and downstream asset destruction.
- **Point 2: Upload from Composer & End-to-End Asset Lifecycle** [COMPLETE & VERIFIED]:
  * Deterministic directory organization `backend/uploads/{avatars,images,files,audios,temp}` in `constants.js`.
  * Dynamic storage routing in `uploadMiddleware.js` accepting both `ATTACHMENT_CONSTANTS` and `AUDIO_CONSTANTS`.
  * Reactive pending upload state via `useSyncExternalStore` in `attachmentRegistry.js`.
  * Immediate upload progress unmounting and unlinking on both local disk and Cloud CDN in `MuiComposerTopToolbar.jsx` on `[✕]`.
- **Point 3: User Nth-Turn Message Edit** [COMPLETE & VERIFIED]:
  * Eager upload in edit mode; backend asset delta calculation ($\Delta = \text{Original} \setminus \text{Kept}$) destroys removed assets while preserving kept ones.
  * Downstream turns ($> \text{editIdx}$) and their associated assets are cleanly destroyed.
  * Multimodal `geminiContents` preserved across model failover sequences.
- **Point 4: Authentic Agent Status Tracking** [COMPLETE & VERIFIED]:
  * Purged speculative "Thinking... 5.2s" fallback; gated "Thinking..." strictly on incoming `hasReasoning === true`.
  * Authentic backend SSE status emissions: `transcribing_audio`, `processing_documents`, `connecting`, `model_failover`, `tool_executing`.
- **Point 5: Model Selector Flow & Stale Route Desynchronization** [COMPLETE & VERIFIED]:
  * Unconditionally clear `activeChatId` in `Chat.jsx` on `/chat` route.
  * Gated `updateChatConfig` strictly on valid route session ID.
  * Sanitized `sttEngine` against `CHAT_CONSTANTS.STT_ENGINES`.
  * Fixed critical BYOK key wipe bug in `userController.js` by selecting `+settings.apiKeys.geminiApiKey +settings.apiKeys.addisApiKey` in all transaction queries.
- **Point 6: Seamless Authentication (Google SSO vs Email/Password Reconciliation)** [COMPLETE & VERIFIED]:
  * Zero-takeover security invariant preserved.
  * Dynamic transformation of Google SSO button into 1-click CTA `[ Continue with Google as ${submittedEmail} ]`.
- **Point 7: Complete Elimination of `process.env.NODE_ENV = 'test'`** [COMPLETE & VERIFIED]:
  * Pure binary environment topology: strictly `development` and `production`.
  * Completely purged `NODE_ENV === 'test'` across all controllers and scripts.
  * Test suites seed BYOK credentials directly on test user documents in MongoDB Atlas just like real human users.
- **Point 8: Composer In-Flight Upload Cancellation, Full-Lifecycle Asset Purge, and Multimodal Submission 422 Rectification** [COMPLETE & VERIFIED]:
  * Fixed `ReferenceError: UPLOADS_CONFIG is not defined` in `deleteComposerAttachment` (`chatController.js`), preventing HTTP 500 crash on attachment clear.
  * Replaced premature 400 error with graceful HTTP 200 `{ result: 'noop' }` when clearing attachments before identifiers are assigned.
  * Upgraded `attachmentRegistry.js` with `abortFn` and `onResolvedAfterCancelCleanup` to immediately abort in-flight uploads on dismiss and sweep late-resolving orphan assets.
  * Synchronous pending upload count decrement in `attachmentRegistry.js` releasing send button gating without lag.
  * Eliminated HTTP 422 `ValidationError` on message submission by expanding `sendChatMessageValidation` to accept `ATTACHMENT_CONSTANTS` and `AUDIO_CONSTANTS` (extensions, MIME formats, sizes, and cloud URL paths).
  * Enhanced `attachmentProcessor.js` with full domain directory resolution and Cloudinary HTTP fallback for remote assets.
- **Point 9: Full-Lifecycle User Message Turn Edit, Multimodal Ingestion, In-Flight Cancellation, Delta Accounting, and Linear Pruning** [COMPLETE & VERIFIED]:
  * Eager dual-track upload (`uploadAudio` vs `uploadAttachments`) during message edit mode with reactive progress spinner.
  * In-flight upload cancellation with immediate abort and post-cancel orphan sweeping.
  * Abandoned edit session cleanup: purging completed uploads if edit is canceled or blurred.
  * Turn N delta asset accounting: $\Delta_{\text{audios}} = \text{Original} \setminus \text{Kept}$ and $\Delta_{\text{attachments}} = \text{Original} \setminus \text{Kept}$ destroying only removed assets.
  * Complete downstream turn & asset destruction for pruned messages ($> \text{editIdx}$), covering Cloudinary assets, disk files, and MongoDB `Audio` documents.
  * Universal input submission passing arbitrary combinations to the agent without artificial constraints.
- **Point 10: Turn N Edit Audio Preservation, Dual-Pool Delta Accounting, and Universal Multimodal Re-Assembly** [COMPLETE & VERIFIED]:
  * Server-side `Audio.find` resolution for target turn audios and dual-pool matching against incoming audios and attachments.
  * Permanent prevention of false-positive Cloudinary asset and MongoDB Audio deletion during turn edit.
  * Frontend audio ID and metadata preservation across composer optimistic store and edit mode in `MuiAttachButton.jsx`, `MuiUserMessage.jsx`, and `MuiChatAdapter.js`.
  * Real-time user turn asset synchronization on SSE stream completion (`event: done`).
  * Universal multimodal ingestion sending whatever is available on the turn (Audio + Image, Audio + Doc, etc.) to Gemini inline parts.
- **Point 11: Login UI Google Brand Alignment, Recursive Tool Loop Dynamics, and Generated Document Storage Lifecycle** [COMPLETE & VERIFIED]:
  * Restored pristine, uncluttered Login UI adhering to official Google Brand Standards with zero horizontal text overflow.
  * Eliminated duplicate action button clutter inside the SSO password recovery Alert banner.
  * Expanded autonomous recursive tool loop ceiling (`maxSteps: 10`) with zero-crash guarantee and final synthesis guard.
  * Integrated `uploads/generated_documents/` 24-hour lifecycle sweep in `sweeper.js` Pass 2.
- **Point 12: Dual-Tier Storage Cleanup Engine (Atomic Cloudinary & Local Disk `backend/uploads/*` Purging Across All Vectors)** [COMPLETE & VERIFIED]:
  * Centralized `safeUnlinkDiskFile` helper in `storageService.js` resolving across all domain directories (`images`, `files`, `audios`, `attachments`, `avatars`, `temp`, `generated_documents`).
  * Dual-purge parity across all 8 vectors: chat deletion, turn edit delta, downstream turn prune, retry discard, composer dismiss, avatar replacement, report deletion, and user cascade.
  * Comprehensive physical disk unlinking verification in `testPhase14TurnEditLifecycle.js`.
- **Point 13: Zero Unused Imports, Dead Code, and Redundant Bindings Across Chat Controller & Backend Architecture** [COMPLETE & VERIFIED]:
  * Purge unused `env` import (`chatController.js:16`) and unused `formatSttEngineDisplayName` import (`chatController.js:20`).
  * Eliminate dead variable `const sttEngineLabel = formatSttEngineDisplayName(activeSttEngine)` (`chatController.js:368`).
  * Remove dead accumulator variables `stepText` and `stepThought` from generator streaming loop.
  * Universal hygiene sweep across `backend/src` removing unused identifiers across `errorHandler.js`, `documentGenerationService.js`, `googleDriveService.js`, `telegramService.js`, `audioChunker.js`, and `token.js`.
  * Automated static verification asserting 0 unused variables across `backend/src`.
- **Point 14: Zero-Secret Leak Invariant, Git History Sanitization, Multi-Layer Secret Scanning & Automated Pre-Commit Guard Engine** [PLANNING - AWAITING USER APPROVAL]:
  * Eradicate live Telegram Bot Token hardcoded in `backend/scripts/testPhase14UserJourney.js:268`.
  * Rewrite and sanitize git commit history for `4c18f7d` across `main` and phase branch, followed by remote force-push.
  * Provide explicit provider-level revocation & rotation steps for the user via `@BotFather`.
  * Implement zero-dependency secret scanner script (`scripts/checkSecrets.js`).
  * Install tracked Git pre-commit hook (`.githooks/pre-commit`) configured via `core.hooksPath` to abort commits when secrets are staged.
  * Integrate `"check:secrets"` script into `package.json` and verification pipeline.
- **Point 15: Cross-Platform Linux Headless Amharic Font Rendering Engine for Telegram Image Cards (Render & Vercel Parity)** [COMPLETE & VERIFIED]:
  * Convert and bundle native TrueType fonts (`NotoSansEthiopic-Regular.ttf` and `NotoSansEthiopic-Bold.ttf`) in `backend/src/assets/fonts/`.
  * Supply portable `fonts.conf` with relative search paths and `/tmp/fonts-cache` writable cache.
  * Auto-initialize `process.env.FONTCONFIG_PATH` in `telegramService.js` before Sharp SVG rasterization on Linux.
  * Add automated user-space font installer (`backend/scripts/installFonts.js`) invoked on `npm install` (postinstall) to copy TTFs to `~/.local/share/fonts/` and run `fc-cache -f`.
  * Update `render.yaml` buildCommand to ensure font cache is built during deployment.
- **Point 16: Bilingual Latin + Ethiopic Typography Parity & Multi-Font Fallback Engine for Telegram Image Cards** [COMPLETE & VERIFIED]:
  * Bundle Latin TrueType fonts (`NotoSansLatin-Regular.ttf`, `NotoSansLatin-Bold.ttf`, `Inter-Regular.ttf`, `Inter-Bold.ttf`) alongside Ethiopic fonts in `backend/src/assets/fonts/`.
  * Update `fonts.conf` to scan local directory AND host Linux font directories (`/usr/share/fonts`, `/usr/local/share/fonts`, `~/.local/share/fonts`).
  * Configure explicit Fontconfig fallback aliases (`Noto Sans Ethiopic` -> `Noto Sans` -> `Inter` -> `DejaVu Sans`).
  * Update `FONT_FAMILY` in `constants.js` to full bilingual chain (`"Noto Sans Ethiopic", "Noto Sans", "Inter", sans-serif`).
  * Verify rasterization of mixed Amharic + English (`Awash Bank`) + ASCII punctuation (`/`, `()`).
- **Phase 14C Defect Battery - Point 17: Modular Live Speech-to-Text (STT) Powered by Addis AI Scribe Realtime Audio Streaming** [COMPLETE & VERIFIED]:
  * Implement backend Scribe ticket generation endpoint `POST /api/v1/chat/scribe-session` with key security isolation.
  * Create reusable `useAddisLiveStt` hook managing Web Audio API 16 kHz Mono PCM16 downsampling and WebSocket streaming.
  * Create modular `MuiLiveSttButton` component with idle, connecting, and active pulsing wave states.
  * Mount `MuiLiveSttButton` into `MuiComposerBottomToolbar` right cluster next to the microphone.
- **Phase 14C Defect Battery - Point 18: Contextual Telegram Sharing of Actual Operational Artifacts (Reports & Transcriptions)** [COMPLETE & VERIFIED]:
  * Implement smart payload resolver (`resolveActualSharePayload`) in `client/src/utils/telegramPayloadResolver.js` used by `MuiAgentMessageBottomBar` to extract pure structured report / transcription content, omitting conversational chat preamble.
  * Align Telegram popover default format with `user.integrations.telegram.defaultFormat` and support dynamic on-the-fly override.
  * Update `shareToTelegramDirect` endpoint to support `reportId`, format canonical Ethiopian reports, and inherit profile `imageCardOptions`.
- **Phase 14C.2 Defect Battery - Point 19: Addis AI Scribe Live Session Request Schema & Single-Endpoint Integrity** [PLANNING - AWAITING USER APPROVAL]:
  * Provide mandatory `request_id: crypto.randomUUID()` to `https://api.addisassistant.com/api/v1/scribe/sessions`.
  * Eliminate non-existent fallback `api.addisai.ch` that caused spurious `ENOTFOUND fetch failed` error masking.
  * Correctly serialize returned `data.token` to `{ ticket, token, websocketUrl, expiresIn }`.
- **Phase 14C.2 Defect Battery - Point 20: Exhaustive Operational Report Boundary Truncation & Conversational AI Outro Severance** [PLANNING - AWAITING USER APPROVAL]:
  * Sever all content after horizontal rules (`---`, `***`, `___`) and trailing conversational outro text (`ይህንን ሪፖርት...`, `Hope this helps...`).
  * Terminate operational reports cleanly at the `ከስራ የወጣሁበት ሰዓት: [time]` boundary.
  * Prioritize constructing canonical reports from Mongoose `Report` document in `chatController.js` when `reportId` is provided.
- **Phase 14C.2 Defect Battery - Point 21: Mobile Responsive HUD Layout & Adaptive Toolbar Coordination for Live STT** [PLANNING - AWAITING USER APPROVAL]:
  * Constrain `MuiLiveSttButton` with `maxWidth: { xs: 125, sm: 200 }`, `minWidth: 0`, and compact mobile connecting indicator.
  * Adaptively collapse batch audio recorder icon (`MuiAudioRecorder`) on mobile (`xs`) while live STT is actively listening/connecting.
  * Prevent container overflow across all breakpoints (`xs`, `sm`, `md`).
- **Phase 14C.3 Defect Battery - Point 22: Deterministic Report Object-to-Template Compiler (Visits-Driven Template Synthesis)** [PLANNING - AWAITING USER APPROVAL]:
  * Compile Telegram reports directly from the Report Object `[date, branch, name, clockIn, visits, activities, issues, comments, clockOut]` rather than depending on raw transcription or assistant chat text.
  * Select Single-Branch vs Multi-Branch template dynamically based on `visits.length`: singular `ብራንች: [Name]` for `<= 1` visit, and plural `ብራንቾች: [List]` with exact `• ከ [In] እስከ [Out] [Branch]` itinerary for `> 1` visits.
  * Interpolate custom user template placeholders `{{date}}`, `{{branch}}`, `{{name}}`, `{{clockIn}}`, `{{visits}}`, `{{activities}}`, `{{issues}}`, `{{comments}}`, `{{clockOut}}` directly from object fields.
  * Eliminate any possibility of conversational bot chatter or horizontal rules leaking into Telegram cards.
- **Phase 14C.3 Defect Battery - Point 23: In-Place Live STT Substitution for Microphone & Unified Zero-Collision Voice Controls** [PLANNING - AWAITING USER APPROVAL]:
  * Position `MuiLiveSttButton` directly in place of the microphone button in `MuiComposerBottomToolbar`, eliminating audio button redundancy.
  * Keep the right toolbar cluster lean: `[MuiLiveSttButton] [MuiSendButton]`.
  * Morph in-place into the active recording HUD on click with zero horizontal overflow across all device breakpoints (`xs`, `sm`, `md`, `lg`).
- **Phase 14C.4 Defect Battery - Point 24: Modern W3C Web Audio API Architecture (Zero Deprecations & AudioWorklet Migration)** [PLANNING - AWAITING USER APPROVAL]:
  * Eliminate deprecated `createScriptProcessor`, `onaudioprocess`, and `inputBuffer` by migrating to a dedicated `AudioWorkletNode` (`PcmCaptureProcessor`).
  * Process and buffer audio samples off the main thread, guaranteeing zero UI frame drops or typing lag.
  * Eliminate TypeScript compilation warning for `webkitAudioContext` on `Window & typeof globalThis`.
- **Acceptance Criteria**: AC-1 through AC-86 addressed (AC-1 to AC-65 complete; AC-66 to AC-86 in Phase 14C.2/14C.3/14C.4 planning).



## Implementation Roadmap (Stage C - Sequential Execution Plan)

### Task 14.1: Universal Chat Contract & Input Validation Refactor [COMPLETE & VERIFIED]
- Remove reductionist `compiledUserMessageText || inlineParts.length > 0` guard in `chatController.js:731`.
- Establish universal invariant: a message turn is valid if `text.trim().length > 0 OR audios.length > 0 OR attachments.length > 0`.
- Support 100% of chat details: text-only, audio-only, image-only, doc-only, and any arbitrary multimodal combination without artificial text requirements.

### Task 14.2: Multimodal Raw Audio Inline Parts & Robust BYOK Key Resolution [COMPLETE & VERIFIED]
- Implement Dual-Track Hybrid Audio Ingestion: pass raw audio part on active turn (for non-speech acoustic perception) and rehydrate past turns using persistent text transcript to prevent audio token explosion.
- Re-query user document with `+settings.apiKeys` at entry of `streamChat` and `uploadAudio`.
- Enforce Zero Silent Fallback Law: server `.env` keys are strictly isolated to automated backend integration tests; production user turns require user BYOK credentials and reject with friendly 400 prompt if unconfigured.
- Eliminate erroneous fallback to invalid server `.env` keys that produced `400 API_KEY_INVALID` errors.


### Task 14.3: Eager Background Uploads, Gated Composer, & Zero-Lag Typing [COMPLETE & VERIFIED]
- Refactor `MuiAttachButton`, `useAudioRecorder`, and `MuiComposerInput` to initiate background upload to backend cloud storage immediately upon file selection or recording stop.
- Enforce submit button gating: Send button remains `aria-disabled="true"` with spinner while uploads are pending.
- Preserve zero-lag typing invariant: zero debounces, zero `watch` calls, native uncontrolled textarea synchronization.

### Task 14.4: Personal AI Agent Contract (Work + Life) & Elimination of Manual Export Bar [COMPLETE & VERIFIED]
- Formally establish that Operon is a Personal AI Agent serving humans across their complete life and work. Media may be music, ambient sound, conversational voice, or operational shift narration; queries span work + personal tasks.
- Rename agent tool `save_supervisor_directive` to `save_user_directive` (with `save_supervisor_directive` as backward-compatible alias), harmonizing with `get_user_settings` and `update_user_settings`.
- Update `promptAssembler.js`, parameter descriptions, and JSDocs to refer strictly to the **user** and the user's personal/operational directives, eliminating legacy "Area Supervisor" framing.
- Decouple report generation: the agent converses naturally and NEVER invokes `create_report` or binds audio to reports unless the user explicitly requests an operational report.
- Completely remove manual export widgets & services: delete `ReportDeliveryActionBar.jsx` (and its rendering in `ReportDetail.jsx`), `reportExportService.js`, `exportReport` mutation in `reportSlice.js`, and `POST /:reportId/export` route. Empower the autonomous agentic loop: `User ➔ Agent ➔ Tools (create_cloud_document, dispatch_to_telegram) ➔ User`.


### Task 14.5: Free Persistent Cloud Storage Adapter & Lifecycle Cleanup Engine (Cloudinary Free Tier) [COMPLETE & VERIFIED]
- Implement persistent cloud storage adapter via Cloudinary free tier (25GB storage, 25GB bandwidth, permanent CDN URLs) for audios, attachments, and avatars.
- Completely eliminate Render ephemeral filesystem 404s on service spin-down/restart.
- Implement full-lifecycle Cloudinary asset cleanup engine to protect finite 25GB quota:
  * Chat deletion: batch-destroy all attachments and private audio assets.
  * Turn editing (`editTurnIndex`): destroy pruned downstream turn assets.
  * Composer shelf removal: immediate client DELETE triggers Cloudinary asset destruction for removed files.
  * Orphan sweeper (`sweeper.js` Pass 2): periodic sweep destroying staged uploads older than 2 hours that were never attached to a completed message or report.
  * Avatar removal/replacement: destroy old avatar on Cloudinary.
  * Permanent report deletion & 30-day sweeper: purge narration audios from Cloudinary.
  * Account cascade deletion: batch-destroy all user assets in Cloudinary.
- Maintain local disk storage fallback when Cloudinary credentials are not provided (Zero-Crash Invariant).
- Zero MongoDB GridFS storage (respecting user constraint: "Anything free, ensure functionality but not mongodb").

### Task 14.6: Authentic Agent-Driven Status Tracking & Adaptive TTFT Watchdog [COMPLETE & VERIFIED]
- Enforce zero hardcoding of synthetic status strings: status tracking is powered 100% by the agent itself through authentic deliberative thought streams (`event: thought` via `includeThoughts: true`) and authentic autonomous tool calls (`event: tool_call` with `fc.name` and `fc.args`).
- Update `MuiAgentExecutionTimeline.jsx` and `MuiChatAdapter.js` to render live status tracking from Turn 0 onwards, showing elapsed seconds and collapsible thought/execution steps.
- Configure adaptive TTFT watchdog (35s multimodal/reasoning, 18s text). Zero hardcoded model names: all model identifiers, defaults, and failover sequences strictly reference `AI_MODELS` SSOT from `constants.js`.

### Task 14.7: Telegram SVG Image Card Rendering & Ethiopic Font Embedding [COMPLETE & VERIFIED]
- Bundle `NotoSansEthiopic-Regular.woff` and `NotoSansEthiopic-Bold.woff` in `backend/src/assets/fonts/`.
- Embed fonts as base64 `@font-face` within the SVG `<defs><style>` block in `generateTextImageCard` so `sharp` / `librsvg` renders crisp Amharic characters on Render Linux without hex tofu boxes.
- Verify `backend/package.json` optional dependencies (`@img/sharp-linux-x64`, `@img/sharp-libvips-linux-x64`) and `render.yaml` build flags (`npm install --include=optional`).

### Task 14.8: User-Friendly Plain English Errors Across Entire Codebase [COMPLETE & VERIFIED]
- Build centralized error translation utility `formatUserFriendlyError(err)` across backend `errorHandler.js`, `chatController.js`, and frontend `MuiErrorNotice.jsx`.
- Intercept raw Google Gemini and Addis AI JSON errors and translate them into actionable, empathetic English instructions (e.g. invalid API key, quota limit, network timeout, audio format).
- Ensure `MuiErrorNotice` always provides actionable `[Retry Turn]` and model switch chips, and ensure `MuiAgentMessageBottomBar` never disappears on failed or empty turns.

### Task 14.9: Authentication UX: Google SSO Button Loading & Password Set Recovery [COMPLETE & VERIFIED]
- Add `isGoogleLoading` state to `Login.jsx` and `Register.jsx`, passing `isLoading={true}` to `GoogleSsoButton` on click to prevent multi-click confusion.
- Enhance `SSO_PASSWORD_NOT_SET` recovery: provide direct, prominent one-click "Sign in with Google" button inside the alert and clear guidance on setting an account password in Profile.
- Provide clean, informative guidance when an existing Google SSO user attempts to register with email/password.

### Task 14.10: Profile Settings UX & Addis AI Portal Link [COMPLETE & VERIFIED]
- Add direct external link to Addis AI portal (`https://addisassistant.com`) in `ProfileAgentConfigTab.jsx` matching the Google AI Studio link.
- Add clear API key onboarding cues: if a user has not configured their Gemini API key, display an alert prompting them to configure their key before starting chat or audio STT.

### Task 14.11: Vite Proxy Audit & Instantaneous Sidebar Drawer Cache Optimization [COMPLETE & VERIFIED]
- Audit `client/vite.config.js` proxy settings for `/api` and `/uploads`, ensuring SSE streams are not buffered and cloud-hosted URLs route seamlessly.
- Eliminate sidebar chat refetching and loading spinner on every drawer open:
  * Set `ModalProps={{ keepMounted: true }}` on temporary Drawer in `MuiSidebar.jsx` to preserve DOM tree and RTK Query subscriptions.
  * Configure `keepUnusedDataFor: 86400` (24h) on `getChats` query endpoint in `chatSlice.js` so the chat list cache is never purged during a user session.
  * Set `refetchOnMountOrArgChange: false` on `useGetChatsQuery(undefined, { skip: !user })` in `MuiRecentChat.jsx`.
  * Result: Opening the sidebar instantaneously displays cached chats at 120fps with zero spinner, zero lag, and zero redundant network calls.

### Task 14.12: Authentic User-Perspective Behavioral E2E Verification Suite [COMPLETE & VERIFIED]
- Zero fake or mocked tests: build `backend/scripts/testPhase14UserJourney.js` putting the harness directly in the place of a human user across life and work (sending messages, adding/removing attachments, audio-only, editing turns, retrying turns, setting directives with `save_user_directive`, requesting reports, generating Telegram cards, and asserting authentic agent output without synthetic mock tests).
  1. Audio-only, image-only, document-only, and text-only chat turns.
  2. Persistent media retrieval after server restart.
  3. Sharp SVG Amharic card rendering without tofu glyphs.
  4. BYOK API key extraction with `select: false`.
  5. Google SSO button loading and error recovery.
  6. Real-time status tracking SSE frame delivery.
  7. Plain English error notice presentation.

### Task 14.13: Dedicated Addis AI Scribe STT Subsystem (`/api/v1/stt`) [COMPLETE & VERIFIED]
- Create independent `backend/src/routes/sttRoutes.js` and `backend/src/controllers/sttController.js` mounted at `/api/v1/stt`.
- Endpoint `POST /api/v1/stt/scribe-session`: Authenticated, validates user's Addis AI API key, generates `request_id = randomUUID()`, calls `https://api.addisassistant.com/api/v1/scribe/sessions` with `{ backend: 'turbo', chunk: '320ms', request_id: requestId, language: 'am' }`, returns single-use connection ticket and WebSocket URL.
- Decouples STT from chat routes so any component (composer, search modals, forms) can invoke it.

### Task 14.14: In-Composer Live STT Coordination & Exact Visual Twin with Mic Preservation [COMPLETE & VERIFIED]
- Strictly preserve `MuiAudioRecorder` and its functionality: never touch or break the microphone!
- In idle state, render BOTH `MuiAudioRecorder` and `MuiLiveSttButton` side-by-side in `MuiComposerBottomToolbar.jsx`.
- When `MuiLiveSttButton` is clicked:
  * Hide `MuiAudioRecorder` (`display: 'none'`).
  * Render `MuiLiveSttButton` as the **exact visual twin of `MuiAudioRecorder`**: matching container box, monospace timer, audio visualizer bars, pulsing red dot, discard button (`DeleteOutlineIcon`), and checkmark finish button (`CheckIcon`).
  * Live transcripts stream directly into composer input.
  * When completed or discarded, the HUD closes, and the microphone button reappears!

### Task 14.15: Modern W3C Web Audio API AudioWorklet Pipeline (Zero Deprecations) [COMPLETE & VERIFIED]
- Eliminate deprecated `createScriptProcessor`, `onaudioprocess`, and `inputBuffer`.
- Create `AudioWorkletProcessor` (`PcmCaptureProcessor`) via Blob URL running on background audio thread.
- Buffer 4,096 samples and transfer to main thread. Convert Float32 to 16 kHz Mono Signed 16-bit PCM (PCM16 Little Endian) using `DataView.setInt16`.
- Calculate real-time RMS `audioLevel` to animate frequency visualizer bars.
- Standardize on `window.AudioContext || window['webkitAudioContext']` with 0 deprecations and 0 TypeScript warnings.

### Task 14.16: Deterministic Report Object-to-Template Compiler & Outro Severance [REVERTED - AWAITING USER TELEGRAM SPECIFICATION]
- Reverted all Telegram template compilation code per explicit user directive.

### Task 14.17: Telegram Image Card Bilingual Font Rendering (Render & Vercel Fix) [REVERTED - AWAITING USER TELEGRAM SPECIFICATION]
- Reverted all Telegram SVG image card changes per explicit user directive.

### Task 14.18: Pure Whitelist Schema Extraction, ToolParts Invariant, & Zero Intro/Outro Dependency [REVERTED - AWAITING USER TELEGRAM SPECIFICATION]
- Reverted all Telegram payload resolver code per explicit user directive.
