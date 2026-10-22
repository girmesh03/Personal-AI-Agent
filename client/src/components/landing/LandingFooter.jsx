/**
 * @module components/landing/LandingFooter
 * @description Minimalist public footer for the Personal AI Agent platform.
 */

import { memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

/**
 * Public landing page footer.
 *
 * @component LandingFooter
 * @returns {JSX.Element} Rendered Footer.
 */
export const LandingFooter = memo(() => {
  return (
    <Box sx={{ mt: 'auto', pt: 4, pb: 4 }}>
      <Divider sx={{ mb: 4 }} />
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          textAlign: { xs: 'center', sm: 'left' },
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          &copy; {new Date().getFullYear()} Personal AI Agent. All rights reserved.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Personal AI Agent Platform v2.0
          </Typography>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />
          <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
            Systems Operational
          </Typography>
        </Box>
      </Box>
    </Box>
  );
});

export default LandingFooter;
