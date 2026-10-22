/**
 * @module components/landing/LandingFeaturesDeck
 * @description Capability pillars deck showcasing Executive Partner, Conversational Canvas,
 * and Operational Oversight capabilities for the Personal AI Agent platform.
 */

import { memo } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';

const CAPABILITY_PILLARS = Object.freeze([
  {
    id: 'executive_partner',
    title: 'Executive Partner & Leadership',
    subtitle: 'Strategic Intelligence',
    description:
      'A multi-dimensional AI partner designed to support team leadership, strategic decision-making, task scheduling, and open-domain problem solving across all professional and personal endeavors.',
    icon: <PsychologyOutlinedIcon sx={{ fontSize: 32 }} />,
    accent: 'primary.main',
  },
  {
    id: 'conversational_canvas',
    title: 'Conversational Synthesis Canvas',
    subtitle: 'Voice & Multimodal Intelligence',
    description:
      'Narrate shift updates naturally with Addis AI Amharic speech-to-text acoustic chunking, watch real-time Gemini streaming reasoning, and attach photos and audio notes for instant analysis.',
    icon: <MicNoneOutlinedIcon sx={{ fontSize: 32 }} />,
    accent: 'info.main',
  },
  {
    id: 'operational_suite',
    title: 'Operational Oversight Suite',
    subtitle: 'Enterprise Control & Delivery',
    description:
      'Full directory oversight across 14 operational branches, zero-approval autonomous operational tools, authoritative corporate Amharic reports, and 5 manual one-click delivery channels.',
    icon: <StorefrontOutlinedIcon sx={{ fontSize: 32 }} />,
    accent: 'success.main',
  },
]);

/**
 * 3-Column capability pillars presentation.
 *
 * @component LandingFeaturesDeck
 * @returns {JSX.Element} Rendered Features Deck.
 */
export const LandingFeaturesDeck = memo(() => {
  return (
    <Box sx={{ mb: { xs: 8, md: 12 } }}>
      <Box sx={{ textAlign: 'center', mb: 5 }}>
        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Core Capabilities
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
          Designed for Operational Excellence
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {CAPABILITY_PILLARS.map((pillar) => (
          <Grid size={{ xs: 12, md: 4 }} key={pillar.id}>
            <Card
              variant="outlined"
              sx={{
                height: '100%',
                borderRadius: '12px',
                bgcolor: 'background.paper',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: pillar.accent,
                  transform: 'translateY(-3px)',
                  boxShadow: (theme) => `0 8px 24px ${theme.palette.action.hover}`,
                },
              }}
            >
              <CardContent sx={{ p: { xs: 2.5, sm: 3.5 }, flexGrow: 1 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1.5,
                    borderRadius: '10px',
                    bgcolor: (theme) => `${theme.palette.primary.main}12`,
                    color: pillar.accent,
                    mb: 2.5,
                  }}
                >
                  {pillar.icon}
                </Box>

                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.5 }}>
                  {pillar.subtitle}
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.2rem', mb: 1.5 }}>
                  {pillar.title}
                </Typography>

                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.65 }}>
                  {pillar.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
});

export default LandingFeaturesDeck;
