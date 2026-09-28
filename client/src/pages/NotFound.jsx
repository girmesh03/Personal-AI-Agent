/**
 * @module pages/NotFound
 * @description 404 Not Found error page with navigation recovery.
 */

import { Link } from 'react-router';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';

/**
 * 404 Not Found error page with navigation recovery action.
 *
 * @component NotFound
 * @returns {JSX.Element} Rendered 404 error page view.
 */
export const NotFound = () => {
  return (
    <Container maxWidth="sm" sx={{ py: 12 }}>
      <MuiEmptyState
        icon={<SearchOffIcon sx={{ fontSize: 64 }} />}
        title="Page Not Found"
        subtitle="The page you are looking for does not exist or has been moved."
        action={
          <Button component={Link} to="/" variant="contained">
            Back to Home
          </Button>
        }
      />
    </Container>
  );
};

export default NotFound;
