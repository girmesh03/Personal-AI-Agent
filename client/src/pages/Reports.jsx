/**
 * @module pages/Reports
 * @description Operational reports archive view placeholder.
 */

import { toast } from 'react-toastify';
import DescriptionIcon from '@mui/icons-material/Description';
import MuiButton from '../components/reusable/MuiButton.jsx';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';
import { REPORT_CREATION_TBD_MESSAGE } from '../utils/constants.js';

/**
 * Operational reports archive view placeholder.
 *
 * @component Reports
 * @returns {JSX.Element} Rendered reports archive page view.
 */
export const Reports = () => {
  return (
    <MuiEmptyState
      icon={<DescriptionIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />}
      title="Operational Reports Archive"
      subtitle="Master reports registry with @mui/x-data-grid, Ethiopian calendar date filter, and 4 manual delivery triggers will be mounted here in Milestone 7."
      action={
        <MuiButton
          variant="contained"
          size="small"
          onClick={() => toast.info(REPORT_CREATION_TBD_MESSAGE)}
        >
          Create New Report
        </MuiButton>
      }
    />
  );
};

export default Reports;
