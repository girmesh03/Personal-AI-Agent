# Task Plan: Phase 14 Exhaustive Multimodal Chat, Attachment Lifecycle, and Agent Reliability Audit

## Goal
Conduct an exhaustive, evidence-based audit of chat multimodal attachment handling, storage persistence, real-time status tracking, API credentials, Telegram broadcast rendering, authentication flows, error messaging, and agent reliability, develop a fully aligned implementation plan, and systematically implement the approved solution across the entire application.

## Stages & Status
- **Stage A: Audit, research, validation, and initial plan** -> `complete`
- **Stage B: Incorporate user feedback & produce final aligned implementation plan** -> `complete`
- **Phase 14B: Temporary Issue Rectification & Review Protocol** -> `active` (Governing all rectification work)
- **Active Working Branch**: `phase-14-overall-application-audit` (strictly isolated from `main`; 0 commits, 0 merges on `main`)
- **Stage C: Implementation of approved plan under established protocols** -> `paused` (Implementation freeze active pending Phase 14B protocol approvals)

## Active Session Mandate & Branch Isolation Invariants
- **Branch Confinement**: All work is strictly confined to `phase-14-overall-application-audit`. The `main` branch is strictly untouched.
- **Zero Commits Law**: NEVER commit any code unless explicitly requested by the user.
- **Zero Merge Law**: NEVER merge any branch unless explicitly requested by the user.
- **Protocol Fidelity**: Every user issue/point must undergo First Principles reasoning, surgical appending to the master planning artifact, and user approval gate before implementation.

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

### Task 14.16: Decoupled Reusable Telegram Report Sharing Subsystem [COMPLETE & VERIFIED]
- Goal: Provide a decoupled, reusable Telegram sharing capability for operational inspection reports directly from Report Cards and DataGrid rows.
- Single Source of Truth (SSOT): Uses finalized `report.transcription` on the saved MongoDB Report document rather than extracting from chat streaming tokens or agent turn messages.
- Dedicated Endpoint: `POST /api/v1/reports/:reportId/share/telegram` in `reportRoutes.js` and `reportController.js`.
- Reusable UI Component: `MuiReportTelegramShareButton.jsx` supporting Text (HTML) vs Image Card format toggle, channel selection (Management, Maintenance, General), and error/success toast feedback.
- Seamless Integration: Embedded in `ReportCard.jsx` (CardActions) and `reportColumns.jsx` (DataGrid actions column).
- Zero Chat Contention: Leaves chat routes, agent message share action, and Live STT 100% untouched.

### Task 14.17: Cross-Platform Self-Healing FFmpeg & FFprobe Binary Resolution (Render Linux & Local Windows Fix) [COMPLETE & VERIFIED]
- Root Cause: `backend/src/config/env.js` hardcoded `'C:/ffmpeg/ffmpeg'` as fallback when `FFMPEG_PATH` is unset. On Render (Linux), `audioChunker.js` logical OR chain evaluated `'C:/ffmpeg/ffmpeg'` as truthy, bypassing `@ffmpeg-installer/ffmpeg` and attempting to spawn a phantom Windows path, failing with `ENOENT` on audio slicing and breaking Addis AI merged chunk transcription.
- Clean Environment Fallback: Remove Windows path defaults in `env.js`, defaulting unset env vars to empty string `''`.
- Dynamic Filesystem Verification: In `audioChunker.js`, implement `resolveBinaryPath(binaryName, configuredPath, installerPath)` that verifies `fs.existsSync()` before trusting any path. If configured path is non-existent, it automatically falls back to the bundled `@ffmpeg-installer` platform static binary, verifies `0755` executable permissions on Linux, and falls back to system PATH binary.
- Verification: Created dedicated test `testFfmpegResolution.js` asserting probe and slice execution (9/9 passed). Committed in `b26391f`.

### Task 14.18: 100% Guaranteed Bulletproof Viewport Height Across All Mobile Devices [COMPLETE & VERIFIED]
- Root Cause: On Phone B (custom OEM browsers like Samsung Internet/Xiaomi or in-app WebViews), `100dvh` either defaults to `100lvh` because `body` has `overflow: hidden` (preventing document scroll), or fails to update when the software keyboard opens. Furthermore, `AppTheme.jsx` pinned `html`, `body`, and `#root` to `height: 100%` (ICB `100lvh`), creating an architectural contradiction with child `AppShell` (`100dvh`), resulting in bottom element clipping.
- Tier 1 (Zero-FOUC First Paint): Inline `<script>` in `client/index.html` calculating `window.visualViewport.height || window.innerHeight` and assigning `--app-height` before first paint.
- Tier 2 (Continuous Reactive Lifecycle): `useViewportHeight.js` hook listening to `visualViewport.resize`, `visualViewport.scroll`, and `window.orientationchange`, updating `--app-height` and tracking virtual keyboard expansion without lag.
- Tier 3 (Cascading CSS Root & Shell Alignment): Standardized `AppTheme.jsx` (`html`, `body`, `#root`), `AppShell.jsx`, and `PublicLayout.jsx` on `height: var(--app-height, 100dvh)` with `position: fixed; inset: 0` on `html, body` to eliminate iOS rubber-banding and guarantee 0px clipping across 100% of mobile devices.
- Verification: Headless and static analysis asserting `--app-height` binding, `AppTheme.jsx` styling (`testViewportHeight.js` 6/6 passed, 0 lint errors, Vite build exit code 0). Committed in `b26391f`.

### Task 14.19: Dual-Calendar Uniqueness (GC + Ethiopian), Controlled Tool Rejection & Principle of Sufficient Reason [COMPLETE & VERIFIED]
- User Direction: Enforce uniqueness per day in both Gregorian Calendar (GC) and Ethiopian Calendar so that if the agent attempts to create a duplicate report, it fails deterministically at the database level. Upon failure, the tool provides the existing report's ID and summary, enabling the agent to either invoke `update_report` if the user's intent was to add/update, or ask the user how to proceed.
- Pillar 1 (Database Dual-Calendar Uniqueness): In `Report.js`, store `dateString` (GC: YYYY-MM-DD) and `ethiopianDate` (Eth: DD-MM-YY) as stored, indexed fields. Enforce MongoDB partial unique compound indexes on `{ user: 1, dateString: 1 }` and `{ user: 1, ethiopianDate: 1 }` (`isArchived: false`).
- Pillar 2 (Controlled Tool Rejection with Guidance): In `create_report` (`agentTools.js`) and `createReportRecord` (`reportController.js`), if an active report exists for that day in either calendar, reject creation with `REPORT_ALREADY_EXISTS`. Return the existing `reportId`, visit summary, and structured guidance so the agent can update or communicate with the supervisor without guessing.
- Pillar 3 (Flexible Date Resolution in `update_report`): Allow `update_report` to resolve the target report by `date` (or default to current system date) if `reportId` is omitted.
- Pillar 4 (Active Grounding & Sufficient Reason in `promptAssembler.js`): Query today's report during assembly and inject `<today_report id="...">` into Block 5 with explicit instructions to use `update_report`. Enforce the Principle of Sufficient Reason across ALL agent operations.
- Verification: Created dedicated test `testPhase14CSingleReportPerDay.js` asserting dual-calendar uniqueness rejection, update fallback, and active prompt injection (7/7 tests passed).

### Task 14.20: Chat Scroll-to-Bottom Affordance Solid Paper Background & Elevated FAB Styling [COMPLETE & VERIFIED]
- Root Cause: In `inputs.js` (lines 270 & 281), `MuiIconButton` styleOverrides specifies `backgroundColor: alpha(gray[50], 0.3)` in light and `alpha(gray[800], 0.3)` in dark mode. Because `@mui/x-chat`'s `ChatScrollToBottomAffordance` is styled as `styled(IconButton)`, it inherited the 30% alpha (semi-transparent) background, appearing see-through and washed out on top of chat messages.
- Rectification:
  * In `AppTheme.jsx`: Added `MuiChatScrollToBottomAffordance` style overrides setting solid `background.paper !important`, circular `borderRadius: '50% !important'`, `border: '1px solid divider !important'`, elevation shadow `theme.shadows[3]`, and hover shadow `theme.shadows[6]`.
  * In `Chat.jsx` (`CHATBOX_SX`): Added `& .MuiChatScrollToBottomAffordance-root, & [class*="MuiChatScrollToBottomAffordance"]` with solid `background.paper !important`, `borderRadius: '50% !important'`, `border: '1px solid divider !important'`, and `boxShadow: 3`.
- Verification: Component inspection, client build (`npm --prefix client run build`: code 0), and lint (`npm --prefix client run lint`: 0 errors, 0 warnings).

### Task 14.21: Multi-Device PWA WebAPK Standalone Installation Engine & 100dvh Viewport Parity [COMPLETE & VERIFIED]
- Root Cause: Missing W3C Web App Manifest (`manifest.json`), `<link rel="manifest">`, mobile capability meta tags, and high-res PNG icons prevented Chrome on Android (specifically Samsung One UI on Galaxy M14) from minting a native WebAPK. Instead, Chrome opened the app in a Chrome Custom Tab (CCT) with an unwanted 56px white header bar ("Operon personal-ai-agent-sigma.vercel.app ⋮"), shrinking the available vertical area and causing the bottom of the viewport to be clipped.
- Pillar 1 (W3C Web App Manifest & WebAPK Engine):
  * Created `client/public/manifest.json` configured with `display: "standalone"`, `start_url: "/"`, `theme_color: "#090d16"`, `background_color: "#090d16"`.
  * Generated multi-resolution PWA icons (`pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`, `apple-touch-icon.png`) from `favicon.svg`.
  * Created and registered lightweight PWA Service Worker (`client/public/sw.js`) in `client/src/main.jsx`.
  * Added PWA tags (`<link rel="manifest">`, `<meta name="theme-color">`, `<meta name="mobile-web-app-capable">`, `viewport-fit=cover`) to `client/index.html`.
- Pillar 2 (Clean 100dvh Viewport Alignment):
  * Reverted `position: fixed; inset: 0` on `html` and `body` in `client/src/theme/AppTheme.jsx`.
  * Realigned `client/src/layouts/AppShell.jsx` and `client/src/layouts/PublicLayout.jsx` with clean `height: '100dvh'` and `@supports not (height: 100dvh): { height: '100vh' }`.
  * Removed unused `useViewportHeight` hook and premature `<head>` height-lock script.
- Verification: Headless automated suite `testViewportHeight.js` (7/7 passed), client ESLint (0 errors, 0 warnings), and client Vite production build (code 0). Physical device verification by user on Samsung Galaxy M14 and primary phone: 100% verified and confirmed working.

### Task 14.22: Overall Application Issue Intake & Audit Workspace Initialization [ACTIVE]
- Purpose: Establish dedicated, isolated branch `phase-14-overall-application-audit` to address all incoming user-observed issues, questions, and points across the entire application.
- Operational Invariants:
  1. All work strictly on branch `phase-14-overall-application-audit`; never touch `main`.
  2. Zero Commits Law: Never commit unless explicitly instructed by the user.
  3. Zero Merges Law: Never merge unless explicitly instructed by the user.
  4. Protocol Fidelity: Each issue is analyzed via First Principles, appended to the master planning artifact, and approved by the user before code changes.
- Status: Branch checked out, planning records synchronized, awaiting user issues.

### Task 14.23: Four-Layer Chat Growth Architecture, Pagination Centralization & Decoupled Context Integrity [COMPLETE & VERIFIED]
- Goal: Rigorously decouple and optimize the 4 chat growth layers (LLM context assembly, MongoDB storage, API reverse pagination, and @mui/x-chat frontend rendering) without breaking existing chat operations.
- Key Actions Implemented & Verified:
  1. Centralized pagination governance: Bound `chatValidation.js`, `chatController.js`, `chatSlice.js`, `Chat.jsx`, and `MuiChatAdapter.js` to single source of truth in `constants.js` (enabling 1-line changes between 30 and 5 messages for testing).
  2. Protected Decoupled Context Invariant: Verified and guaranteed that client UI pagination limits never constrain backend model streaming context (`buildGeminiHistory` accesses full conversation transcript).
  3. Optimized historical attachment rehydration in `compileUserTurnParts` via cached `documentTextContext` short-circuit.
  4. Added deduplication guard in `MuiChatAdapter.listMessages` ensuring zero duplicate keys during reverse pagination merges.
  5. Built and executed comprehensive verification suite `backend/scripts/testPhase14DChatPaginationAndGrowth.js` (7/7 tests passed 100%).
- Verification: Regression test suites `testPhase14CSingleReportPerDay.js` (7/7 passed), `testViewportHeight.js` (7/7 passed), client ESLint (0 errors, 0 warnings), and Vite production build (Code 0).
- Microphone Invariant: `MuiAudioRecorder.jsx` 100% untouched.

### Task 14.24: Reverse Cursor Pagination Fix (`before` Param Forwarding) & Sidebar Infinite Scroll Engine [COMPLETE & VERIFIED]
- User Observation: With `MESSAGES_PAGE_SIZE: 5`, initial 5 messages load cleanly, but upward scroll does not load earlier messages. In the sidebar, scrolling down does not load older chats.
- Root Cause 1 (Chat Canvas): `chatSlice.js:221-226` in `getChatById` defined `params: { limit }`, dropping `before`. The server received `before === undefined`, returned newest 5 turns, and deduplication filtered them out. Furthermore, on tall mobile viewports, small batches don't overflow the viewport (`scrollHeight <= clientHeight`), preventing `@mui/x-chat` scroll triggers.
- Root Cause 2 (Sidebar Recent Chats): `MuiRecentChat.jsx:63` called `useGetChatsQuery(undefined)` once with zero scroll detection, zero page tracking, and zero mechanism to fetch Page 2.
- Key Actions Implemented & Verified:
  1. Forwarded `before` in `client/src/redux/features/chatSlice.js` (`getChatById: params: { limit, before }`).
  2. Created `client/src/components/chat/MuiChatMessageListContent.jsx` providing an accessible `[ ↑ Load earlier messages ]` affordance with loading spinner whenever `hasMoreHistory` is true, ensuring users can paginate even when initial batches do not overflow the screen.
  3. Upgraded `getChats` in `chatSlice.js` with `serializeQueryArgs` (isolated by query search/archived/pinned) and `merge` appending pages with `_id` deduplication.
  4. Implemented reactive infinite scroll and bottom `[ Load older conversations ]` affordance in `client/src/components/chat/MuiRecentChat.jsx`.
  5. Strictly eliminated all hardcoded numbers: bound all parameters across backend and frontend to centralized `CHAT_PAGINATION` in `constants.js`.
- Verification:
  - `backend/scripts/testPhase14DChatPaginationAndGrowth.js`: **10 / 10 PASSED (100%)**.
  - `backend/scripts/testPhase14CSingleReportPerDay.js`: **7 / 7 PASSED (100%)**.
  - `client/scripts/testViewportHeight.js`: **7 / 7 PASSED (100%)**.
  - `npm --prefix client run lint`: **0 errors, 0 warnings (Exit code 0)**.
  - `npm --prefix client run build`: **Vite production build succeeded in 20.66s (Exit code 0)**.
  - Microphone Invariant: `MuiAudioRecorder.jsx` 100% untouched.
  - Branch Confinement: Isolated on `phase-14-overall-application-audit`; 0 commits, 0 merges on `main`.

### Task 14.25: Full-Lifecycle User Avatar Pipeline, Cloudinary & Disk Storage Engine, and Universal UI Propagation [COMPLETE & VERIFIED]
- User Observation: Changing the user avatar from the profile page does not reflect everywhere. In addition, Cloudinary and `backend/uploads/` dual-tier storage must be handled cleanly.
- Root Cause 1 (UI Propagation Void): `AvatarMenu.jsx` and `MuiSidebar.jsx` (mini & expanded) instantiate `<Avatar sx={{ ... }}>{initials}</Avatar>` with ZERO `src` prop, completely ignoring `user.avatar`.
- Root Cause 2 (Backend Storage Bypass): `userController.js:146` directly assigned `user.avatar = avatar;` saving the raw Base64 string directly into MongoDB without writing to `backend/uploads/avatars/` or uploading to Cloudinary, bloating MongoDB user documents.
- Root Cause 3 (Cleanup Remnants): `cleanupAvatarAsset` previously tried to unlink raw Base64 data strings instead of valid file paths or Cloudinary publicIds.
- Key Actions Implemented & Verified:
  1. Backend Storage Dual-Tier Parity (`userController.js`):
     - Intercepts incoming Base64 data URLs in `updateAvatar`.
     - Decodes binary Buffer and writes physical file to `backend/uploads/avatars/avatar-${userId}-${timestamp}.${ext}`.
     - Uploads buffer/file to Cloudinary under folder `personal-agent/avatars` using `storageService.uploadFile`.
     - Sets `user.avatar` to permanent Cloudinary CDN `secure_url` and `avatarPublicId` if Cloudinary is configured; falls back to `/uploads/avatars/${fileName}` if local/offline.
     - Purges previous avatar physical assets via `storageService.cleanupAvatarAsset` on both update and delete (`removeAvatar`), preventing orphaned files on disk and on Cloudinary.
     - Zero Base64 strings saved to MongoDB (`user.avatar.length < 255`), eliminating database bloat.
  2. Centralized Avatar URL Resolver (`client/src/utils/avatarUtils.js`):
     - Created `getAvatarUrl` normalizing Cloudinary URLs (`https://`), relative static paths (`/uploads/avatars/...` prepended with `serverOrigin`), Base64 strings (`data:...` for backwards compatibility), and blob URLs (`blob:...`).
  3. Universal Frontend UI Propagation:
     - `client/src/layouts/AvatarMenu.jsx`: Wired `src={getAvatarUrl(user?.avatar) || undefined}` and `alt={user?.fullName || 'User menu'}` with fallback initials.
     - `client/src/layouts/MuiSidebar.jsx`: Wired `src={getAvatarUrl(user?.avatar) || undefined}` and `alt={displayName}` to both mini rail and expanded drawer avatars.
     - `client/src/components/profile/ProfileHeaderHero.jsx`: Wired `src={getAvatarUrl(user?.avatar) || undefined}`.
     - `client/src/components/reports/ReportHero.jsx`: Wired `src={getAvatarUrl(authorAvatar) || undefined}` for author profile avatar.
- Verification:
  - `backend/scripts/testPhase14EUserAvatarPipeline.js`: **17 / 17 PASSED (100%)**.
  - `backend/scripts/testPhase14DChatPaginationAndGrowth.js`: **10 / 10 PASSED (100%)**.
  - `npm --prefix client run lint`: **0 errors, 0 warnings (Exit code 0)**.
  - `npm --prefix client run build`: **Vite production build succeeded in 51.09s (Exit code 0)**.
  - Microphone Invariant: `client/src/components/chat/MuiAudioRecorder.jsx` 100% untouched.
  - Branch Confinement: Isolated on `phase-14-overall-application-audit`; 0 commits, 0 merges on `main`.

### Task 14.26: Executive Dashboard UI Structuring, Multi-Breakpoint Responsiveness (xs, sm, md, lg, xl) & Component Repurposing [COMPLETE & VERIFIED]
- **Core Directive**: Page-by-page UI structuring and responsiveness overhaul across `xs`, `sm`, `md`, `lg`, and `xl` breakpoints, repurposing existing components as features where required, while strictly preserving 100% of existing functionality. Starting with the Dashboard.
- **Forensic Diagnosis of Mobile Screenshot Defects & Rectifications**:
  1. *KPI Deck 100% Mobile Stack & 2x2 Matrix*: Restored fullwidth on `xs` (`size={{ xs: 12, sm: 6, md: 6, lg: 3, xl: 3 }}`). Removed `noWrap` on `MuiStatCard.jsx` title and subtitle, allowing clean natural typography without any ellipsis truncation.
  2. *Quick Action Full Labels*: Restored clear full text labels `Start Inspection` and `Add Branch` in `DashboardQuickActions.jsx` across all breakpoints.
  3. *Chart Empty Void Eradication & Full Axis Labels*: Set Paper `height: { xs: 'auto', md: '100%' }`, Box `height: chartHeight`, removing `flexGrow: 1` and `minHeight` stretch. In `DashboardBranchVisitChart`, set `tickLabelInterval: () => true` and `angle: -28`, `bottom: 48` so all branch codes fit without collision and without being skipped.
  4. *Mobile Telegram Action Deck Harmonization*: Styled `MuiReportTelegramShareButton` with `border: 1, borderColor: 'divider', borderRadius: '8px', height: 36, width: 36, color: '#2AABEE'` and matching `height: 36` on View Dossier button.
  5. *Zero 404 Route Invariant*: Synchronized mobile link in `DashboardRecentAuditsLedger.jsx` to `/reports/${report._id}/details` matching desktop and `router.jsx` SSOT.
  6. *In-Place Branch Creation Feature*: Mounted existing `MuiBranchDialog` directly on Dashboard, triggered by QuickActions "Add Branch", auto-refetching `useGetDashboardMetricsQuery` on save.
  7. *Executive Telegram Dossier Dispatch*: Embedded `MuiReportTelegramShareButton` into both the desktop table rows and mobile card deck.
  8. *Breakpoint md Architecture Realignment (Sidebar Math & Text Collision)*: Accounted for 240px permanent sidebar. Configured KPI deck as 2x2 grid (`md: 6`) preventing text-icon collision, stacked charts 12-col (`md: 12`) preventing branch label clipping, and scaled table `minWidth: { sm: 600, md: 630, lg: 750 }` preventing off-screen action clipping.
- **Verification Outcomes**:
  - `backend/scripts/testPhase14FDashboardUI.js`: **14 / 14 PASSED (100% green)**.
  - `backend/scripts/testPhase14EUserAvatarPipeline.js`: **17 / 17 PASSED (100% green)**.
  - `backend/scripts/testPhase14DChatPaginationAndGrowth.js`: **10 / 10 PASSED (100% green)**.
  - `npm --prefix client run lint`: **0 errors, 0 warnings (Exit code 0)**.
  - `npm --prefix client run build`: **Built cleanly in 11.83s (Exit code 0)**.
  - Microphone Invariant: `client/src/components/chat/MuiAudioRecorder.jsx` 100% untouched.
  - Verified on mobile and md via user screenshots (`media_1793409620782_0a816a85.png` and `media_1793409675748_7a0fc683.png`).

### Task 14.27: Master Operational Reports Archive UI Structuring, Multi-Breakpoint Architecture (xs, sm, md, lg, xl) & Component Repurposing [PLANNING / PENDING USER APPROVAL]
- **Core Directive**: Single-page flow continuation: apply structural optimization, full responsiveness for `xs`, `sm`, `md`, `lg`, and `xl` breakpoints, and component repurposing to the Operational Reports Archive (`client/src/pages/Reports.jsx`), preserving 100% of existing functionality.
- **Forensic Diagnosis of Reports Defects**:
  1. *Breakpoint md Sidebar Canvas Squeeze in Control Strip*:
     In `MuiDataGridToolbar.jsx:98`, `flexWrap: { xs: 'wrap', md: 'nowrap' }` forces search input (minWidth 240), branch selector (190), date picker (180), and view switcher (75) into a single row on `md`. But with a 240px permanent sidebar on `md` (900px–1199px), the available canvas is only 660px–959px! Squeezing 721px into 660px compresses the search input or overflows horizontally.
     *Resolution*: Set `flexWrap: { xs: 'wrap', sm: 'wrap', md: 'wrap', lg: 'nowrap' }`. On `sm` and `md`, render a clean 2-row layout (Row 1: 100% full-width search input; Row 2: 50/50 Branch Selector + Date Picker + View Switcher). Transition to single row on `lg+` (≥1200px).
  2. *Breakpoint md Card Grid Collision in `ReportCardGrid.jsx`*:
     Setting `size={{ xs: 12, sm: 6, md: 4 }}` forces 3 cards per row on `md`, allocating only ~198px per card. Fitting dates, chips, and 5 action buttons (`View Dossier`, `Telegram Share`, `Edit`, `Archive`, `Delete`) in 198px causes button collision and wrapping.
     *Resolution*: Configure `size={{ xs: 12, sm: 6, md: 6, lg: 4, xl: 3 }}` providing ~330px per card on `md`.
  3. *In-Place Branch Creation Feature Repurposing*:
     Mount existing `MuiBranchDialog` in `Reports.jsx` to allow supervisors to add missing branches in-place while reviewing reports, updating the branch selector on save.
  4. *Telegram Share Button Styling Parity*:
     Harmonize `MuiReportTelegramShareButton` in `ReportCard.jsx` with the 36px rounded, tinted cyan design established on the Dashboard.
  5. *Fluid Proportional Canvas Scaling*:
     Update `Reports.jsx` to `maxWidth: { xs: '100%', xl: 1600 }` with progressive padding `p: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }`.
- **Strict Invariants**:
  - 100% functionality preserved: `useGetReportsQuery`, `useGetBranchesQuery`, pagination models, search filters, delete/archive/restore mutations with immediate confirmation dismissal.
  - Microphone Invariant: `client/src/components/chat/MuiAudioRecorder.jsx` remains 100% untouched.
  - Confinement strictly to branch `phase-14-overall-application-audit`.
  - Zero commits / zero merges without explicit user authorization.
  - Implementation freeze: NO application code edits until explicit user review and approval.









