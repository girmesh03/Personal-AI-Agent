/**
 * @module pages/Login
 * @description Supervisor login page scaffold.
 */

import { Link } from 'react-router';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

/**
 * Supervisor login page presenting authentication form card.
 *
 * @component Login
 * @returns {JSX.Element} Rendered login page presentation.
 */
export const Login = () => {
  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Paper elevation={1} sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
        <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.dark', mb: 2 }}>
          <LockOutlinedIcon />
        </Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Sign In
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Access your supervisor dashboard and shift reports.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
          Login form will be connected to react-hook-form in Phase 4.
        </Typography>
        <Button component={Link} to="/register" variant="text" size="small">
          Don't have an account? Register
        </Button>
      </Paper>
    </Container>
  );
};

export default Login;
