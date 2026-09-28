/**
 * @module pages/Reports
 * @description Operational reports archive view placeholder.
 */

import { Link } from 'react-router';
import Button from '@mui/material/Button';
import DescriptionIcon from '@mui/icons-material/Description';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';

/**
 * Operational reports archive view placeholder.
 *
 * @component Reports
 * @returns {JSX.Element} Rendered reports archive page view.
 */
export const Reports = () => {
  return (
    <MuiEmptyState
      icon={<DescriptionIcon sx={{ fontSize: 64 }} />}
      title="Operational Reports Archive"
      subtitle="Master reports registry with @mui/x-data-grid, Ethiopian calendar date filter, and 4 manual delivery triggers will be mounted here in Milestone 7."
      action={
        <Button variant="contained" component={Link} to="/chat">
          Create New Report
        </Button>
      }
    />
  );
};

export default Reports;
