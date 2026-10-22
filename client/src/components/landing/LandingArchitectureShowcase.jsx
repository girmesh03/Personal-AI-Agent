/**
 * @module components/landing/LandingArchitectureShowcase
 * @description Architecture and integration showcase highlighting Google Workspace,
 * Telegram broadcast, and cookie-first tenant isolation for Personal AI Agent.
 */

import { memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import SendIcon from '@mui/icons-material/Send';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';

const INTEGRATION_ITEMS = Object.freeze([
  {
    id: 'google_workspace',
    title: 'Google Workspace Sync',
    tag: 'Cloud Export Engine',
    description:
      'Direct integration with Google Drive and Google Docs. Every finalized report can be archived directly to your "Personal AI Agent" root drive folder with zero friction.',
    icon: <CloudQueueIcon sx={{ fontSize: 28, color: 'primary.main' }} />,
  },
  {
    id: 'telegram_broadcast',
    title: 'Telegram Broadcast',
    tag: 'Instant Distribution',
    description:
      'Dispatch synthesized corporate inspection briefs directly to dedicated management, maintenance, or general operational Telegram channels in clean text or 2K image card formats.',
    icon: <SendIcon sx={{ fontSize: 28, color: 'info.main' }} />,
  },
  {
    id: 'security_privacy',
    title: 'Cookie-First Security',
    tag: 'Single-User Isolation',
    description:
      'Stateless HTTP-only cookie authentication, zero client-side JWT persistence, and complete single-user multi-tenant data isolation backed by atomic ACID transactions.',
    icon: <SecurityOutlinedIcon sx={{ fontSize: 28, color: 'success.main' }} />,
  },
]);

/**
 * Architecture and integration highlights showcase.
 *
 * @component LandingArchitectureShowcase
 * @returns {JSX.Element} Rendered Architecture Showcase.
 */
export const LandingArchitectureShowcase = memo(() => {
  return (
    <Box sx={{ mb: { xs: 8, md: 10 } }}>
      <Paper
        variant="outlined"
        sx={{
          borderRadius: '16px',
          p: { xs: 3, sm: 5 },
          bgcolor: 'background.paper',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Enterprise Foundation
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
            Connected, Reliable, and Secure
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {INTEGRATION_ITEMS.map((item) => (
            <Grid size={{ xs: 12, md: 4 }} key={item.id}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: '8px',
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.25 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, display: 'block', mb: 0.75 }}>
                    {item.tag}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                    {item.description}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );
});

export default LandingArchitectureShowcase;
