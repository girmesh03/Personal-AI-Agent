/**
 * @module pages/Branches
 * @description Branch network directory view placeholder.
 */

import { Link } from 'react-router';
import StorefrontIcon from '@mui/icons-material/Storefront';
import MuiButton from '../components/reusable/MuiButton.jsx';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';

/**
 * Branch network directory view placeholder displaying empty state.
 *
 * @component Branches
 * @returns {JSX.Element} Rendered branch network page view.
 */
export const Branches = () => {
  return (
    <MuiEmptyState
      icon={<StorefrontIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />}
      title="Branch Network Directory"
      subtitle="Directory of 14 Enjoy Burger branches, manager profiles, and physical locations will be mounted here in Milestone 2."
      action={
        <MuiButton variant="outlined" size="small" component={Link} to="/dashboard">
          Back to Dashboard
        </MuiButton>
      }
    />
  );
};

export default Branches;
