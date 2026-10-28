/**
 * @module components/chat/MuiErrorNotice
 * @description Universal error notice and recovery strip for failed agent turns.
 * Adheres strictly to the Task 8.11 specifications:
 * - Normalized empathetic error translation (plain English, zero raw database connection strings).
 * - Backend failover loop awareness (indicating when all 5 backend attempts were exhausted).
 * - User recovery affordance: [Retry Turn] executing linear history pruning.
 * - Dynamic unexhausted model chips for quota exhaustion scenarios.
 * - Preserves partial stream tokens on mid-stream socket interruptions.
 */

import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ReplayIcon from '@mui/icons-material/Replay';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { alpha } from '@mui/material/styles';
import { AI_MODELS } from '../../utils/constants.js';

/**
 * Normalizes raw network, database, or LLM error strings into empathetic plain English.
 * @param {string|object|Error} rawError
 * @returns {string} Human-friendly translated message.
 */
const normalizeErrorMessage = (rawError) => {
  const msg = String(rawError?.message || (typeof rawError === 'string' ? rawError : JSON.stringify(rawError || '')));
  const code = String(rawError?.code || rawError?.errorCode || '');

  // 1. Google Gemini API Key
  if (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('invalid api key') ||
    msg.includes('API_KEY_SERVICE_BLOCKED') ||
    msg.includes('MISSING_GEMINI_KEY') ||
    code === 'MISSING_GEMINI_KEY'
  ) {
    return 'Your Google Gemini API key appears to be invalid or unconfigured. Please update your API key in Profile > AI Agent Settings.';
  }

  // 2. Addis AI API Key
  if (
    msg.includes('ADDIS_API_KEY') ||
    msg.includes('Addis AI key') ||
    msg.includes('addisassistant.com')
  ) {
    return 'Your Addis AI key appears to be invalid or unconfigured. Please update your Addis AI key in Profile > AI Agent Settings.';
  }

  // 3. Permission Denied
  if (msg.includes('PERMISSION_DENIED') || msg.includes('permission denied')) {
    return 'Access was denied for your API key. Please check your project permissions in Google AI Studio.';
  }

  // 4. Model Quota & Rate Limit (All Fallbacks Exhausted)
  if (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    code === '429'
  ) {
    return 'All available AI models have temporarily reached their hourly quota limit. You can switch to an alternative model below or retry in a few moments.';
  }

  // 5. Database & Network DNS Connectivity
  if (
    msg.includes('getaddrinfo ENOTFOUND') ||
    msg.includes('MongoServerSelectionError') ||
    msg.includes('ECONNREFUSED')
  ) {
    return 'Database connection is temporarily unreachable. Please verify network connectivity or retry shortly.';
  }

  // 6. Socket / Mid-Stream Disconnection
  if (
    msg.includes('ECONNRESET') ||
    msg.includes('socket hang up') ||
    msg.includes('fetch failed') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('ETIMEDOUT')
  ) {
    return 'The network connection was interrupted during streaming. Partial response has been preserved.';
  }

  // 7. Authentication / Session Expiration
  if (
    msg.includes('401') ||
    msg.includes('token') ||
    msg.includes('Unauthorized') ||
    msg.includes('UNAUTHENTICATED')
  ) {
    return 'Your session has expired. Please sign in again to continue.';
  }

  // 8. Upstream Service Unavailable
  if (
    msg.includes('503') ||
    msg.includes('Service Unavailable') ||
    msg.includes('overloaded')
  ) {
    return 'The AI service is currently experiencing high demand across all fallback models. Please retry in a few moments.';
  }

  // 9. Unsupported Media
  if (msg.includes('UNSUPPORTED_MEDIA') || msg.includes('unsupported file type')) {
    return 'The uploaded file format could not be processed. Please upload supported images, PDFs, DOCX, TXT, or MP3/WAV/WebM audio.';
  }

  // 10. Generic Fallback
  return msg.length > 120 || msg.includes('at ') || msg.includes('Error:')
    ? 'An unexpected service error occurred while processing your request. Please try again.'
    : msg || 'Generation failed.';
};

/**
 * User-friendly label for model chip.
 * @param {string} modelId
 * @returns {string} Clean label.
 */
const getModelChipLabel = (modelId) => {
  if (modelId.includes('flash-lite')) return 'Gemini 2.5 Flash-Lite';
  if (modelId.includes('flash')) return 'Gemini 2.5 Flash';
  if (modelId.includes('pro')) return 'Gemini 2.5 Pro';
  return modelId;
};

/**
 * Empathetic error recovery component.
 *
 * @component MuiErrorNotice
 * @param {object} props
 * @param {string|object} props.error - Raw error message or error descriptor.
 * @param {Function} [props.onRetry] - Retry callback triggering linear pruning.
 * @param {string} [props.failedModel] - The model identifier that failed.
 * @param {Function} [props.onSelectModel] - Callback to switch model and retry.
 * @param {boolean} [props.isPartial=false] - Whether partial response was preserved before failure.
 * @returns {import('react').JSX.Element} Rendered error notice.
 */
export const MuiErrorNotice = ({
  error,
  onRetry,
  failedModel,
  onSelectModel,
  isPartial = false,
}) => {
  const friendlyMessage = normalizeErrorMessage(error);
  const rawString = String(error?.message || error || '');
  const isQuota =
    rawString.includes('429') ||
    rawString.includes('RESOURCE_EXHAUSTED') ||
    rawString.includes('quota');

  const unexhaustedModels = Array.isArray(AI_MODELS?.SUPPORTED)
    ? AI_MODELS.SUPPORTED.filter((m) => m !== failedModel)
    : [];

  return (
    <Box
      sx={{
        width: '100%',
        border: 1,
        borderColor: (theme) =>
          isQuota
            ? alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.35 : 0.25)
            : alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.35 : 0.25),
        borderRadius: '12px',
        p: 1.5,
        my: 1,
        bgcolor: (theme) =>
          isQuota
            ? alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.12 : 0.05)
            : alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.12 : 0.05),
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      {/* Primary error message row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <WarningAmberIcon
          sx={{
            color: isQuota ? 'warning.main' : 'error.main',
            fontSize: 20,
            mt: 0.2,
          }}
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: '0.875rem',
              lineHeight: 1.5,
              color: 'text.primary',
              fontWeight: 500,
            }}
          >
            {isPartial ? 'Streaming interrupted' : 'Failed to respond'}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              color: 'text.secondary',
              mt: 0.25,
            }}
          >
            {friendlyMessage}
          </Typography>
        </Box>
      </Box>

      {/* Alternative model chips if quota limit reached */}
      {isQuota && unexhaustedModels.length > 0 && typeof onSelectModel === 'function' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            Try alternative model:
          </Typography>
          {unexhaustedModels.map((modelId) => (
            <Chip
              key={modelId}
              size="small"
              icon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 13 }} />}
              label={getModelChipLabel(modelId)}
              onClick={() => onSelectModel(modelId)}
              variant="outlined"
              sx={{
                fontSize: '0.75rem',
                cursor: 'pointer',
                bgcolor: 'transparent',
                borderColor: 'divider',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            />
          ))}
        </Box>
      )}

      {/* User Recovery Action Row */}
      {typeof onRetry === 'function' && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={onRetry}
            startIcon={<ReplayIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              py: 0.4,
              px: 1.5,
              borderRadius: '8px',
              color: 'text.primary',
              borderColor: 'divider',
              bgcolor: 'transparent !important',
              backgroundColor: 'transparent !important',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'transparent !important',
                backgroundColor: 'transparent !important',
              },
            }}
          >
            {isPartial ? 'Retry from here' : 'Retry Turn'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

MuiErrorNotice.propTypes = {
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onRetry: PropTypes.func,
  failedModel: PropTypes.string,
  onSelectModel: PropTypes.func,
  isPartial: PropTypes.bool,
};

export default MuiErrorNotice;
