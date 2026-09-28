/**
 * @module components/reusable/LoadingSpinner
 * @description Standardized loading indicator accepting message, height, and size.
 */

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import PropTypes from 'prop-types';

/**
 * Size mapping presets for CircularProgress pixel dimensions.
 * @constant
 * @type {Record<'small'|'medium'|'large', number>}
 */
const SIZE_MAP = {
  small: 24,
  medium: 36,
  large: 48,
};

/**
 * Centered loading spinner with optional message and customizable geometry.
 *
 * @component LoadingSpinner
 * @param {object} props - Component properties.
 * @param {string} [props.message='Loading...'] - Explanatory message displayed below spinner.
 * @param {string|number} [props.height='100%'] - Minimum height of container box.
 * @param {'small'|'medium'|'large'|number} [props.size='medium'] - Spinner diameter preset or pixel size.
 * @returns {JSX.Element} Rendered spinner container.
 */
export const LoadingSpinner = ({
  message = 'Loading...',
  height = '100%',
  size = 'medium',
}) => {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 36;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: height,
        width: '100%',
        p: 3,
        gap: 2,
      }}
    >
      <CircularProgress size={pixelSize} thickness={4} color="primary" disableShrink />
      {message && (
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          {message}
        </Typography>
      )}
    </Box>
  );
};

LoadingSpinner.propTypes = {
  message: PropTypes.string,
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default LoadingSpinner;
