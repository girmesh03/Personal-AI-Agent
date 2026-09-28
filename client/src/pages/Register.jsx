/**
 * @module pages/Register
 * @description Supervisor registration page scaffold.
 */

import { Link } from 'react-router';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';

/**
 * Supervisor registration page scaffold.
 *
 * @component Register
 * @returns {JSX.Element} Rendered registration page presentation.
 */
export const Register = () => {
  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Paper elevation={1} sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
        <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.dark', mb: 2 }}>
          <PersonAddOutlinedIcon />
        </Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Create Account
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Register as an Enjoy Burger Area Supervisor.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
          Registration form will be connected to react-hook-form in Phase 4.
        </Typography>
        <Button component={Link} to="/login" variant="text" size="small">
          Already have an account? Sign In
        </Button>
      </Paper>
    </Container>
  );
};

export default Register;
