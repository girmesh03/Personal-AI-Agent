/**
 * @module pages/BranchDetail
 * @description Branch inspection history view placeholder.
 */

import { Link } from 'react-router';
import StoreIcon from '@mui/icons-material/Store';
import MuiButton from '../components/reusable/MuiButton.jsx';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';

/**
 * Branch inspection history view placeholder.
 *
 * @component BranchDetail
 * @returns {JSX.Element} Rendered branch detail page view.
 */
export const BranchDetail = () => {
  return (
    <MuiEmptyState
      icon={<StoreIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />}
      title="Branch Inspection History"
      subtitle="Historical branch inspection logs, past supervisor visit trends, and recurring issue metrics will be mounted here in Milestone 2."
      action={
        <MuiButton variant="outlined" size="small" component={Link} to="/branches">
          Back to Branches
        </MuiButton>
      }
    />
  );
};

export default BranchDetail;
