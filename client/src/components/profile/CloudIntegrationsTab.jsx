/**
 * @module components/profile/CloudIntegrationsTab
 * @description Cloud Workspace & Google Drive Integration Management component.
 * Provides real-time Google Drive connection status, OAuth authorization handshake,
 * connected account scopes, dedicated root folder display, and secure disconnection controls.
 */

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import FolderIcon from '@mui/icons-material/Folder';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import AddLinkIcon from '@mui/icons-material/AddLink';
import { toast } from 'react-toastify';

import MuiButton from '../reusable/MuiButton.jsx';
import MuiConfirmDialog from '../reusable/MuiConfirmDialog.jsx';
import {
  useGetGoogleDriveStatusQuery,
  useLazyGetGoogleDriveConnectUrlQuery,
  useDisconnectGoogleDriveMutation,
  useToggleGoogleDriveMutation,
} from '../../redux/features/userSlice.js';

/**
 * Cloud Workspace & Google Drive Integration Management Tab.
 *
 * @component CloudIntegrationsTab
 * @returns {import('react').JSX.Element} Rendered Cloud Integrations view.
 */
export const CloudIntegrationsTab = () => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: driveStatus, isLoading: isStatusLoading, refetch } = useGetGoogleDriveStatusQuery();
  const [getConnectUrl] = useLazyGetGoogleDriveConnectUrlQuery();
  const [disconnectDrive, { isLoading: isDisconnecting }] = useDisconnectGoogleDriveMutation();
  const [toggleDrive, { isLoading: isToggling }] = useToggleGoogleDriveMutation();

  const statusPayload = driveStatus?.data || driveStatus;
  const isConnected = Boolean(statusPayload?.connected);
  const isEnabled = statusPayload?.enabled !== false;
  const accountEmail = statusPayload?.email || null;
  const rootFolder = 'Personal AI Agent';
  const connectedAt = statusPayload?.connectedAt
    ? new Date(statusPayload.connectedAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    : null;

  const handleToggleEnabled = async (_event, checked) => {
    try {
      await toggleDrive({ enabled: checked }).unwrap();
      toast.success(`Google Drive integration ${checked ? 'enabled' : 'paused'}.`);
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to update Google Drive integration setting.');
    }
  };

  // Back-Forward Cache (bfcache) and Window Focus Listener to auto-reset in-flight state
  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) {
        setIsConnecting(false);
      }
    };
    const handleWindowFocus = () => {
      // Auto-unlock button when user switches back to this tab
      setIsConnecting(false);
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  // Listen for OAuth redirect parameters and refresh status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('google_auth');
    if (!authStatus) return;

    if (authStatus === 'success') {
      toast.success('Google Drive connected successfully!');
      refetch();
    } else if (authStatus === 'error') {
      const err = params.get('error') || 'Failed to authenticate with Google.';
      if (err.toLowerCase().includes('access_denied')) {
        toast.error('Google authorization denied (Error 403). While in testing mode, your Google account must be added to the developer\'s Google Cloud Console "Test users" list.');
      } else {
        toast.error(`Google connection failed: ${err}`);
      }
    }
    const newUrl = window.location.pathname + (params.get('tab') ? `?tab=${params.get('tab')}` : '');
    window.history.replaceState({}, document.title, newUrl);
  }, [refetch]);

  /**
   * Initiates Google OAuth consent screen redirect.
   */
  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const res = await getConnectUrl().unwrap();
      const authUrl = res?.data?.authUrl || res?.data?.url || res?.authUrl || res?.url;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        toast.error('Failed to generate Google authorization link.');
        setIsConnecting(false);
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to initiate Google connection.');
      setIsConnecting(false);
    }
  };

  /**
   * Disconnects Google Drive integration.
   */
  const handleConfirmDisconnect = async () => {
    try {
      await disconnectDrive().unwrap();
      setIsConfirmOpen(false);
      toast.success('Google Drive disconnected successfully.');
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to disconnect Google Drive.');
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', py: 2 }}>
      {/* Primary Integration Card */}
      <Card
        variant="outlined"
        sx={{
          borderRadius: '12px',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: isConnected ? 'success.light' : 'divider',
          transition: 'all 0.2s ease',
          boxShadow: 'none',
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          {/* Header Strip */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  bgcolor: (theme) =>
                    isConnected
                      ? theme.palette.mode === 'dark'
                        ? 'rgba(46, 125, 50, 0.2)'
                        : 'rgba(46, 125, 50, 0.1)'
                      : theme.palette.action.hover,
                  color: isConnected ? 'success.main' : 'text.secondary',
                }}
              >
                {isConnected ? <CloudDoneIcon fontSize="medium" /> : <CloudQueueIcon fontSize="medium" />}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.2 }}>
                  Google Drive & Cloud Documents
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.775rem' }}>
                  Cloud workspace storage, native Google Docs, and Google Sheets authoring
                </Typography>
              </Box>
            </Box>

            {/* Status Chip */}
            {isStatusLoading ? (
              <CircularProgress size={18} thickness={5} />
            ) : (
              <Chip
                label={isConnected ? 'Connected' : 'Disconnected'}
                color={isConnected ? 'success' : 'default'}
                variant={isConnected ? 'filled' : 'outlined'}
                size="small"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 24,
                  px: 0.5,
                }}
              />
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Body Content */}
          {isConnected ? (
            <Stack spacing={2}>
              <Typography variant="body2" sx={{ color: 'text.primary', fontSize: '0.875rem' }}>
                Your Google Drive workspace is active. Your Personal AI Agent can autonomously author native Google
                Docs, Google Sheets, and organize operational documents directly inside your account.
              </Typography>

              {/* Integration Enable/Disable Toggle Card */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1.5,
                  borderRadius: '8px',
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                  border: 1,
                  borderColor: isEnabled ? 'success.main' : 'divider',
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    Workspace Agent Access
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    {isEnabled
                      ? 'Autonomous authoring of Google Docs, Sheets, and file management is active.'
                      : 'Google Drive integration is temporarily paused. The agent will not access your Drive.'}
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isEnabled}
                      onChange={handleToggleEnabled}
                      disabled={isToggling}
                      color="success"
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {isEnabled ? 'Active' : 'Paused'}
                    </Typography>
                  }
                  sx={{ m: 0 }}
                />
              </Box>

              {/* Connected Details Grid */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: '8px',
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  border: 1,
                  borderColor: 'divider',
                  minWidth: 0,
                }}
              >
                <Grid container spacing={2}>
                  {/* Account Email */}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                      Connected Account
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                      <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main', flexShrink: 0 }} />
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          wordBreak: 'break-all',
                          minWidth: 0,
                        }}
                      >
                        {accountEmail || 'Authorized Account'}
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Root Workspace Folder */}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                      Default Workspace Folder
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                      <FolderIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          wordBreak: 'break-word',
                          minWidth: 0,
                        }}
                      >
                        {rootFolder}
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Scopes */}
                  <Grid size={12}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      Active OAuth Permissions
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        width: '100%',
                        minWidth: 0,
                      }}
                    >
                      <Chip
                        label="Google Drive Files (drive.file)"
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: '0.7rem',
                          maxWidth: '100%',
                          height: 'auto',
                          py: 0.25,
                          '& .MuiChip-label': { whiteSpace: 'normal', wordBreak: 'break-word' },
                        }}
                      />
                      <Chip
                        label="Google Docs (documents)"
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: '0.7rem',
                          maxWidth: '100%',
                          height: 'auto',
                          py: 0.25,
                          '& .MuiChip-label': { whiteSpace: 'normal', wordBreak: 'break-word' },
                        }}
                      />
                      <Chip
                        label="Google Sheets (spreadsheets)"
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: '0.7rem',
                          maxWidth: '100%',
                          height: 'auto',
                          py: 0.25,
                          '& .MuiChip-label': { whiteSpace: 'normal', wordBreak: 'break-word' },
                        }}
                      />
                    </Box>
                  </Grid>

                  {/* Connection Date */}
                  {connectedAt && (
                    <Grid size={12}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Connected on {connectedAt}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 1 }}>
                <MuiButton
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<LinkOffIcon />}
                  onClick={() => setIsConfirmOpen(true)}
                  disabled={isDisconnecting}
                >
                  Disconnect Google Drive
                </MuiButton>
              </Box>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Connect your Google Drive account to empower your Personal AI Agent to save generated spreadsheets,
                business reports, project summaries, and resumes directly to your dedicated cloud workspace.
              </Typography>

              <Box
                sx={{
                  p: 2,
                  borderRadius: '8px',
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75, fontWeight: 600 }}>
                  What you get when connected:
                </Typography>
                <Stack spacing={0.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                    <Typography variant="caption" sx={{ color: 'text.primary', fontSize: '0.8rem' }}>
                      Dedicated <strong>Personal AI Agent</strong> cloud root folder automatically provisioned.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                    <Typography variant="caption" sx={{ color: 'text.primary', fontSize: '0.8rem' }}>
                      Direct conversational authoring of collaborative Google Docs and Google Sheets.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                    <Typography variant="caption" sx={{ color: 'text.primary', fontSize: '0.8rem' }}>
                      Automatic silent token refresh with zero interruptions during active streaming.
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              {/* Testing Mode Guidance Alert */}
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
                  Google Cloud Sensitive Scopes Notice (Development Testing Mode):
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.8rem' }}>
                  Connecting Google Drive requests sensitive scopes (<code>drive.file</code>, <code>documents</code>, <code>spreadsheets</code>). While the OAuth application is in &quot;Testing&quot; mode, your Google account must be explicitly added to the developer&apos;s <strong>Google Cloud Console &gt; Test users</strong> list. If you see <em>Error 403: access_denied</em>, ensure your email address has been whitelisted.
                </Typography>
              </Alert>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, pt: 1 }}>
                <MuiButton
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={isConnecting ? <CircularProgress size={16} color="inherit" /> : <AddLinkIcon />}
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect Google Drive'}
                </MuiButton>
                {isConnecting && (
                  <MuiButton
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => setIsConnecting(false)}
                  >
                    Cancel
                  </MuiButton>
                )}
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <MuiConfirmDialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDisconnect}
        title="Disconnect Google Drive"
        message="Are you sure you want to disconnect Google Drive? Your Personal AI Agent will no longer be able to save documents or create spreadsheets directly in your cloud workspace."
        confirmText="Disconnect"
        confirmColor="error"
        loading={isDisconnecting}
      />
    </Box>
  );
};

export default CloudIntegrationsTab;
