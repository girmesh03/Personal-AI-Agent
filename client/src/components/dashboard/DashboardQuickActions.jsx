/**
 * @module components/dashboard/DashboardQuickActions
 * @description Quick action toolbar mounted at the top of the executive operational dashboard.
 * Supports primary shortcuts: "Start Inspection" (Chat) and "Add Branch" (Branches directory).
 * Implements mandatory mobile iconification at xs (<600px, 375px) via tooltips and icon buttons.
 */

import { memo } from 'react';
import { Link } from 'react-router';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import ChatIcon from '@mui/icons-material/Chat';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import MuiButton from '../reusable/MuiButton.jsx';

/**
 * Top dashboard quick actions strip with responsive mobile iconification.
 *
 * @component DashboardQuickActions
 * @returns {JSX.Element} Rendered action bar.
 */
export const DashboardQuickActions = memo(() => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, sm: 1.5 },
      }}
    >
      <Tooltip title="Start Inspection in Chat" enterDelay={500}>
        <MuiButton
          variant="contained"
          component={Link}
          to="/chat"
          startIcon={<ChatIcon />}
          sx={{
            minWidth: { xs: 42, sm: 'auto' },
            px: { xs: 1, sm: 2 },
            '& .MuiButton-startIcon': {
              mr: { xs: 0, sm: 1 },
              ml: { xs: 0, sm: -0.5 },
            },
          }}
          aria-label="Start Inspection in Chat"
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Start Inspection
          </Box>
        </MuiButton>
      </Tooltip>

      <Tooltip title="Manage / Add Operational Branch" enterDelay={500}>
        <MuiButton
          variant="outlined"
          component={Link}
          to="/branches"
          startIcon={<AddBusinessIcon />}
          sx={{
            minWidth: { xs: 42, sm: 'auto' },
            px: { xs: 1, sm: 2 },
            borderColor: 'divider',
            bgcolor: 'background.paper',
            '& .MuiButton-startIcon': {
              mr: { xs: 0, sm: 1 },
              ml: { xs: 0, sm: -0.5 },
            },
          }}
          aria-label="Manage Branches"
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Add Branch
          </Box>
        </MuiButton>
      </Tooltip>
    </Box>
  );
});

DashboardQuickActions.displayName = 'DashboardQuickActions';

export default DashboardQuickActions;
