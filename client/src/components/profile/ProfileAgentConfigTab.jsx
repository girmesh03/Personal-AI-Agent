/**
 * @module components/profile/ProfileAgentConfigTab
 * @description AI Agent inference parameters, persona definition, reasoning budget, and STT engine configuration tab.
 * Strictly aligned with centralized AI_MODELS and CHAT_CONSTANTS from utils/constants.js and MuiModelSelector.
 */

import { useState, useRef, useCallback, memo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import SaveIcon from '@mui/icons-material/Save';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import MicOutlinedIcon from '@mui/icons-material/MicOutlined';
import BoltIcon from '@mui/icons-material/Bolt';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ScienceIcon from '@mui/icons-material/Science';
import TranslateIcon from '@mui/icons-material/Translate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Link from '@mui/material/Link';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';

import {
  useUpdateAgentConfigMutation,
  useUpdateUserApiKeysMutation,
} from '../../redux/features/userSlice.js';
import MuiButton from '../reusable/MuiButton.jsx';
import MuiTextField from '../reusable/MuiTextField.jsx';
import {
  AI_MODELS,
  CHAT_CONSTANTS,
} from '../../utils/constants.js';

/**
 * Centered model registry cards aligned with MuiModelSelector.
 */
const MODEL_REGISTRY = [
  {
    id: AI_MODELS.DEFAULT, // 'gemini-3.1-flash-lite'
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Default · Fast',
    badgeColor: 'primary',
    description: 'Ultra-low latency for operational workflows, checklists, and real-time responses.',
    icon: BoltIcon,
    iconColor: 'warning.main',
  },
  {
    id: AI_MODELS.PRO, // 'gemini-3.8-flash'
    name: 'Gemini 3.8 Flash',
    badge: 'Pro · Deep Reasoning',
    badgeColor: 'secondary',
    description: 'High-capability model for complex multi-branch analytics, synthesis, and deep reporting.',
    icon: PsychologyIcon,
    iconColor: 'primary.main',
  },
  {
    id: AI_MODELS.FALLBACK, // 'gemini-3-flash-preview'
    name: 'Gemini 3 Flash Preview',
    badge: 'Alternative · Experimental',
    badgeColor: 'info',
    description: 'Experimental preview model with latest features and quota failover support.',
    icon: ScienceIcon,
    iconColor: 'info.main',
  },
];

const THINKING_MARKS = [
  { value: 0, label: '0 (Off)' },
  { value: 2048, label: '2K' },
  { value: 4096, label: '4K' },
  { value: 6144, label: '6K' },
  { value: 8192, label: '8K (Max)' },
];

const THINKING_PRESETS = [
  { label: 'Off', val: 0 },
  { label: '2K (Standard)', val: 2048 },
  { label: '4K (Extended)', val: 4096 },
  { label: '8K (Max)', val: 8192 },
];

const LANGUAGE_OPTIONS = [
  {
    id: 'auto',
    title: 'Auto (Contextual)',
    subtitle: 'Adaptive bilingual detection',
    description: 'Detects and responds in Amharic or English based on user prompt context.',
  },
  {
    id: 'am',
    title: 'Amharic Primary (አማርኛ)',
    subtitle: 'Strict Amharic response preference',
    description: 'Enforces Fidel script and authoritative Amharic terminology throughout.',
  },
  {
    id: 'en',
    title: 'English Primary',
    subtitle: 'Global English communication',
    description: 'Standard corporate English for executive leadership briefings and exports.',
  },
];

const STT_OPTIONS = [
  {
    id: 'addis_ai',
    name: 'Addis AI',
    badge: 'Recommended · Native Amharic',
    badgeColor: 'primary',
    description: 'Specialized state-of-the-art ASR engine tuned for conversational and technical Amharic audio.',
  },
  {
    id: AI_MODELS.PRO,
    name: 'Gemini 3.8 Flash',
    badge: 'Multimodal Audio',
    badgeColor: 'secondary',
    description: 'Multimodal native audio understanding with high-fidelity acoustic context.',
  },
  {
    id: AI_MODELS.DEFAULT,
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Low Latency',
    badgeColor: 'info',
    description: 'Ultra-fast speech transcription optimized for short field inspection voice notes.',
  },
];

/**
 * Isolated Persona Input Field.
 * Employs native DOM ref character counting and uncontrolled inputs for 100% zero-lag typing.
 */
const PersonaInputField = memo(({ initialValue, onValueChange }) => {
  const counterRef = useRef(null);
  const inputRef = useRef(null);

  const handleInput = (e) => {
    if (counterRef.current) {
      counterRef.current.textContent = `${e.target.value.length}`;
    }
  };

  const handleBlur = (e) => {
    onValueChange(e.target.value);
  };

  return (
    <MuiTextField
      inputRef={inputRef}
      multiline
      rows={4}
      fullWidth
      defaultValue={initialValue}
      onInput={handleInput}
      onBlur={handleBlur}
      placeholder="Enter custom agent instructions or operational persona..."
      helperText={
        <Box component="span">
          <Box component="span" ref={counterRef}>
            {initialValue?.length || 0}
          </Box>
          /2,000 characters. Defines how your Personal AI Agent reasons and communicates.
        </Box>
      }
      slotProps={{
        htmlInput: { maxLength: 2000 },
      }}
    />
  );
});
PersonaInputField.displayName = 'PersonaInputField';
PersonaInputField.propTypes = {
  initialValue: PropTypes.string,
  onValueChange: PropTypes.func.isRequired,
};

/**
 * Isolated BYOK API Credentials Section.
 * Completely uncontrolled inputs via native refs to guarantee 0ms latency during typing and paste.
 */
const ApiCredentialsSection = memo(({ apiKeysConfig, updateApiKeys, isSavingKeys }) => {
  const geminiKeyRef = useRef(null);
  const addisKeyRef = useRef(null);

  const handleSaveApiKeys = async () => {
    const geminiVal = geminiKeyRef.current?.value?.trim() || '';
    const addisVal = addisKeyRef.current?.value?.trim() || '';
    if (!geminiVal && !addisVal) {
      toast.info('Please enter an API key to update.');
      return;
    }
    try {
      await updateApiKeys({
        geminiApiKey: geminiVal || undefined,
        addisApiKey: addisVal || undefined,
      }).unwrap();
      toast.success('API credentials updated successfully.');
      if (geminiKeyRef.current) geminiKeyRef.current.value = '';
      if (addisKeyRef.current) addisKeyRef.current.value = '';
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to update API credentials.');
    }
  };

  return (
    <Box sx={{ pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <KeyOutlinedIcon fontSize="small" color="primary" />
        Bring Your Own Key (BYOK) API Credentials
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
        Ensure 100% individual rate-limit sovereignty and zero multi-tenant quota exhaustion by adding your personal free keys.
      </Typography>

      <Grid container spacing={2}>
        {/* Google Gemini Key */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Google Gemini API Key
            </Typography>
            <Chip
              label={apiKeysConfig.hasGeminiKey ? 'Configured' : 'Not Set'}
              color={apiKeysConfig.hasGeminiKey ? 'success' : 'default'}
              size="small"
              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }}
            />
          </Box>
          <MuiTextField
            inputRef={geminiKeyRef}
            type="password"
            isPassword
            fullWidth
            defaultValue=""
            placeholder={apiKeysConfig.hasGeminiKey ? '••••••••••••••••••••' : 'AIzaSy...'}
            helperText={
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>Get your free Gemini key at</span>
                <Link href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                  Google AI Studio <OpenInNewIcon sx={{ fontSize: 12 }} />
                </Link>
              </Box>
            }
          />
        </Grid>

        {/* Addis AI Key */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Addis AI STT API Key
            </Typography>
            <Chip
              label={apiKeysConfig.hasAddisKey ? 'Configured' : 'Auto-fallback to Gemini'}
              color={apiKeysConfig.hasAddisKey ? 'success' : 'info'}
              size="small"
              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }}
            />
          </Box>
          <MuiTextField
            inputRef={addisKeyRef}
            type="password"
            isPassword
            fullWidth
            defaultValue=""
            placeholder={apiKeysConfig.hasAddisKey ? '••••••••••••••••••••' : 'addis_live_...'}
            helperText={
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <span>Get your key at</span>
                <Link href="https://addisassistant.com" target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                  Addis AI Portal <OpenInNewIcon sx={{ fontSize: 12 }} />
                </Link>
                <span>· If omitted, voice auto-transcribes via Gemini.</span>
              </Box>
            }
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <MuiButton
              type="button"
              variant="outlined"
              size="small"
              onClick={handleSaveApiKeys}
              disabled={isSavingKeys}
              startIcon={isSavingKeys ? <CircularProgress size={14} color="inherit" /> : <SaveIcon fontSize="small" />}
            >
              {isSavingKeys ? 'Saving Keys...' : 'Save API Credentials'}
            </MuiButton>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
});
ApiCredentialsSection.displayName = 'ApiCredentialsSection';
ApiCredentialsSection.propTypes = {
  apiKeysConfig: PropTypes.object.isRequired,
  updateApiKeys: PropTypes.func.isRequired,
  isSavingKeys: PropTypes.bool.isRequired,
};

/**
 * AI Agent & Inference Configuration Tab.
 *
 * @component ProfileAgentConfigTab
 * @param {object} props - Component properties.
 * @param {object} props.user - Active supervisor user object.
 * @returns {import('react').JSX.Element} Rendered agent config tab.
 */
export const ProfileAgentConfigTab = ({ user }) => {
  const [updateAgentConfig, { isLoading }] = useUpdateAgentConfigMutation();
  const [updateApiKeys, { isLoading: isSavingKeys }] = useUpdateUserApiKeysMutation();

  const initialConfig = user?.settings?.agentConfig || {};
  const initialStt = user?.settings?.sttEngine || AI_MODELS.DEFAULT_STT_ENGINE || 'addis_ai';
  const apiKeysConfig = user?.settings?.apiKeys || {};

  // Form State strictly defaulting to centralized constants
  const personaRef = useRef(
    initialConfig.persona || CHAT_CONSTANTS.DEFAULT_PERSONA || ''
  );
  const handlePersonaChange = useCallback((val) => {
    personaRef.current = val;
  }, []);

  const [defaultModel, setDefaultModel] = useState(
    initialConfig.defaultModel || AI_MODELS.DEFAULT
  );
  const [thinkingBudget, setThinkingBudget] = useState(
    typeof initialConfig.defaultThinkingBudget === 'number'
      ? Math.min(initialConfig.defaultThinkingBudget, CHAT_CONSTANTS.MAX_THINKING_BUDGET || 8192)
      : CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET || 2048
  );
  const [defaultLanguage, setDefaultLanguage] = useState(
    initialConfig.defaultLanguage || CHAT_CONSTANTS.DEFAULT_LANGUAGE || 'auto'
  );
  const [sttEngine, setSttEngine] = useState(initialStt);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await updateAgentConfig({
        persona: (personaRef.current || '').trim(),
        defaultModel,
        defaultThinkingBudget: Number(thinkingBudget),
        defaultLanguage,
        sttEngine,
      }).unwrap();

      toast.success('AI Agent configurations saved successfully.');
    } catch (err) {
      const errorMsg =
        err?.data?.message || err?.message || 'Failed to update agent configuration.';
      toast.error(errorMsg);
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: '12px',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        boxShadow: 'none',
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <SmartToyOutlinedIcon color="primary" />
          <Typography variant="h6" sx={{ fontSize: { xs: '0.95rem', sm: '1.05rem' }, fontWeight: 600 }}>
            AI Agent & Inference Governance
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: { xs: '0.8rem', sm: '0.875rem' }, mb: { xs: 2, sm: 2.5 } }}>
          Configure foundation reasoning model, deliberation token budget, default language, and Speech-to-Text transcriber.
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Grid container spacing={{ xs: 2.5, sm: 3 }}>
            {/* 1. Persona Definition */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Autonomous Agent Persona & Behavioral Guidelines
              </Typography>
              <PersonaInputField
                initialValue={initialConfig.persona || CHAT_CONSTANTS.DEFAULT_PERSONA || ''}
                onValueChange={handlePersonaChange}
              />
            </Grid>

            {/* 2. Default Gemini Model (Aligned with MuiModelSelector) */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <PsychologyIcon fontSize="small" color="primary" />
                Default Foundation Model (TTT)
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                Select default multimodal foundation model across new chat sessions and autonomous tool runs.
              </Typography>

              <Grid container spacing={1.5}>
                {MODEL_REGISTRY.map((model) => {
                  const Icon = model.icon;
                  const isSelected = defaultModel === model.id;
                  return (
                    <Grid key={model.id} size={{ xs: 12, sm: 4 }}>
                      <Card
                        variant="outlined"
                        onClick={() => setDefaultModel(model.id)}
                        sx={{
                          p: 1.5,
                          height: '100%',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected ? 'action.selected' : 'background.paper',
                          transition: 'border-color 0.15s ease, background-color 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 1,
                          '&:hover': {
                            borderColor: isSelected ? 'primary.main' : 'text.secondary',
                            bgcolor: isSelected ? 'action.selected' : 'action.hover',
                          },
                        }}
                      >
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Icon sx={{ fontSize: '1.1rem', color: model.iconColor }} />
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: { xs: '0.85rem', sm: '0.9rem' } }}>
                                {model.name}
                              </Typography>
                            </Box>
                            {isSelected && <CheckCircleIcon color="primary" sx={{ fontSize: '1.1rem' }} />}
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              minHeight: 34,
                              lineHeight: 1.35,
                            }}
                          >
                            {model.description}
                          </Typography>
                        </Box>
                        <Chip
                          label={model.badge}
                          size="small"
                          color={isSelected ? 'primary' : 'default'}
                          variant={isSelected ? 'filled' : 'outlined'}
                          sx={{
                            height: 20,
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            width: 'fit-content',
                          }}
                        />
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Grid>

            {/* 3. Reasoning Token Budget Card */}
            <Grid size={{ xs: 12 }}>
              <Card
                variant="outlined"
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: '10px',
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 1.5,
                    mb: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PsychologyIcon color="primary" fontSize="small" />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Reasoning Token Budget
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        Allocates deliberation tokens before response streaming begins
                      </Typography>
                    </Box>
                  </Box>

                  {/* Preset Quick Chips */}
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {THINKING_PRESETS.map((preset) => {
                      const isSelected = thinkingBudget === preset.val;
                      return (
                        <Chip
                          key={preset.val}
                          label={preset.label}
                          size="small"
                          clickable
                          color={isSelected ? 'primary' : 'default'}
                          variant={isSelected ? 'filled' : 'outlined'}
                          onClick={() => setThinkingBudget(preset.val)}
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            height: 24,
                          }}
                        />
                      );
                    })}
                  </Stack>
                </Box>

                {/* Slider */}
                <Box sx={{ px: { xs: 1, sm: 2 }, pt: 1, pb: 0.5 }}>
                  <Slider
                    value={thinkingBudget}
                    min={CHAT_CONSTANTS.MIN_THINKING_BUDGET || 0}
                    max={CHAT_CONSTANTS.MAX_THINKING_BUDGET || 8192}
                    step={128}
                    marks={THINKING_MARKS}
                    valueLabelDisplay="auto"
                    onChange={(_e, val) => setThinkingBudget(val)}
                    sx={{ color: 'primary.main' }}
                  />
                </Box>

                {/* Contextual Description */}
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    display: 'block',
                    mt: 1.5,
                    fontStyle: 'italic',
                    bgcolor: 'action.hover',
                    p: 1,
                    borderRadius: '6px',
                  }}
                >
                  {thinkingBudget === 0
                    ? '⚡ Instant Mode: Zero thinking tokens allocated for immediate, minimum-latency turn generation.'
                    : thinkingBudget <= 2048
                    ? '💡 Standard Deliberation: Fast response with balanced reasoning, optimal for everyday checklist analysis.'
                    : thinkingBudget <= 4096
                    ? '🧠 Extended Deliberation: Deeper multi-step reasoning for cross-branch comparisons and anomaly detection.'
                    : '🔬 Maximum Deliberation (8K Tokens): Exhaustive deep-thinking model deliberation for comprehensive audit synthesis.'}
                </Typography>
              </Card>
            </Grid>

            {/* 4. Default Interaction Language Option Deck */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <TranslateIcon fontSize="small" color="primary" />
                Default Interaction Language
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                Select language preference applied to conversational turn responses and report summaries.
              </Typography>

              <Grid container spacing={1.5}>
                {LANGUAGE_OPTIONS.map((lang) => {
                  const isSelected = defaultLanguage === lang.id;
                  return (
                    <Grid key={lang.id} size={{ xs: 12, sm: 4 }}>
                      <Card
                        variant="outlined"
                        onClick={() => setDefaultLanguage(lang.id)}
                        sx={{
                          p: 1.5,
                          height: '100%',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected ? 'action.selected' : 'background.paper',
                          transition: 'border-color 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                              {lang.title}
                            </Typography>
                            {isSelected && <CheckCircleIcon color="primary" sx={{ fontSize: '1.1rem' }} />}
                          </Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 500 }}>
                            {lang.subtitle}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem', display: 'block' }}>
                            {lang.description}
                          </Typography>
                        </Box>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Grid>

            {/* 5. STT Engine Option Deck (Aligned with AI_MODELS.STT_ENGINES) */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <MicOutlinedIcon fontSize="small" color="primary" />
                Speech-to-Text (STT) Voice Transcriber
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                Engine utilized when recording or uploading audio evidentiary memos and voice directives.
              </Typography>

              <Grid container spacing={1.5}>
                {STT_OPTIONS.map((stt) => {
                  const isSelected = sttEngine === stt.id;
                  return (
                    <Grid key={stt.id} size={{ xs: 12, sm: 4 }}>
                      <Card
                        variant="outlined"
                        onClick={() => setSttEngine(stt.id)}
                        sx={{
                          p: 1.5,
                          height: '100%',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected ? 'action.selected' : 'background.paper',
                          transition: 'border-color 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                              {stt.name}
                            </Typography>
                            {isSelected && <CheckCircleIcon color="primary" sx={{ fontSize: '1.1rem' }} />}
                          </Box>
                          <Chip
                            label={stt.badge}
                            size="small"
                            color={stt.badgeColor}
                            sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, mb: 0.75 }}
                          />
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block' }}>
                            {stt.description}
                          </Typography>
                        </Box>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Grid>

            {/* 6. Bring Your Own Key (BYOK) Inference & Speech Credentials */}
            <Grid size={{ xs: 12 }}>
              <ApiCredentialsSection
                apiKeysConfig={apiKeysConfig}
                updateApiKeys={updateApiKeys}
                isSavingKeys={isSavingKeys}
              />
            </Grid>
          </Grid>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              mt: { xs: 2.5, sm: 3.5 },
            }}
          >
            <MuiButton
              type="submit"
              variant="contained"
              color="primary"
              disabled={isLoading}
              startIcon={
                isLoading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon fontSize="small" />
              }
              sx={{
                width: { xs: '100%', sm: 'auto' },
                py: { xs: 0.85, sm: 0.75 },
                fontWeight: 600,
              }}
            >
              {isLoading ? 'Saving Configuration...' : 'Save Agent Configuration'}
            </MuiButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

ProfileAgentConfigTab.propTypes = {
  user: PropTypes.shape({
    settings: PropTypes.shape({
      agentConfig: PropTypes.shape({
        persona: PropTypes.string,
        defaultModel: PropTypes.string,
        defaultThinkingBudget: PropTypes.number,
        defaultLanguage: PropTypes.string,
      }),
      sttEngine: PropTypes.string,
    }),
  }),
};

export default ProfileAgentConfigTab;
