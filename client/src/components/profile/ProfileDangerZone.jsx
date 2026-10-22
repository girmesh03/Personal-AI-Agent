/**
 * @module components/profile/ProfileDangerZone
 * @description Profile Danger Zone card for cascading account preference reset.
 * Implements the strict three-phase action lifecycle (action -> confirm -> effect) using MuiConfirmDialog.
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { toast } from 'react-toastify';

import MuiButton from '../reusable/MuiButton.jsx';
import MuiConfirmDialog from '../reusable/MuiConfirmDialog.jsx';
import {
  useUpdateAgentConfigMutation,
  useUpdateDirectivesMutation,
} from '../../redux/features/userSlice.js';
import { CHAT_CONSTANTS, AI_MODELS } from '../../utils/constants.js';

/**
 * Danger Zone card component providing guarded account preference reset.
 *
 * @component ProfileDangerZone
 * @returns {import('react').JSX.Element} Rendered Danger Zone component.
 */
export const ProfileDangerZone = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [updateAgentConfig, { isLoading: isResettingConfig }] = useUpdateAgentConfigMutation();
  const [updateDirectives, { isLoading: isResettingDirectives }] = useUpdateDirectivesMutation();

  const isResetting = isResettingConfig || isResettingDirectives;

  const handleConfirmReset = async () => {
    try {
      // 1. Reset Directives to clean empty structures
      await updateDirectives({
        negativeVocabulary: [],
        phraseMappings: {},
        customInstructions: [],
      }).unwrap();

      // 2. Reset Agent Configuration to system defaults
      await updateAgentConfig({
        persona: CHAT_CONSTANTS.DEFAULT_PERSONA || '',
        defaultModel: AI_MODELS.DEFAULT,
        defaultThinkingBudget: CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET || 2048,
        defaultLanguage: CHAT_CONSTANTS.DEFAULT_LANGUAGE || 'auto',
        sttEngine: AI_MODELS.DEFAULT_STT_ENGINE || 'addis_ai',
        reportTemplates: {
          singleBranch: null,
          multiBranch: null,
        },
      }).unwrap();

      setIsDialogOpen(false);
      toast.success('Account directives and agent configurations reset to system defaults.');
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to reset account preferences.');
    }
  };

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderRadius: '12px',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(211, 47, 47, 0.05)' : 'rgba(211, 47, 47, 0.02)',
          border: 1,
          borderColor: 'error.main',
          boxShadow: 'none',
          mt: 3,
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <WarningAmberIcon color="error" fontSize="small" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'error.main' }}>
                  Danger Zone: Reset Account Preferences
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Permanently purge all custom directives, negative vocabulary, phrase mappings, and report templates, reverting your Personal AI Agent configurations to factory defaults.
              </Typography>
            </Box>

            <MuiButton
              variant="outlined"
              color="error"
              size="small"
              disabled={isResetting}
              startIcon={
                isResetting ? <CircularProgress size={14} color="inherit" /> : <RestartAltIcon fontSize="small" />
              }
              onClick={() => setIsDialogOpen(true)}
              sx={{
                width: { xs: '100%', sm: 'auto' },
                whiteSpace: 'nowrap',
                fontWeight: 600,
              }}
            >
              {isResetting ? 'Resetting...' : 'Reset Preferences'}
            </MuiButton>
          </Box>
        </CardContent>
      </Card>

      {/* Confirmation Dialog following action -> confirm -> effect */}
      <MuiConfirmDialog
        open={isDialogOpen}
        title="Reset All AI Agent Preferences?"
        message="Are you sure you want to reset all custom directives, phrase mappings, and report templates? This action cannot be undone."
        confirmText="Yes, Reset Everything"
        cancelText="Cancel"
        confirmColor="error"
        onConfirm={handleConfirmReset}
        onCancel={() => setIsDialogOpen(false)}
      />
    </>
  );
};

export default ProfileDangerZone;
