/**
 * @module pages/Branches
 * @description Branch network directory view placeholder.
 */

import { Link } from 'react-router';
import Button from '@mui/material/Button';
import StorefrontIcon from '@mui/icons-material/Storefront';
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
      icon={<StorefrontIcon sx={{ fontSize: 64 }} />}
      title="Branch Network Directory"
      subtitle="Directory of 14 Enjoy Burger branches, manager profiles, and physical locations will be mounted here in Milestone 2."
      action={
        <Button variant="outlined" component={Link} to="/dashboard">
          Back to Dashboard
        </Button>
      }
    />
  );
};

export default Branches;
