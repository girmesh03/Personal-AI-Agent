/**
 * @module pages/Profile
 * @description Supervisor profile and settings view placeholder.
 */

import { Link } from 'react-router';
import PersonIcon from '@mui/icons-material/Person';
import MuiButton from '../components/reusable/MuiButton.jsx';
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
      icon={<PersonIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />}
      title="Supervisor Profile & Account Settings"
      subtitle="Supervisor name customization, virtual fullName preview, dedicated avatar updates, and password security controls will be mounted here in Milestone 7."
      action={
        <MuiButton variant="outlined" size="small" component={Link} to="/dashboard">
          Back to Dashboard
        </MuiButton>
      }
    />
  );
};

export default Profile;
