/**
 * @module components/reusable/MuiTextField
 * @description Standardized Material-UI TextField wrapper supporting start/end adornments and password toggle.
 */

import { useState, useCallback, useMemo, forwardRef, memo } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Clear from '@mui/icons-material/Clear';
import PropTypes from 'prop-types';

/**
 * Standard text field wrapper reserving helperText space to prevent form layout shifts.
 * Includes built-in password visibility toggle and forwardRef integration for react-hook-form.
 * Wrapped with memo and optimized inputRef to ensure zero typing latency.
 *
 * @component MuiTextField
 * @param {object} props - Component properties.
 * @param {string} [props.type='text'] - Input type ('text', 'password', 'email', etc.).
 * @param {boolean} [props.isPassword] - Explicit password toggle flag (or inferred if type='password').
 * @param {import('react').ReactNode} [props.startAdornment] - Leading adornment or icon.
 * @param {import('react').ReactNode} [props.startIcon] - Alias for leading icon.
 * @param {import('react').ReactNode} [props.endAdornment] - Trailing adornment or icon.
 * @param {import('react').ReactNode} [props.endIcon] - Alias for trailing icon.
 * @param {Function} [props.onClear] - Clear input callback.
 * @param {object} [props.slotProps] - Custom slot props merged with internal input slot.
 * @param {string} [props.helperText] - Helper or validation error message text.
 * @param {boolean} [props.error] - Error state boolean.
 * @param {string} [props.size='small'] - Input size variant.
 * @param {boolean} [props.fullWidth=true] - Full width boolean flag.
 * @param {string} [props.variant='outlined'] - TextField variant.
 * @param {import('react').Ref<HTMLInputElement>} [props.inputRef] - Explicit input ref.
 * @param {import('react').Ref<HTMLInputElement>} ref - Forwarded reference to the native input element.
 * @returns {JSX.Element} Rendered Material-UI TextField element.
 */
export const MuiTextField = memo(
  forwardRef((props, ref) => {
    const {
      type = 'text',
      isPassword: explicitIsPassword = false,
      startAdornment,
      startIcon,
      endAdornment,
      endIcon,
      onClear,
      slotProps = {},
      helperText,
      inputRef: customInputRef,
      error = false,
      size = 'small',
      fullWidth = true,
      variant = 'outlined',
      ...rest
    } = props;

    const [showPassword, setShowPassword] = useState(false);
    const togglePassword = useCallback(() => setShowPassword((v) => !v), []);

    const isPassword = explicitIsPassword || type === 'password';
    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type;

    // Resolve ref directly to the native input element for react-hook-form
    const effectiveInputRef = customInputRef || ref || rest.ref;

    // Resolve start adornment: check startAdornment, startIcon, or slotProps.input?.startAdornment
    const rawStart = startAdornment ?? startIcon ?? slotProps.input?.startAdornment;
    const resolvedStartAdornment = useMemo(() => {
      if (!rawStart) return undefined;
      if (rawStart.type === InputAdornment) return rawStart;
      return <InputAdornment position="start">{rawStart}</InputAdornment>;
    }, [rawStart]);

    // Resolve end adornment: password eye toggle > custom clear > endAdornment/endIcon
    const rawEnd = endAdornment ?? endIcon ?? slotProps.input?.endAdornment;
    const resolvedEndAdornment = useMemo(() => {
      if (isPassword) {
        return (
          <InputAdornment position="end">
            <IconButton
              size="small"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={togglePassword}
              onMouseDown={(e) => e.preventDefault()}
              edge="end"
            >
              {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
          </InputAdornment>
        );
      }
      if (onClear && rest.value) {
        return (
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={onClear}
              onMouseDown={(e) => e.preventDefault()}
              edge="end"
              aria-label="Clear input"
            >
              <Clear fontSize="small" />
            </IconButton>
          </InputAdornment>
        );
      }
      if (!rawEnd) return undefined;
      if (rawEnd.type === InputAdornment) return rawEnd;
      return <InputAdornment position="end">{rawEnd}</InputAdornment>;
    }, [isPassword, showPassword, togglePassword, onClear, rest.value, rawEnd]);

    return (
      <TextField
        inputRef={effectiveInputRef}
        type={resolvedType}
        error={error}
        helperText={helperText ?? ' '}
        size={size}
        fullWidth={fullWidth}
        variant={variant}
        slotProps={{
          ...slotProps,
          input: {
            ...slotProps.input,
            startAdornment: resolvedStartAdornment,
            endAdornment: resolvedEndAdornment,
          },
          formHelperText: {
            ...slotProps.formHelperText,
            sx: error
              ? { color: 'error.main', ...slotProps.formHelperText?.sx }
              : slotProps.formHelperText?.sx,
          },
        }}
        {...rest}
      />
    );
  })
);

MuiTextField.displayName = 'MuiTextField';

MuiTextField.propTypes = {
  type: PropTypes.string,
  isPassword: PropTypes.bool,
  startAdornment: PropTypes.node,
  startIcon: PropTypes.node,
  endAdornment: PropTypes.node,
  endIcon: PropTypes.node,
  onClear: PropTypes.func,
  slotProps: PropTypes.object,
  helperText: PropTypes.node,
  error: PropTypes.bool,
  size: PropTypes.string,
  fullWidth: PropTypes.bool,
  variant: PropTypes.string,
  inputRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
};

export default MuiTextField;
