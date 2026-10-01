/**
 * @module components/reusable/MuiEmptyState
 * @description Standardized, reusable visual empty state placeholder component.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import PropTypes from 'prop-types';

/**
 * Standardized visual empty state component conforming to Section 10.8 & Section 14.4.
 * Renders an elevated/outlined container with a centered icon badge, primary headline,
 * descriptive context text, and an optional call-to-action control.
 *
 * @component MuiEmptyState
 * @param {object} props - Component properties.
 * @param {import('react').ReactNode} [props.icon] - MUI icon element displayed in the circular badge.
 * @param {string|import('react').ReactNode} props.title - Primary title or headline text.
 * @param {string|import('react').ReactNode} [props.description] - Explanatory message for empty or pending state.
 * @param {string|import('react').ReactNode} [props.subtitle] - Alias for description message.
 * @param {import('react').ReactNode} [props.action] - Optional call-to-action button or interactive element.
 * @param {object} [props.sx] - Optional Material-UI sx styling overrides.
 * @returns {JSX.Element} Rendered empty state presentation.
 */
export const MuiEmptyState = ({ icon, title, description, subtitle, action, sx = {} }) => {
  const messageText = description || subtitle;

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        p: { xs: 3, sm: 5 },
        borderRadius: 2,
        border: '1px dashed',
        borderColor: 'divider',
        ...sx,
      }}
    >
      {icon && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: '50%',
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            color: 'primary.main',
            mb: 2,
          }}
        >
          {icon}
        </Box>
      )}

      {title && (
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          {title}
        </Typography>
      )}

      {messageText && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 460, mb: action ? 3 : 0, lineHeight: 1.6 }}
        >
          {messageText}
        </Typography>
      )}

      {action && <Box sx={{ mt: messageText ? 0 : 2 }}>{action}</Box>}
    </Paper>
  );
};

MuiEmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  subtitle: PropTypes.node,
  action: PropTypes.node,
  sx: PropTypes.object,
};

export default MuiEmptyState;
