/**
 * @module pages/Landing
 * @description Public landing view introducing the Enjoy Burger Field Supervisor Assistant.
 */

import { Link } from 'react-router';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import FastfoodIcon from '@mui/icons-material/Fastfood';

/**
 * Public landing page introducing the application value proposition and quick auth links.
 *
 * @component Landing
 * @returns {JSX.Element} Rendered landing presentation page.
 */
export const Landing = () => {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 8, md: 12 }, textAlign: 'center' }}>
      <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: 'action.hover', mb: 3 }}>
        <FastfoodIcon color="primary" sx={{ fontSize: 56 }} />
      </Box>
      <Typography variant="h2" fontWeight={800} gutterBottom letterSpacing="-0.02em">
        Enjoy Burger Field Supervisor Assistant
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mb: 5, fontSize: '1.1rem' }}>
        Autonomous, single-user operational web platform designed for Area Supervisors to conduct branch inspections, narrate shift updates, and synthesize official corporate reports.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'center' }}>
        <Button component={Link} to="/register" variant="contained" size="large" sx={{ px: 4, py: 1.5 }}>
          Get Started
        </Button>
        <Button component={Link} to="/login" variant="outlined" size="large" sx={{ px: 4, py: 1.5 }}>
          Sign In
        </Button>
      </Stack>
    </Container>
  );
};

export default Landing;
