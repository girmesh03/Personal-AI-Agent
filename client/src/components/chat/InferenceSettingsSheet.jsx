/**
 * @module components/chat/InferenceSettingsSheet
 * @description Responsive model governance and inference configuration sheet.
 * Renders as an anchored Popover on desktop (sm+) and a SwipeableDrawer on mobile (xs).
 * Governs active Gemini model selection, thinking budget token slider (0-8192),
 * synthesis language switcher, STT engine indicator, and HTTP 429 quota exhaustion recovery.
 */

import { useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Popover from '@mui/material/Popover';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BoltIcon from '@mui/icons-material/Bolt';
import PsychologyIcon from '@mui/icons-material/Psychology';
import LanguageIcon from '@mui/icons-material/Language';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import TuneIcon from '@mui/icons-material/Tune';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';

import MuiButton from '../reusable/MuiButton.jsx';
import {
  selectActiveModel,
  selectThinkingBudget,
  selectLanguage,
  selectSttEngine,
  setActiveModel,
  setThinkingBudget,
  setLanguage,
  setSttEngine,
  useUpdateChatConfigMutation,
} from '../../redux/features/chatSlice.js';
import { AI_MODELS, CHAT_CONSTANTS } from '../../utils/constants.js';

/**
 * Metadata definition for supported Google Gemini AI models.
 * @constant
 */
const MODEL_CONFIGS = [
  {
    id: AI_MODELS.DEFAULT,
    name: 'Gemini 2.5 Flash',
    badge: 'Recommended',
    badgeColor: 'primary',
    description: 'Fast, balanced multi-modal reasoning for operational tasks and branch visits.',
    supportsThinking: true,
    icon: AutoAwesomeIcon,
    iconColor: 'primary.main',
  },
  {
    id: AI_MODELS.FALLBACK,
    name: 'Gemini 2.5 Flash-Lite',
    badge: 'Low Latency',
    badgeColor: 'warning',
    description: 'Ultra-fast, cost-effective fallback without extended chain-of-thought scratchpad.',
    supportsThinking: false,
    icon: BoltIcon,
    iconColor: 'warning.main',
  },
  {
    id: AI_MODELS.PRO,
    name: 'Gemini 2.5 Pro',
    badge: 'Deep Reasoning',
    badgeColor: 'secondary',
    description: 'Advanced reasoning and exhaustive synthesis for cross-branch audit inspections.',
    supportsThinking: true,
    icon: PsychologyIcon,
    iconColor: 'secondary.main',
  },
];

/**
 * Thinking budget slider marks.
 * @constant
 */
const BUDGET_MARKS = [
  { value: 0, label: '0' },
  { value: 2048, label: '2K' },
  { value: 4096, label: '4K' },
  { value: 8192, label: '8K' },
];

/**
 * Inference settings sheet component.
 *
 * @component InferenceSettingsSheet
 * @param {object} props - Component properties.
 * @param {boolean} props.open - Whether sheet is currently open.
 * @param {HTMLElement|null} [props.anchorEl] - Anchor element for desktop popover positioning.
 * @param {Function} props.onClose - Callback triggered when sheet dismisses.
 * @param {string} [props.chatId] - Active chat session ID for backend persistence.
 * @param {boolean} [props.isQuotaExhausted=false] - Whether 429 quota exhaustion is active.
 * @param {Function} [props.onQuotaRecover] - Callback triggered when user executes 429 fallback switch.
 * @returns {JSX.Element} Rendered popover or drawer.
 */
export const InferenceSettingsSheet = ({
  open,
  anchorEl,
  onClose,
  chatId,
  isQuotaExhausted = false,
  onQuotaRecover,
  disablePortal = typeof window === 'undefined',
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useDispatch();

  const composerAnchorEl = useMemo(() => {
    if (!anchorEl) return null;
    return (typeof anchorEl.closest === 'function' ? anchorEl.closest('form') : null) || anchorEl;
  }, [anchorEl]);

  const activeModel = useSelector(selectActiveModel);
  const thinkingBudget = useSelector(selectThinkingBudget);
  const currentLanguage = useSelector(selectLanguage);
  const currentSttEngine = useSelector(selectSttEngine);

  const [updateChatConfig] = useUpdateChatConfigMutation();

  const activeConfig = useMemo(() => {
    return MODEL_CONFIGS.find((m) => m.id === activeModel) || MODEL_CONFIGS[0];
  }, [activeModel]);

  const isThinkingSupported = activeConfig.supportsThinking;

  // Model selection handler
  const handleSelectModel = useCallback(
    (modelId) => {
      dispatch(setActiveModel(modelId));
      const targetConfig = MODEL_CONFIGS.find((m) => m.id === modelId);

      // Lock thinking budget to 0 if model doesn't support reasoning
      if (targetConfig && !targetConfig.supportsThinking) {
        dispatch(setThinkingBudget(0));
      } else if (thinkingBudget === 0) {
        dispatch(setThinkingBudget(CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET));
      }

      if (chatId) {
        updateChatConfig({
          chatId,
          model: modelId,
          thinkingBudget: targetConfig?.supportsThinking
            ? thinkingBudget
            : 0,
        }).catch(() => { });
      }
    },
    [dispatch, thinkingBudget, chatId, updateChatConfig]
  );

  // Thinking budget slider change handler
  const handleBudgetChange = useCallback(
    (_event, value) => {
      const budgetValue = Array.isArray(value) ? value[0] : value;
      dispatch(setThinkingBudget(budgetValue));

      if (chatId) {
        updateChatConfig({ chatId, thinkingBudget: budgetValue }).catch(() => { });
      }
    },
    [dispatch, chatId, updateChatConfig]
  );

  // Language change handler
  const handleLanguageChange = useCallback(
    (event) => {
      const nextLang = event.target.value;
      dispatch(setLanguage(nextLang));

      if (chatId) {
        updateChatConfig({ chatId, language: nextLang }).catch(() => { });
      }
    },
    [dispatch, chatId, updateChatConfig]
  );

  // STT Engine change handler
  const handleSttEngineChange = useCallback(
    (event) => {
      const nextEngine = event.target.value;
      dispatch(setSttEngine(nextEngine));
    },
    [dispatch]
  );

  // 429 Quota Exhaustion 1-click recovery
  const handleQuotaFallback = useCallback(() => {
    handleSelectModel(AI_MODELS.FALLBACK);
    toast.info('Switched to Gemini 2.5 Flash-Lite for immediate quota recovery.');
    if (typeof onQuotaRecover === 'function') {
      onQuotaRecover();
    }
  }, [handleSelectModel, onQuotaRecover]);

  // Main configuration body
  const content = (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TuneIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Inference & Model Governance
        </Typography>
      </Box>

      {/* 429 Quota Exhaustion Alert Card */}
      {isQuotaExhausted && (
        <Alert
          severity="warning"
          sx={{ borderRadius: 2 }}
          action={
            <MuiButton
              size="small"
              variant="contained"
              color="warning"
              onClick={handleQuotaFallback}
            >
              Switch to Flash-Lite
            </MuiButton>
          }
        >
          Quota exhausted on active model. Switch to Gemini 2.5 Flash-Lite to continue immediately.
        </Alert>
      )}

      {/* Model Selection Cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>
          Active Model
        </Typography>

        {MODEL_CONFIGS.map((config) => {
          const isSelected = config.id === activeModel;
          const IconComp = config.icon;

          return (
            <Box
              key={config.id}
              onClick={() => handleSelectModel(config.id)}
              sx={{
                p: 1.25,
                borderRadius: 2,
                cursor: 'pointer',
                border: '1.5px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected
                  ? (themeMode) =>
                    themeMode.palette.mode === 'dark'
                      ? 'rgba(33, 150, 243, 0.08)'
                      : 'rgba(25, 118, 210, 0.04)'
                  : 'background.paper',
                transition: 'all 120ms ease-in-out',
                '&:hover': {
                  borderColor: isSelected ? 'primary.main' : 'text.disabled',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconComp sx={{ fontSize: 18, color: config.iconColor }} />
                  <Typography variant="body2" sx={{ fontWeight: isSelected ? 700 : 500 }}>
                    {config.name}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={config.badge}
                  color={config.badgeColor}
                  variant={isSelected ? 'filled' : 'outlined'}
                  sx={{ height: 20, fontSize: '0.6875rem' }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
                {config.description}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Divider />

      {/* Thinking Budget Slider */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <PsychologyIcon sx={{ fontSize: 18, color: isThinkingSupported ? 'primary.main' : 'text.disabled' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>
              Thinking Budget
            </Typography>
          </Box>
          <Chip
            size="small"
            label={`${isThinkingSupported ? thinkingBudget : 0} tokens`}
            variant="outlined"
            sx={{ height: 20, fontSize: '0.6875rem', fontFamily: 'monospace' }}
          />
        </Box>

        <Box sx={{ px: 1, pt: 1 }}>
          <Slider
            value={isThinkingSupported ? thinkingBudget : 0}
            min={CHAT_CONSTANTS.MIN_THINKING_BUDGET}
            max={CHAT_CONSTANTS.MAX_THINKING_BUDGET}
            step={256}
            marks={BUDGET_MARKS}
            disabled={!isThinkingSupported}
            onChange={handleBudgetChange}
            slotProps={{
              input: {
                id: 'thinking-budget-slider-input',
                name: 'thinkingBudget',
              },
              thumb: {
                sx: {
                  '&:hover, &.Mui-focusVisible': {
                    boxShadow: 'inherit',
                  },
                },
              },
            }}
          />
        </Box>

        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
          {isThinkingSupported
            ? 'Tokens allocated for autonomous chain-of-thought scratchpad (0 = disabled).'
            : 'Extended thinking is disabled for Flash-Lite.'}
        </Typography>
      </Box>

      <Divider />

      {/* Language Switcher */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <LanguageIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>
            Synthesis Language
          </Typography>
        </Box>

        <RadioGroup row value={currentLanguage} onChange={handleLanguageChange}>
          <FormControlLabel
            value="am"
            control={<Radio size="small" />}
            label={<Typography variant="body2">Amharic (አማርኛ)</Typography>}
          />
          <FormControlLabel
            value="en"
            control={<Radio size="small" />}
            label={<Typography variant="body2">English</Typography>}
          />
          <FormControlLabel
            value="auto"
            control={<Radio size="small" />}
            label={<Typography variant="body2">Auto-detect</Typography>}
          />
        </RadioGroup>
      </Box>

      <Divider />

      {/* Speech-to-Text Engine Selection */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <GraphicEqIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>
            Speech-to-Text Engine
          </Typography>
        </Box>

        <RadioGroup value={currentSttEngine} onChange={handleSttEngineChange}>
          <FormControlLabel
            value="addis_ai"
            control={<Radio size="small" />}
            label={
              <Box>
                <Typography variant="body2">Addis AI (Wav2Vec2 Fine-tuned)</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Optimal precision for Amharic vocal dictation
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            value="gemini-2.5-flash"
            control={<Radio size="small" />}
            label={
              <Box>
                <Typography variant="body2">Gemini 2.5 Flash Audio</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Native multi-modal audio transcription
                </Typography>
              </Box>
            }
          />
        </RadioGroup>
      </Box>
    </Box>
  );

  // Responsive presentation: SwipeableDrawer on mobile (xs) vs Popover on desktop (sm+)
  if (isMobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        onOpen={() => { }}
        disablePortal={disablePortal}
        disableRestoreFocus
        disableAutoFocus
        disableEnforceFocus
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '85vh',
              p: 2.5,
              overflowY: 'auto',
            },
          },
        }}
      >
        {content}
      </SwipeableDrawer>
    );
  }

  return (
    <Popover
      open={open}
      anchorEl={composerAnchorEl}
      anchorReference={composerAnchorEl ? 'anchorEl' : 'none'}
      onClose={onClose}
      disablePortal={disablePortal}
      disableRestoreFocus
      disableAutoFocus
      disableEnforceFocus
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      slotProps={{
        paper: {
          sx: {
            p: 2.5,
            width: 380,
            maxWidth: '90vw',
            borderRadius: 2,
            maxHeight: '75vh',
            overflowY: 'auto',
            mb: 1,
            backgroundImage: 'none',
            boxShadow: (themeMode) =>
              themeMode.palette.mode === 'dark'
                ? '0 8px 32px rgba(0,0,0,0.6)'
                : '0 8px 32px rgba(0,0,0,0.12)',
          },
        },
      }}
    >
      {content}
    </Popover>
  );
};

InferenceSettingsSheet.propTypes = {
  open: PropTypes.bool.isRequired,
  anchorEl: PropTypes.any,
  onClose: PropTypes.func.isRequired,
  chatId: PropTypes.string,
  isQuotaExhausted: PropTypes.bool,
  onQuotaRecover: PropTypes.func,
  disablePortal: PropTypes.bool,
};

export default InferenceSettingsSheet;
