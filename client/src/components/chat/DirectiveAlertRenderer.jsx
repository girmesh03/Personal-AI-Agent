/**
 * @module components/chat/DirectiveAlertRenderer
 * @description In-canvas notification card for autonomous supervisor directive updates.
 * Renders visual confirmation when the AI agent persists custom rules or vocabulary
 * to MongoDB Atlas via the save_supervisor_directive tool.
 */

import PropTypes from 'prop-types';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';

/**
 * Operon Directive Alert Renderer Component.
 *
 * @component DirectiveAlertRenderer
 * @param {object} props - Component props.
 * @param {object} [props.directive] - Persisted directive data.
 * @param {string} [props.directive.scope] - Directive scope.
 * @param {string} [props.directive.instruction] - Rule or directive text.
 * @param {string} [props.directive.category] - Directive category.
 * @returns {import('react').JSX.Element|null} Rendered component.
 */
export const DirectiveAlertRenderer = ({ directive }) => {
  if (!directive) {
    return null;
  }

  const { scope = 'General', instruction = '', category = '' } = directive;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        my: 1.5,
        borderRadius: 2,
        borderColor: 'primary.main',
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
      }}
    >
      <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 20, mt: 0.25 }} />
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Supervisor Directive Learned
          </Typography>
          <Chip
            label={scope}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
          />
          {category && (
            <Chip
              label={category}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Box>

        {instruction && (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', mb: 0.5 }}>
            &ldquo;{instruction}&rdquo;
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <BookmarkAddedIcon sx={{ fontSize: 14, color: 'success.main' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Saved to cloud profile • Active across all future sessions
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

DirectiveAlertRenderer.propTypes = {
  directive: PropTypes.shape({
    scope: PropTypes.string,
    instruction: PropTypes.string,
    category: PropTypes.string,
  }),
};

export default DirectiveAlertRenderer;
