/**
 * @module pages/NotFound
 * @description Fully functional 404 Not Found error page with vector SVG illustration,
 * context-aware destination recovery (Dashboard vs Home), and previous view rewind.
 */

import { Link, useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MuiButton from '../components/reusable/MuiButton.jsx';
import { selectIsAuthenticated } from '../redux/features/authSlice.js';
import { ROUTES } from '../utils/constants.js';
import notFoundSvg from '../assets/notFound_404.svg';

/**
 * 404 Not Found error page with SVG illustration and context-aware recovery actions.
 *
 * @component NotFound
 * @returns {JSX.Element} Rendered 404 error page view.
 */
export const NotFound = () => {
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const destinationRoute = isAuthenticated ? ROUTES.DASHBOARD : ROUTES.LANDING;
  const destinationLabel = isAuthenticated ? 'Back to Dashboard' : 'Back to Home';
  const DestinationIcon = isAuthenticated ? DashboardIcon : HomeIcon;

  return (
    <Container
      maxWidth="md"
      sx={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: { xs: 6, sm: 10 },
        textAlign: 'center',
      }}
    >
      <Box
        component="img"
        src={notFoundSvg}
        alt="404 Page Not Found"
        sx={{
          width: '100%',
          maxWidth: { xs: 280, sm: 380, md: 440 },
          height: 'auto',
          mb: 4,
          userSelect: 'none',
        }}
      />

      <Typography variant="h4" fontWeight={700} color="text.primary" gutterBottom>
        Page Not Found
      </Typography>

      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ maxWidth: 520, mb: 4, lineHeight: 1.6 }}
      >
        The page or operational view you are looking for does not exist, has been relocated,
        or the URL may contain a typo.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
          width: { xs: '100%', sm: 'auto' },
          justifyContent: 'center',
        }}
      >
        <MuiButton
          component={Link}
          to={destinationRoute}
          variant="contained"
          size="small"
          startIcon={<DestinationIcon />}
          sx={{ px: 3, py: 1 }}
        >
          {destinationLabel}
        </MuiButton>

        <MuiButton
          variant="outlined"
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ px: 3, py: 1 }}
        >
          Go Back
        </MuiButton>
      </Box>
    </Container>
  );
};

export default NotFound;
