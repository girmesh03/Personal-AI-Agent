/**
 * @module components/reusable/MuiTextField
 * @description Standardized Material-UI TextField wrapper with reserved helperText space and password toggle.
 */

import { useState, useCallback, useMemo, forwardRef } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PropTypes from 'prop-types';

/**
 * Standard text field wrapper reserving helperText space to prevent form layout shifts.
 * Includes built-in password visibility toggle and forwardRef integration for react-hook-form.
 *
 * @component MuiTextField
 * @param {object} props - Component properties.
 * @param {string} [props.type='text'] - Input type ('text', 'password', 'email', etc.).
 * @param {import('react').ReactNode} [props.startAdornment] - Leading icon or input adornment.
 * @param {import('react').ReactNode} [props.endAdornment] - Trailing icon or input adornment.
 * @param {object} [props.slotProps] - Custom slot props merged with internal input slot.
 * @param {string} [props.helperText] - Helper or validation error message text.
 * @param {import('react').Ref<HTMLInputElement>} ref - Forwarded reference to the native input element.
 * @returns {JSX.Element} Rendered Material-UI TextField element.
 */
export const MuiTextField = forwardRef(
  (
    {
      type = 'text',
      startAdornment,
      endAdornment,
      slotProps,
      helperText,
      ...rest
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const togglePassword = useCallback(() => setShowPassword((v) => !v), []);
    const isPassword = type === 'password';

    /** Eye toggle keeps focus: onMouseDown prevents default blur. */
    const eyeSlot = useMemo(
      () =>
        isPassword ? (
          <InputAdornment position="end">
            <IconButton
              size="small"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={togglePassword}
              onMouseDown={(event) => event.preventDefault()}
              edge="end"
              sx={{ mr: 0.5 }}
            >
              {showPassword ? (
                <VisibilityOff fontSize="small" />
              ) : (
                <Visibility fontSize="small" />
              )}
            </IconButton>
          </InputAdornment>
        ) : null,
      [isPassword, showPassword, togglePassword],
    );

    /** Stable input slot so keystrokes never rebuild the subtree. */
    const inputSlot = useMemo(
      () => ({
        startAdornment: startAdornment ? (
          <InputAdornment position="start">{startAdornment}</InputAdornment>
        ) : undefined,
        endAdornment: eyeSlot ?? endAdornment,
        ...slotProps?.input,
      }),
      [startAdornment, eyeSlot, endAdornment, slotProps],
    );

    return (
      <TextField
        ref={ref}
        inputRef={ref}
        type={isPassword && showPassword ? 'text' : type}
        size="small"
        fullWidth
        helperText={helperText ?? ' '}
        slotProps={{ ...slotProps, input: inputSlot }}
        {...rest}
      />
    );
  },
);

MuiTextField.displayName = 'MuiTextField';

MuiTextField.propTypes = {
  type: PropTypes.string,
  startAdornment: PropTypes.node,
  endAdornment: PropTypes.node,
  slotProps: PropTypes.object,
  helperText: PropTypes.node,
};

export default MuiTextField;
