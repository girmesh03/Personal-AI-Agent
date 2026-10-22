/**
 * @module components/landing/LandingHero
 * @description Hero presentation section for the Personal AI Agent public landing page.
 * Responsive with full-width stacked CTAs on mobile screens (xs: 375px).
 */

import { memo } from 'react';
import { Link } from 'react-router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LoginIcon from '@mui/icons-material/Login';
import MuiButton from '../reusable/MuiButton.jsx';
import { ROUTES } from '../../utils/constants.js';

/**
 * Public landing page hero banner.
 *
 * @component LandingHero
 * @returns {JSX.Element} Rendered Hero Banner.
 */
export const LandingHero = memo(() => {
  return (
    <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 10 } }}>
      {/* Product Tag */}
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Chip
          icon={<SmartToyOutlinedIcon fontSize="small" />}
          label="Personal AI Agent Platform"
          color="primary"
          variant="outlined"
          sx={{ fontWeight: 700, fontSize: '0.8rem', py: 0.5, px: 0.5 }}
        />
      </Box>

      {/* Main Hero Headline */}
      <Typography
        variant="h1"
        component="h1"
        sx={{
          fontWeight: 900,
          fontSize: { xs: '2.1rem', sm: '3.2rem', md: '4rem' },
          lineHeight: { xs: 1.15, sm: 1.1 },
          letterSpacing: '-0.03em',
          mb: 3,
        }}
      >
        Your Autonomous Personal AI Agent <br />
        <Box component="span" sx={{ color: 'primary.main' }}>
          & Executive Operations Partner
        </Box>
      </Typography>

      {/* Value Proposition Description */}
      <Typography
        variant="body1"
        sx={{
          color: 'text.secondary',
          maxWidth: 720,
          mx: 'auto',
          fontSize: { xs: '1rem', sm: '1.15rem' },
          lineHeight: 1.6,
          mb: { xs: 4, sm: 5 },
        }}
      >
        Empowering supervisors, leaders, and professionals across all dimensions of organizational
        planning, operational audits, and corporate communications with real-time speech narration
        and streaming intelligence.
      </Typography>

      {/* Primary Action Buttons (Stacked full-width on xs: 375px) */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'center', alignItems: 'stretch', maxWidth: { xs: 320, sm: 'none' }, mx: 'auto' }}
      >
        <MuiButton
          component={Link}
          to={ROUTES.REGISTER}
          variant="contained"
          size="medium"
          endIcon={<ArrowForwardIcon fontSize="small" />}
          sx={{
            py: 1.5,
            px: 3.5,
            fontWeight: 700,
            fontSize: '0.95rem',
            borderRadius: '8px',
          }}
        >
          Get Started Free
        </MuiButton>

        <MuiButton
          component={Link}
          to={ROUTES.LOGIN}
          variant="outlined"
          size="medium"
          startIcon={<LoginIcon fontSize="small" />}
          sx={{
            py: 1.5,
            px: 3.5,
            fontWeight: 700,
            fontSize: '0.95rem',
            borderRadius: '8px',
          }}
        >
          Sign In to Workspace
        </MuiButton>
      </Stack>
    </Box>
  );
});

export default LandingHero;
