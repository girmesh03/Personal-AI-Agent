/**
 * @module pages/Landing
 * @description Public landing view for the Personal AI Agent platform.
 * Assembles LandingHero, LandingFeaturesDeck, LandingArchitectureShowcase, and LandingFooter.
 */

import Container from '@mui/material/Container';
import LandingHero from '../components/landing/LandingHero.jsx';
import LandingFeaturesDeck from '../components/landing/LandingFeaturesDeck.jsx';
import LandingArchitectureShowcase from '../components/landing/LandingArchitectureShowcase.jsx';
import LandingFooter from '../components/landing/LandingFooter.jsx';

/**
 * Public landing presentation page.
 *
 * @component Landing
 * @returns {JSX.Element} Rendered landing presentation page.
 */
export const Landing = () => {
  return (
    <Container
      maxWidth="lg"
      sx={{
        py: { xs: 6, sm: 8, md: 10 },
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <LandingHero />
      <LandingFeaturesDeck />
      <LandingArchitectureShowcase />
      <LandingFooter />
    </Container>
  );
};

export default Landing;
