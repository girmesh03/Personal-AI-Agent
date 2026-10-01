/**
 * @module pages/ReportEdit
 * @description Supervised report editor view placeholder.
 */

import { Link } from 'react-router';
import EditNoteIcon from '@mui/icons-material/EditNote';
import MuiButton from '../components/reusable/MuiButton.jsx';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';

/**
 * Supervised report editor view placeholder allowing amendments prior to persistence.
 *
 * @component ReportEdit
 * @returns {JSX.Element} Rendered report editor page view.
 */
export const ReportEdit = () => {
  return (
    <MuiEmptyState
      icon={<EditNoteIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />}
      title="Supervised Report Editor"
      subtitle="Supervised correction interface allowing supervisors to amend timings, tasks, or issues before final persistence will be mounted here in Milestone 7."
      action={
        <MuiButton variant="outlined" size="small" component={Link} to="/reports">
          Back to Reports
        </MuiButton>
      }
    />
  );
};

export default ReportEdit;
