/**
 * @module components/reusable/MuiButton
 * @description Standardized Material-UI button wrapper component.
 */

import Button from '@mui/material/Button';
import PropTypes from 'prop-types';

/**
 * Standard button wrapper enforcing flex-shrink guard and default sizing.
 *
 * @component MuiButton
 * @param {object} props - Component properties.
 * @param {string} [props.size='small'] - Button size variant.
 * @param {object} [props.sx] - Material-UI sx style overrides.
 * @returns {JSX.Element} Configured Material-UI button element.
 */
export const MuiButton = ({ size = 'small', sx, ...rest }) => {
  return (
    <Button
      size={size}
      sx={{ flexShrink: 0, ...sx }}
      {...rest}
    />
  );
};

MuiButton.propTypes = {
  size: PropTypes.string,
  sx: PropTypes.object,
};

export default MuiButton;
