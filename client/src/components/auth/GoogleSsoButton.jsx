/**
 * @module components/auth/GoogleSsoButton
 * @description Official Google Identity-compliant Single Sign-On (SSO) button.
 * Adheres strictly to Google Brand Standards with official 4-color SVG logo,
 * authentic typography, theme-aware surface styling, and accessible 44px touch targets.
 */

import { forwardRef } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import PropTypes from 'prop-types';

/**
 * Official Google 4-Color 'G' Logo SVG
 */
const GoogleLogoSvg = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

/**
 * Google Single Sign-On Button Component.
 *
 * @component GoogleSsoButton
 * @param {object} props - Component properties.
 * @param {string} [props.label='Sign in with Google'] - Button call to action text.
 * @param {function} [props.onClick] - Click handler triggering OAuth redirect.
 * @param {boolean} [props.disabled=false] - Whether button is disabled.
 * @param {boolean} [props.isLoading=false] - Whether button shows loading spinner.
 * @returns {JSX.Element} Rendered official Google SSO button.
 */
export const GoogleSsoButton = forwardRef(
  ({ label = 'Sign in with Google', onClick, disabled = false, isLoading = false, ...rest }, ref) => {
    return (
      <Button
        ref={ref}
        fullWidth
        variant="outlined"
        onClick={onClick}
        disabled={disabled || isLoading}
        {...rest}
        sx={(theme) => ({
          minHeight: 44,
          borderRadius: 2,
          textTransform: 'none',
          fontFamily: '"Google Sans", Roboto, sans-serif',
          fontWeight: 500,
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          px: 2,
          transition: 'all 0.15s ease-in-out',
          bgcolor: '#ffffff',
          color: '#1f1f1f',
          borderColor: '#dadce0',
          boxShadow: '0 1px 2px 0 rgba(60,64,67,0.30)',
          '&:hover': {
            bgcolor: '#f8f9fa',
            borderColor: '#dadce0',
            boxShadow: '0 1px 3px 0 rgba(60,64,67,0.40)',
          },
          ...theme.applyStyles('dark', {
            bgcolor: '#131314',
            color: '#f1f3f4',
            borderColor: '#8e918f',
            boxShadow: '0 1px 2px 0 rgba(0,0,0,0.30)',
            '&:hover': {
              bgcolor: '#202124',
              borderColor: '#c4c7c5',
              boxShadow: '0 1px 3px 0 rgba(0,0,0,0.50)',
            },
          }),
          '&.Mui-disabled': {
            opacity: 0.6,
          },
          ...(typeof rest.sx === 'function' ? rest.sx(theme) : rest.sx || {}),
        })}
      >
        {isLoading ? (
          <CircularProgress size={18} color="inherit" />
        ) : (
          <>
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
              <GoogleLogoSvg />
            </Box>
            <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
              {label}
            </Box>
          </>
        )}
      </Button>
    );
  }
);

GoogleSsoButton.displayName = 'GoogleSsoButton';

GoogleSsoButton.propTypes = {
  label: PropTypes.string,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
};

export default GoogleSsoButton;
