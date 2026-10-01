/**
 * @module pages/Landing
 * @description Public landing view introducing the Enjoy Burger Field Supervisor Assistant.
 */

import { Link } from 'react-router';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import MuiButton from '../components/reusable/MuiButton.jsx';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import FastfoodIcon from '@mui/icons-material/Fastfood';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';

import {
  LANDING_FEATURES,
  ROUTES,
} from '../utils/constants.js';

/**
 * Tentative feature highlight icons mapped by identifier with fallback support.
 * @constant
 * @type {Readonly<Record<string, JSX.Element>>}
 */
const FEATURE_ICONS = Object.freeze({
  inspections: <AssignmentOutlinedIcon color="primary" sx={{ fontSize: 36 }} />,
  reporting: <DescriptionOutlinedIcon color="primary" sx={{ fontSize: 36 }} />,
  oversight: <StorefrontOutlinedIcon color="primary" sx={{ fontSize: 36 }} />,
});

const DEFAULT_FEATURE_ICON = <AssignmentOutlinedIcon color="primary" sx={{ fontSize: 36 }} />;

/**
 * Public landing page introducing the application value proposition and quick auth links.
 *
 * @component Landing
 * @returns {JSX.Element} Rendered landing presentation page.
 */
export const Landing = () => {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
      <Box sx={{ textAlign: 'center', mb: 8 }}>
        <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: 'action.hover', mb: 3 }}>
          <FastfoodIcon color="primary" sx={{ fontSize: 56 }} />
        </Box>
        <Typography variant="h2" fontWeight={800} gutterBottom letterSpacing="-0.02em">
          Enjoy Burger Field Supervisor Assistant
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, mx: 'auto', mb: 4, fontSize: '1.1rem' }}>
          Autonomous, single-user operational web platform designed for Area Supervisors to conduct branch inspections, narrate shift updates, and synthesize official corporate reports.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'center' }}>
          <MuiButton component={Link} to={ROUTES.REGISTER} variant="contained" size="small" sx={{ px: 4, py: 1.5 }}>
            Get Started
          </MuiButton>
          <MuiButton component={Link} to={ROUTES.LOGIN} variant="outlined" size="small" sx={{ px: 4, py: 1.5 }}>
            Sign In
          </MuiButton>
        </Stack>
      </Box>

      {/* Feature Highlights */}
      <Grid container spacing={4}>
        {LANDING_FEATURES.map((feature) => (
          <Grid size={{ xs: 12, md: 4 }} key={feature.id}>
            <Paper
              elevation={0}
              sx={{
                p: 4,
                height: '100%',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'inline-flex' }}>
                {FEATURE_ICONS[feature.id] || DEFAULT_FEATURE_ICON}
              </Box>
              <Typography variant="h6" fontWeight={700}>
                {feature.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {feature.description}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default Landing;
