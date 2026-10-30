/**
 * @module components/chat/MuiModelSelector
 * @description Ergonomic, accessible, zero-lag model selector & inference governance surface
 * for the chat composer (Row 3 Left Cluster).
 *
 * Core Architectural Invariants:
 * 1. Two-Tier Persistent Default Governance:
 *    - Tier 1 (Account Level): Dispatches PATCH /api/v1/users/agent-config saving defaultModel,
 *      defaultThinkingBudget, defaultLanguage, and sttEngine to MongoDB User.settings.
 *    - Tier 2 (Session Level): If in an active conversation (chatId), dispatches PATCH /api/v1/chat/:chatId/config.
 * 2. Zero Keystroke Lag:
 *    - Wrapped in React.memo with shallow prop checks.
 *    - Does NOT subscribe to useChatComposer() or composer.value.
 *    - Local popover anchorEl state prevents composer input re-renders.
 * 3. Flush Horizontal Docking Geometry (sm+):
 *    - On sm+, docks horizontally matching the exact width of the composer root (maxWidth: 760px).
 *    - No bottom border radius (borderRadius: '16px 16px 0 0'), sitting flush atop the composer sheet.
 *    - 100% invisible scrollbars on both Popover and SwipeableDrawer (scrollbarWidth: 'none', webkit display: 'none').
 *    - Horizontal multi-column layout for model cards, STT engines, and language controls.
 * 4. Boundary & Schema Safety:
 *    - Strictly bounds thinkingBudget to [0, 8192] tokens matching Mongoose schema.
 *    - Disabled during active SSE streaming (isStreaming) or voice recording.
 * 5. React 19 Parity:
 *    - Explicit displayName assigned, zero propTypes.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams } from 'react-router';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Popover from '@mui/material/Popover';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme, alpha } from '@mui/material/styles';
import BoltIcon from '@mui/icons-material/Bolt';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ScienceIcon from '@mui/icons-material/Science';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useDispatch, useSelector } from 'react-redux';
import { useChatStatus } from '@mui/x-chat-headless';
import { toast } from 'react-toastify';

import {
  selectActiveModel,
  selectThinkingBudget,
  selectLanguage,
  selectSttEngine,
  selectActiveChatId,
  setActiveModel,
  setThinkingBudget,
  setLanguage,
  setSttEngine,
  useUpdateChatConfigMutation,
} from '../../redux/features/chatSlice.js';
import { useUpdateAgentConfigMutation } from '../../redux/features/userSlice.js';
import { selectCurrentUser } from '../../redux/features/authSlice.js';
import { AI_MODELS, CHAT_CONSTANTS } from '../../utils/constants.js';

/**
 * Model registry metadata for display and capability descriptions.
 */
const MODEL_CARDS = [
  {
    id: AI_MODELS.DEFAULT, // 'gemini-3.1-flash-lite'
    name: 'Gemini 3.1 Flash Lite',
    shortName: 'Flash Lite',
    mobileShortName: 'Lite',
    badge: 'Default · Fast',
    description: 'Ultra-low latency for operational workflows, checklists, and real-time responses.',
    icon: BoltIcon,
    iconColor: 'warning.main',
  },
  {
    id: AI_MODELS.PRO, // 'gemini-3.8-flash'
    name: 'Gemini 3.8 Flash',
    shortName: 'Flash 3.8',
    mobileShortName: '3.8',
    badge: 'Pro · Deep Reasoning',
    description: 'High-capability model for complex multi-branch analytics, synthesis, and deep reporting.',
    icon: PsychologyIcon,
    iconColor: 'primary.main',
  },
  {
    id: AI_MODELS.FALLBACK, // 'gemini-3-flash-preview'
    name: 'Gemini 3 Flash Preview',
    shortName: 'Flash Preview',
    mobileShortName: 'Preview',
    badge: 'Alternative · Experimental',
    description: 'Experimental preview model with latest features and quota failover support.',
    icon: ScienceIcon,
    iconColor: 'secondary.main',
  },
];

/**
 * Speech-to-Text engine registry.
 */
const STT_OPTIONS = [
  { id: 'addis_ai', label: 'Addis AI', subtitle: 'Amharic Native' },
  { id: AI_MODELS.PRO, label: 'Gemini 3.8', subtitle: 'Multilingual' },
  { id: AI_MODELS.DEFAULT, label: 'Gemini Lite', subtitle: 'Fast' },
];

/**
 * Thinking budget preset chips.
 */
const BUDGET_PRESETS = [
  { label: 'Off', value: 0 },
  { label: '1K', value: 1024 },
  { label: '2K', value: 2048 },
  { label: '4K', value: 4096 },
  { label: '8K', value: 8192 },
];

/**
 * MuiModelSelector component.
 */
export const MuiModelSelector = React.memo(
  React.forwardRef(function MuiModelSelector(props, ref) {
    const { disabled = false } = props;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const dispatch = useDispatch();
    const { isStreaming } = useChatStatus();

    // Redux selectors
    const activeModel = useSelector(selectActiveModel);
    const thinkingBudget = useSelector(selectThinkingBudget);
    const language = useSelector(selectLanguage);
    const sttEngine = useSelector(selectSttEngine);
    const activeChatId = useSelector(selectActiveChatId);
    const currentUser = useSelector(selectCurrentUser);

    // Mutations for two-tier persistence
    const [updateAgentConfig] = useUpdateAgentConfigMutation();
    const [updateChatConfig] = useUpdateChatConfigMutation();
    const { chatId: routeChatId } = useParams();

    // Local UI states
    const [anchorEl, setAnchorEl] = useState(null);
    const [composerWidth, setComposerWidth] = useState(undefined);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [saveAsDefault, setSaveAsDefault] = useState(true);
    const [localThinkingBudget, setLocalThinkingBudget] = useState(thinkingBudget);

    // Keep local slider synced with Redux store when thinkingBudget changes externally
    useEffect(() => {
      setLocalThinkingBudget(thinkingBudget);
    }, [thinkingBudget]);

    // Active model metadata lookup
    const activeCard = useMemo(
      () => MODEL_CARDS.find((m) => m.id === activeModel) || MODEL_CARDS[0],
      [activeModel]
    );

    const ActiveIcon = activeCard.icon;
    const isOpen = Boolean(anchorEl) || isDrawerOpen;
    const isControlDisabled = Boolean(disabled || isStreaming);

    // Open/Close handlers: dock to Composer Root on sm+
    const handleOpen = useCallback(
      (e) => {
        if (isControlDisabled) return;
        if (isMobile) {
          setIsDrawerOpen(true);
        } else {
          // Locate the enclosing Composer Root container (Paper / form element)
          const target = e.currentTarget;
          const composerRoot =
            target.closest('form') ||
            target.closest('.MuiPaper-root') ||
            target.closest('[class*="composerRoot"]') ||
            target;

          if (composerRoot) {
            const rect = composerRoot.getBoundingClientRect();
            setComposerWidth(rect.width);
            setAnchorEl(composerRoot);
          } else {
            setAnchorEl(target);
          }
        }
      },
      [isControlDisabled, isMobile]
    );

    const handleClose = useCallback(() => {
      setAnchorEl(null);
      setIsDrawerOpen(false);

      // Return focus to composer textarea
      requestAnimationFrame(() => {
        const textarea = document.querySelector(
          'textarea[name="messageText"], textarea[name="chat-prompt-input"]'
        );
        if (textarea) {
          textarea.focus();
        }
      });
    }, []);

    // Dismiss popover on window resize to avoid detached floating anchors
    useEffect(() => {
      const handleResize = () => {
        if (anchorEl) {
          handleClose();
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [anchorEl, handleClose]);

    // Two-tier persistence dispatcher
    const handlePersist = useCallback(
      async ({ newModel, newBudget, newLang, newSttEngine }) => {
        const targetModel = newModel || activeModel;
        const targetBudget = newBudget !== undefined ? newBudget : thinkingBudget;
        const targetLang = newLang || language;
        const rawSttEngine = newSttEngine || sttEngine;
        const targetSttEngine = CHAT_CONSTANTS.STT_ENGINES.includes(rawSttEngine)
          ? rawSttEngine
          : CHAT_CONSTANTS.DEFAULT_STT_ENGINE;

        // 1. Synchronously update client Redux state
        if (newModel) dispatch(setActiveModel(newModel));
        if (newBudget !== undefined) dispatch(setThinkingBudget(newBudget));
        if (newLang) dispatch(setLanguage(newLang));
        if (newSttEngine) dispatch(setSttEngine(targetSttEngine));

        try {
          // 2. Tier 1: User Account Default persistence (if checked)
          if (saveAsDefault) {
            await updateAgentConfig({
              defaultModel: targetModel,
              defaultThinkingBudget: targetBudget,
              defaultLanguage: targetLang,
              sttEngine: targetSttEngine,
            }).unwrap();
          }

          // 3. Tier 2: Conversation Session persistence (strictly when in an active URL chat session)
          const targetSessionId = routeChatId || (activeChatId && activeChatId.length === 24 && activeChatId === routeChatId ? activeChatId : null);
          if (targetSessionId) {
            try {
              await updateChatConfig({
                chatId: targetSessionId,
                model: targetModel,
                thinkingBudget: targetBudget,
                language: targetLang,
              }).unwrap();
            } catch (chatCfgErr) {
              console.warn('[MuiModelSelector] Stale chat session config skipped:', chatCfgErr);
            }
          }
        } catch (err) {
          toast.error(
            err?.data?.message || err?.message || 'Failed to persist model configuration.'
          );
        }
      },
      [
        activeModel,
        thinkingBudget,
        language,
        sttEngine,
        dispatch,
        saveAsDefault,
        activeChatId,
        routeChatId,
        updateAgentConfig,
        updateChatConfig,
      ]
    );

    // Model selection
    const handleSelectModel = useCallback(
      (modelId) => {
        if (modelId === activeModel) return;
        void handlePersist({ newModel: modelId });
      },
      [activeModel, handlePersist]
    );

    // STT engine selection
    const handleSelectSttEngine = useCallback(
      (_e, newEngine) => {
        if (!newEngine || newEngine === sttEngine) return;
        void handlePersist({ newSttEngine: newEngine });
      },
      [sttEngine, handlePersist]
    );

    // Language selection
    const handleSelectLanguage = useCallback(
      (_e, newLang) => {
        if (!newLang || newLang === language) return;
        void handlePersist({ newLang: newLang });
      },
      [language, handlePersist]
    );

    // Thinking budget slider local change (fluid 60fps)
    const handleSliderChange = useCallback((_e, val) => {
      setLocalThinkingBudget(val);
    }, []);

    // Thinking budget slider committed (debounced network persist)
    const handleSliderCommit = useCallback(
      (_e, val) => {
        setLocalThinkingBudget(val);
        void handlePersist({ newBudget: val });
      },
      [handlePersist]
    );

    // Reset to baseline defaults
    const handleResetDefaults = useCallback(() => {
      const defaultModel =
        currentUser?.settings?.agentConfig?.defaultModel || AI_MODELS.DEFAULT;
      const defaultBudget =
        currentUser?.settings?.agentConfig?.defaultThinkingBudget ??
        CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET;
      const defaultLang =
        currentUser?.settings?.agentConfig?.defaultLanguage || CHAT_CONSTANTS.DEFAULT_LANGUAGE;
      const defaultStt =
        currentUser?.settings?.sttEngine || CHAT_CONSTANTS.DEFAULT_STT_ENGINE;

      setLocalThinkingBudget(defaultBudget);
      void handlePersist({
        newModel: defaultModel,
        newBudget: defaultBudget,
        newLang: defaultLang,
        newSttEngine: defaultStt,
      });
      toast.info('Restored configuration to account defaults.');
    }, [currentUser, handlePersist]);

    // Format thinking budget display label
    const budgetLabel = useMemo(() => {
      if (localThinkingBudget === 0) return '0 tokens (Off)';
      return `${localThinkingBudget.toLocaleString()} tokens`;
    }, [localThinkingBudget]);

    // Settings sheet inner content (docked horizontally on sm+)
    const settingsContent = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 0.75,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.875rem' }}>
              Model & Inference Governance
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              Configure AI reasoning models, voice transcription & language preferences
            </Typography>
          </Box>
          <Button
            size="small"
            variant="text"
            onClick={handleResetDefaults}
            startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            Reset
          </Button>
        </Box>

        {/* Section 1: Text-to-Text Model Selection (Horizontal 3-column row on sm+) */}
        <Box>
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', mb: 0.75, display: 'block' }}
          >
            Text Model (Reasoning & Tools)
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 1,
            }}
          >
            {MODEL_CARDS.map((card) => {
              const isSelected = card.id === activeModel;
              const CardIcon = card.icon;
              return (
                <Box
                  key={card.id}
                  onClick={() => handleSelectModel(card.id)}
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    bgcolor: isSelected ? 'action.selected' : 'background.paper',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 0.75,
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      borderColor: isSelected ? 'primary.main' : 'text.secondary',
                      bgcolor: isSelected ? 'action.selected' : 'action.hover',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <CardIcon sx={{ fontSize: 16, color: card.iconColor }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.8125rem' }}>
                        {card.shortName}
                      </Typography>
                    </Box>
                    {isSelected ? (
                      <CheckCircleRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    ) : (
                      <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                    )}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.3,
                      fontSize: '0.6875rem',
                    }}
                  >
                    {card.description}
                  </Typography>
                  <Chip
                    label={card.badge}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.625rem',
                      fontWeight: 500,
                      width: 'fit-content',
                      bgcolor: isSelected ? 'primary.main' : 'action.hover',
                      color: isSelected ? 'primary.contrastText' : 'text.secondary',
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Section 2 & 4: Dual Column Horizontal Row on sm+ (STT Engine & Language Preference) */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
          }}
        >
          {/* Left Column: Speech-to-Text Engine */}
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', mb: 0.5, display: 'block' }}
            >
              Speech-to-Text Engine
            </Typography>
            <ToggleButtonGroup
              value={sttEngine}
              exclusive
              onChange={handleSelectSttEngine}
              size="small"
              fullWidth
              sx={{
                '& .MuiToggleButton-root': {
                  py: 0.5,
                  px: 0.75,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                },
              }}
            >
              {STT_OPTIONS.map((stt) => (
                <ToggleButton key={stt.id} value={stt.id}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem', lineHeight: 1.2 }}>
                      {stt.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.625rem', display: 'block' }}>
                      {stt.subtitle}
                    </Typography>
                  </Box>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Right Column: Language Preference */}
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', mb: 0.5, display: 'block' }}
            >
              Language Preference
            </Typography>
            <ToggleButtonGroup
              value={language}
              exclusive
              onChange={handleSelectLanguage}
              size="small"
              fullWidth
              sx={{
                height: 38,
                '& .MuiToggleButton-root': {
                  py: 0.5,
                  px: 0.5,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                },
              }}
            >
              <ToggleButton value="am">Amharic (አማርኛ)</ToggleButton>
              <ToggleButton value="en">English</ToggleButton>
              <ToggleButton value="auto">Auto</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {/* Section 3 & 5: Thinking Budget & Account Default Checkbox */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.2fr 0.8fr' },
            gap: 2,
            alignItems: 'center',
            pt: 0.5,
          }}
        >
          {/* Thinking Budget Slider + Presets */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}
              >
                Thinking Budget: {budgetLabel}
              </Typography>
            </Box>
            <Slider
              value={localThinkingBudget}
              min={0}
              max={8192}
              step={128}
              onChange={handleSliderChange}
              onChangeCommitted={handleSliderCommit}
              sx={{
                py: 0.5,
                mb: 0.5,
                '& .MuiSlider-thumb': {
                  width: 14,
                  height: 14,
                },
              }}
            />
            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'space-between' }}>
              {BUDGET_PRESETS.map((preset) => (
                <Chip
                  key={preset.value}
                  label={preset.label}
                  size="small"
                  clickable
                  onClick={() => {
                    setLocalThinkingBudget(preset.value);
                    void handlePersist({ newBudget: preset.value });
                  }}
                  variant={localThinkingBudget === preset.value ? 'filled' : 'outlined'}
                  color={localThinkingBudget === preset.value ? 'primary' : 'default'}
                  sx={{
                    flex: 1,
                    height: 20,
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Account Default Checkbox & Mobile Done */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={saveAsDefault}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                />
              }
              label={
                <Typography variant="caption" sx={{ color: 'text.secondary', userSelect: 'none', lineHeight: 1.3 }}>
                  Save as Account Default (Persist across all future chats)
                </Typography>
              }
              sx={{ m: 0 }}
            />
            {isMobile && (
              <Button
                variant="contained"
                size="small"
                onClick={handleClose}
                sx={{ textTransform: 'none', mt: 0.5 }}
              >
                Done
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    );

    return (
      <>
        {/* Trigger Pill Button in Row 3 Left Cluster */}
        <Tooltip
          title={
            isControlDisabled
              ? 'Model locked during generation'
              : `Active model: ${activeCard.name} (Thinking: ${thinkingBudget > 0 ? `${thinkingBudget} tok` : 'Off'})`
          }
          arrow
        >
          <span>
            <Button
              ref={ref}
              size="small"
              variant="outlined"
              disabled={isControlDisabled}
              onClick={handleOpen}
              aria-label="Configure AI Model and Inference Settings"
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              sx={{
                height: 28,
                borderRadius: 4,
                px: 1,
                py: 0.25,
                minWidth: 'auto',
                borderColor: isOpen ? 'primary.main' : 'divider',
                bgcolor: isOpen ? 'action.selected' : 'transparent',
                color: isControlDisabled ? 'text.disabled' : 'text.primary',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.8125rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                transition: 'none !important',
                animation: 'none !important',
                '&:hover': {
                  borderColor: 'text.secondary',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <ActiveIcon
                sx={{
                  fontSize: 16,
                  color: isControlDisabled ? 'text.disabled' : activeCard.iconColor,
                }}
              />
              <Typography
                component="span"
                sx={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'inherit',
                  lineHeight: 1,
                }}
              >
                {isMobile ? activeCard.mobileShortName : activeCard.shortName}
              </Typography>

              {/* Active Thinking Dot Badge */}
              {thinkingBudget > 0 && (
                <Box
                  component="span"
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    flexShrink: 0,
                  }}
                />
              )}

              {isOpen ? (
                <KeyboardArrowUpIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              ) : (
                <KeyboardArrowDownIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              )}
            </Button>
          </span>
        </Tooltip>

        {/* Desktop Presentation: Horizontal Canopy Docked Atop Composer Root */}
        {!isMobile && (
          <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={handleClose}
            disableEnforceFocus={true}
            disableRestoreFocus={true}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            marginThreshold={16}
            slotProps={{
              paper: {
                sx: {
                  width: composerWidth ? `${composerWidth}px` : '100%',
                  maxWidth: 760,
                  maxHeight: 'calc(var(--app-height, 100dvh) - 120px)',
                  overflowY: 'auto',
                  p: 2,
                  borderRadius: '16px 16px 0 0', // No bottom border radius
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderBottom: 'none', // Sits flush atop composer
                  bgcolor: 'background.paper',
                  backgroundImage: 'none',
                  boxShadow: (t) => `0 -8px 24px ${alpha(t.palette.common.black, 0.08)}`,
                  // 100% Invisible Scrollbar Invariant across all browsers
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  '&::-webkit-scrollbar': {
                    display: 'none',
                    width: 0,
                    height: 0,
                  },
                },
              },
            }}
          >
            {settingsContent}
          </Popover>
        )}

        {/* Mobile Presentation: Swipeable Bottom Sheet Drawer (Zero Scrollbar) */}
        {isMobile && (
          <SwipeableDrawer
            anchor="bottom"
            open={isDrawerOpen}
            onClose={handleClose}
            onOpen={() => setIsDrawerOpen(true)}
            disableSwipeToOpen
            slotProps={{
              paper: {
                sx: {
                  borderRadius: '16px 16px 0 0',
                  maxHeight: '85vh',
                  p: 2,
                  pt: 1,
                  overflowY: 'auto',
                  bgcolor: 'background.paper',
                  backgroundImage: 'none',
                  // 100% Invisible Scrollbar Invariant
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  '&::-webkit-scrollbar': {
                    display: 'none',
                    width: 0,
                    height: 0,
                  },
                },
              },
            }}
          >
            {/* Top Puller Handle */}
            <Box
              sx={{
                width: 36,
                height: 4,
                bgcolor: 'divider',
                borderRadius: 2,
                mx: 'auto',
                mb: 1.5,
              }}
            />
            {settingsContent}
          </SwipeableDrawer>
        )}
      </>
    );
  })
);

MuiModelSelector.displayName = 'MuiModelSelector';

export default MuiModelSelector;
