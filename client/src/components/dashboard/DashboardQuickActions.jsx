/**
 * @module components/dashboard/DashboardQuickActions
 * @description Quick action toolbar mounted at the top of the executive operational dashboard.
 * Supports primary shortcuts: "Start Inspection" (Chat) and "Add Branch" (Branches directory).
 * Implements mandatory mobile iconification at xs (<600px, 375px) via tooltips and icon buttons.
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import ChatIcon from '@mui/icons-material/Chat';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import MuiButton from '../reusable/MuiButton.jsx';

/**
 * Top dashboard quick actions strip with responsive full labels and in-place branch modal creation.
 *
 * @component DashboardQuickActions
 * @param {object} props - Component properties.
 * @param {() => void} [props.onAddBranch] - Handler to open in-place branch creation modal.
 * @returns {JSX.Element} Rendered action bar.
 */
export const DashboardQuickActions = memo(({ onAddBranch }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: { xs: 'nowrap', sm: 'nowrap' },
        gap: { xs: 1, sm: 1.5 },
        width: { xs: '100%', sm: 'auto' },
        flexShrink: 0,
      }}
    >
      <Tooltip title="Start Inspection in Chat" enterDelay={500}>
        <MuiButton
          variant="contained"
          component={Link}
          to="/chat"
          startIcon={<ChatIcon />}
          sx={{
            flex: { xs: 1, sm: 'none' },
            height: { xs: 36, sm: 38 },
            px: { xs: 1.25, sm: 2 },
            fontSize: { xs: '0.8125rem', sm: '0.875rem' },
            fontWeight: 700,
            borderRadius: '8px',
            whiteSpace: 'nowrap',
            '& .MuiButton-startIcon': {
              mr: { xs: 0.75, sm: 1 },
              ml: { xs: 0, sm: -0.5 },
            },
          }}
          aria-label="Start Inspection in Chat"
        >
          Start Inspection
        </MuiButton>
      </Tooltip>

      <Tooltip title="Add Operational Branch (In-Place)" enterDelay={500}>
        <MuiButton
          variant="outlined"
          {...(typeof onAddBranch === 'function'
            ? { onClick: onAddBranch }
            : { component: Link, to: '/branches' })}
          startIcon={<AddBusinessIcon />}
          sx={{
            flex: { xs: 1, sm: 'none' },
            height: { xs: 36, sm: 38 },
            px: { xs: 1.25, sm: 2 },
            fontSize: { xs: '0.8125rem', sm: '0.875rem' },
            fontWeight: 700,
            borderRadius: '8px',
            whiteSpace: 'nowrap',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
            '& .MuiButton-startIcon': {
              mr: { xs: 0.75, sm: 1 },
              ml: { xs: 0, sm: -0.5 },
            },
          }}
          aria-label="Add Operational Branch"
        >
          Add Branch
        </MuiButton>
      </Tooltip>
    </Box>
  );
});

DashboardQuickActions.displayName = 'DashboardQuickActions';

DashboardQuickActions.propTypes = {
  onAddBranch: PropTypes.func,
};

export default DashboardQuickActions;
