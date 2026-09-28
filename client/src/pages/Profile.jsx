/**
 * @module pages/Profile
 * @description Supervisor profile and settings view placeholder.
 */

import { Link } from 'react-router';
import Button from '@mui/material/Button';
import PersonIcon from '@mui/icons-material/Person';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';

/**
 * Supervisor profile and settings view placeholder.
 *
 * @component Profile
 * @returns {JSX.Element} Rendered profile page view.
 */
export const Profile = () => {
  return (
    <MuiEmptyState
      icon={<PersonIcon sx={{ fontSize: 64 }} />}
      title="Supervisor Profile & Account Settings"
      subtitle="Supervisor name customization, virtual fullName preview, dedicated avatar updates, and password security controls will be mounted here in Milestone 7."
      action={
        <Button variant="outlined" component={Link} to="/dashboard">
          Back to Dashboard
        </Button>
      }
    />
  );
};

export default Profile;
