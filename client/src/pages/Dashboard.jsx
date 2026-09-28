/**
 * @module pages/Dashboard
 * @description Operational dashboard view with MuiEmptyState placeholder.
 */

import { Link } from 'react-router';
import Button from '@mui/material/Button';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';

/**
 * Operational dashboard view placeholder displaying summary empty state.
 *
 * @component Dashboard
 * @returns {JSX.Element} Rendered dashboard page view.
 */
export const Dashboard = () => {
  return (
    <MuiEmptyState
      icon={<DashboardIcon sx={{ fontSize: 64 }} />}
      title="Operational Dashboard"
      subtitle="Operational KPI cards, branch breakdown charts (@mui/x-charts), and recent shift reports will be mounted here in Milestone 7."
      action={
        <Button variant="contained" component={Link} to="/chat">
          Start Shift Inspection
        </Button>
      }
    />
  );
};

export default Dashboard;
