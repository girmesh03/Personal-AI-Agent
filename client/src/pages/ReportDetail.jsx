/**
 * @module pages/ReportDetail
 * @description Report detail view placeholder.
 */

import { Link } from 'react-router';
import Button from '@mui/material/Button';
import ArticleIcon from '@mui/icons-material/Article';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';

/**
 * Report detail view placeholder displaying immutable shift synthesis.
 *
 * @component ReportDetail
 * @returns {JSX.Element} Rendered report detail page view.
 */
export const ReportDetail = () => {
  return (
    <MuiEmptyState
      icon={<ArticleIcon sx={{ fontSize: 64 }} />}
      title="Report Detail View"
      subtitle="Full immutable report view with audit timestamps, branch shift breakdown, and 4 manual delivery triggers will be displayed here in Milestone 7."
      action={
        <Button variant="outlined" component={Link} to="/reports">
          Back to Reports
        </Button>
      }
    />
  );
};

export default ReportDetail;
