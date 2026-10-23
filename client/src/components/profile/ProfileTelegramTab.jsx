/**
 * @module components/profile/ProfileTelegramTab
 * @description Telegram Operational Channels, Bot Token, and Broadcast Preferences tab.
 * Enforces zero-lag typing with react-hook-form mode: 'onBlur' and zero watch calls.
 */

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';

import {
  useVerifyTelegramBotTokenMutation,
  useConnectTelegramMutation,
  useDisconnectTelegramMutation,
  useToggleTelegramMutation,
} from '../../redux/features/userSlice.js';
import MuiButton from '../reusable/MuiButton.jsx';
import MuiTextField from '../reusable/MuiTextField.jsx';

/**
 * Telegram Channels and Broadcast Settings Tab.
 *
 * @component ProfileTelegramTab
 * @param {object} props - Component properties.
 * @param {object} props.user - Active supervisor user object.
 * @returns {import('react').JSX.Element} Rendered telegram tab.
 */
export const ProfileTelegramTab = ({ user }) => {
  const [verifyToken, { isLoading: isPinging }] = useVerifyTelegramBotTokenMutation();
  const [connectTelegram, { isLoading: isSaving }] = useConnectTelegramMutation();
  const [disconnectTelegram, { isLoading: isDisconnecting }] = useDisconnectTelegramMutation();
  const [toggleTelegram, { isLoading: isToggling }] = useToggleTelegramMutation();

  const initialTelegram = user?.integrations?.telegram || {};
  const isConnected = Boolean(initialTelegram.connected);
  const isEnabled = initialTelegram.enabled !== false;
  const botUsername = initialTelegram.botUsername || null;

  const {
    register,
    handleSubmit,
    control,
    getValues,
    reset,
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      botToken: initialTelegram.botToken || '',
      managementChatId: initialTelegram.managementChatId || '',
      maintenanceChatId: initialTelegram.maintenanceChatId || '',
      generalChatId: initialTelegram.generalChatId || '',
      defaultFormat: initialTelegram.defaultFormat || 'text',
    },
  });

  const handleTestPing = async () => {
    const rawToken = getValues('botToken');
    const token = typeof rawToken === 'string' ? rawToken.trim() : '';

    if (!token) {
      toast.warning('Please enter a Telegram Bot Token before testing.');
      return;
    }

    const tokenPattern = /^\d+:[A-Za-z0-9_-]{20,}$/;
    if (!tokenPattern.test(token)) {
      toast.error('Invalid Telegram Bot Token format. Tokens typically look like: 123456789:ABCDefgh-IJKLmnOPqrstUV');
      return;
    }

    try {
      const res = await verifyToken({ botToken: token }).unwrap();
      if (res?.valid) {
        toast.success(`Telegram Bot verified: @${res.bot.username || 'bot'} (${res.bot.firstName || 'Bot'})`);
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Invalid Telegram Bot Token.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectTelegram().unwrap();
      reset({
        botToken: '',
        managementChatId: '',
        maintenanceChatId: '',
        generalChatId: '',
        defaultFormat: 'text',
      });
      toast.success('Telegram integration disconnected successfully.');
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to disconnect Telegram.');
    }
  };

  const handleToggle = async () => {
    try {
      const res = await toggleTelegram().unwrap();
      toast.success(`Telegram integration ${res?.data?.enabled ? 'enabled' : 'paused'}.`);
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to toggle Telegram.');
    }
  };

  const onSubmit = async (values) => {
    try {
      await connectTelegram({
        botToken: values.botToken?.trim() || undefined,
        managementChatId: values.managementChatId?.trim() || null,
        maintenanceChatId: values.maintenanceChatId?.trim() || null,
        generalChatId: values.generalChatId?.trim() || null,
        defaultFormat: values.defaultFormat || 'text',
      }).unwrap();

      toast.success('Telegram operational channels connected and saved successfully.');
    } catch (err) {
      const errorMsg =
        err?.data?.message || err?.message || 'Failed to update Telegram settings.';
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
        borderColor: isConnected ? 'primary.light' : 'divider',
        boxShadow: 'none',
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            mb: 1,
          }}
        >
          {/* Tier 1: Title and Bot Status Chip */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minWidth: 0, width: { xs: '100%', sm: 'auto' } }}>
            <SendIcon color="primary" fontSize="small" sx={{ flexShrink: 0 }} />
            <Typography variant="h6" sx={{ fontSize: { xs: '0.95rem', sm: '1.05rem' }, fontWeight: 600 }}>
              Telegram Operational Broadcast Channels
            </Typography>
            <Chip
              icon={isConnected ? <CheckCircleOutlineIcon fontSize="small" /> : undefined}
              label={isConnected ? (botUsername ? `@${botUsername}` : 'Connected') : 'Not Connected'}
              color={isConnected ? (isEnabled ? 'success' : 'default') : 'default'}
              size="small"
              variant={isConnected ? 'filled' : 'outlined'}
              sx={{
                maxWidth: { xs: 150, sm: 220 },
                '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
              }}
            />
          </Box>

          {/* Tier 2: Controls cluster (Enabled toggle + Disconnect) */}
          {isConnected && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: { xs: 'space-between', sm: 'flex-end' },
                width: { xs: '100%', sm: 'auto' },
                gap: 1.5,
              }}
            >
              <FormControlLabel
                control={<Switch checked={isEnabled} onChange={handleToggle} disabled={isToggling} size="small" />}
                label={isEnabled ? 'Enabled' : 'Paused'}
                sx={{ m: 0 }}
              />

              {/* Desktop/Tablet Disconnect Button */}
              <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                <MuiButton
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={isDisconnecting ? <CircularProgress size={12} color="inherit" /> : <LinkOffIcon fontSize="small" />}
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  sx={{ fontSize: '0.75rem' }}
                >
                  Disconnect
                </MuiButton>
              </Box>

              {/* Mobile xs Iconified Disconnect Button with Tooltip */}
              <Box sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
                <Tooltip title="Disconnect Telegram" arrow>
                  <span>
                    <IconButton
                      color="error"
                      size="small"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                      sx={{
                        border: 1,
                        borderColor: 'error.main',
                        borderRadius: 1,
                        p: 0.5,
                      }}
                    >
                      {isDisconnecting ? <CircularProgress size={16} color="inherit" /> : <LinkOffIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </Box>
          )}
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: { xs: '0.8rem', sm: '0.875rem' }, mb: { xs: 2, sm: 2.5 } }}>
          Connect your Telegram Bot to instantly dispatch synthesized inspection dossiers, incident alerts, and executive briefings to operations channels.
        </Typography>

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Grid container spacing={{ xs: 1.5, sm: 2.5 }}>
            {/* Bot API Token */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Telegram Bot API Token
              </Typography>
              <MuiTextField
                type="password"
                isPassword
                fullWidth
                placeholder="e.g. 7123456789:AAHk1_example_token_abcdef12345"
                helperText="Generated via Telegram's @BotFather. Kept securely encrypted on the server."
                {...register('botToken')}
              />
            </Grid>

            {/* Management Channel Chat ID */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                Management Channel ID
              </Typography>
              <MuiTextField
                fullWidth
                placeholder="e.g. -1001234567890"
                helperText="Executive & area leadership channel"
                {...register('managementChatId')}
              />
            </Grid>

            {/* Maintenance Channel Chat ID */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                Maintenance Channel ID
              </Typography>
              <MuiTextField
                fullWidth
                placeholder="e.g. -1002345678901"
                helperText="Equipment & facilities dispatch channel"
                {...register('maintenanceChatId')}
              />
            </Grid>

            {/* General Channel Chat ID */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                General Channel ID
              </Typography>
              <MuiTextField
                fullWidth
                placeholder="e.g. -1003456789012"
                helperText="All-hands or branch operations chat"
                {...register('generalChatId')}
              />
            </Grid>

            {/* Telegram Channel Setup Guidance */}
            <Grid size={{ xs: 12 }}>
              <Alert
                severity="info"
                variant="outlined"
                sx={{
                  borderRadius: '8px',
                  bgcolor: 'action.hover',
                  '& .MuiAlert-message': { fontSize: '0.8125rem', lineHeight: 1.5 },
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, fontSize: '0.8125rem' }}>
                  Important Telegram Channel Setup Requirements:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  <li>
                    <strong>Administrator Rights:</strong> You must add your bot to the channel/group as an <em>Administrator</em> with <strong>&quot;Post Messages&quot;</strong> permission enabled. Otherwise, Telegram will reject broadcast attempts.
                  </li>
                  <li>
                    <strong>Channel Chat ID:</strong> Telegram channels and supergroups require the <code>-100</code> prefix (e.g. <code>-1001003982938439</code>) or a public username (e.g. <code>@my_channel</code>). You can find your Chat ID via <em>web.telegram.org</em> in the browser URL bar or by forwarding a message from the channel to <code>@userinfobot</code>.
                  </li>
                </Box>
              </Alert>
            </Grid>

            {/* Broadcast Format Selection */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Default Broadcast Format
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                Choose how reports and executive summaries are formatted when posted to Telegram channels.
              </Typography>

              <Controller
                name="defaultFormat"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    {...field}
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: { xs: 1.25, sm: 2 },
                    }}
                  >
                    <Card
                      variant="outlined"
                      sx={{
                        flex: 1,
                        p: { xs: 1.25, sm: 1.5 },
                        borderRadius: '8px',
                        borderColor: field.value === 'text' ? 'primary.main' : 'divider',
                        bgcolor: field.value === 'text' ? 'action.selected' : 'background.paper',
                        cursor: 'pointer',
                      }}
                      onClick={() => field.onChange('text')}
                    >
                      <FormControlLabel
                        value="text"
                        control={<Radio size="small" />}
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Plain Text Markdown
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              Formatted Markdown with bold headers and plain-text bullets. Maximum readability on mobile devices.
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                      />
                    </Card>

                    <Card
                      variant="outlined"
                      sx={{
                        flex: 1,
                        p: { xs: 1.25, sm: 1.5 },
                        borderRadius: '8px',
                        borderColor: field.value === 'image' ? 'primary.main' : 'divider',
                        bgcolor: field.value === 'image' ? 'action.selected' : 'background.paper',
                        cursor: 'pointer',
                      }}
                      onClick={() => field.onChange('image')}
                    >
                      <FormControlLabel
                        value="image"
                        control={<Radio size="small" />}
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              High-Resolution 2K Image Card
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              Rendered 2048px corporate graphic card with branded header, status pills, and Amharic typography.
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                      />
                    </Card>
                  </RadioGroup>
                )}
              />
            </Grid>
          </Grid>

          {/* Action Buttons Deck */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column-reverse', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              mt: { xs: 2.5, sm: 3.5 },
            }}
          >
            {/* Ping Bot Button */}
            <MuiButton
              variant="outlined"
              color="inherit"
              disabled={isPinging}
              onClick={handleTestPing}
              startIcon={
                isPinging ? <CircularProgress size={14} color="inherit" /> : <SignalCellularAltIcon fontSize="small" />
              }
              sx={{
                width: { xs: '100%', sm: 'auto' },
                color: 'text.secondary',
              }}
            >
              {isPinging ? 'Pinging Bot...' : 'Test Bot Token'}
            </MuiButton>

            {/* Save Settings Button */}
            <MuiButton
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSaving}
              startIcon={
                isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon fontSize="small" />
              }
              sx={{
                width: { xs: '100%', sm: 'auto' },
                py: { xs: 1, sm: 0.75 },
                fontWeight: 600,
              }}
            >
              {isSaving ? 'Connecting...' : (isConnected ? 'Update Telegram Settings' : 'Connect Telegram')}
            </MuiButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

ProfileTelegramTab.propTypes = {
  user: PropTypes.shape({
    settings: PropTypes.shape({
      telegram: PropTypes.shape({
        botToken: PropTypes.string,
        managementChatId: PropTypes.string,
        maintenanceChatId: PropTypes.string,
        generalChatId: PropTypes.string,
        defaultFormat: PropTypes.string,
      }),
    }),
  }),
};

export default ProfileTelegramTab;
