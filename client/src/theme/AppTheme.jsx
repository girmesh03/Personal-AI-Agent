/**
 * @module theme/AppTheme
 * @description Root Material UI ThemeProvider integrating design tokens, CSS variables, and component customizations.
 */
import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import {
  inputsCustomizations,
  dataDisplayCustomizations,
  feedbackCustomizations,
  navigationCustomizations,
  surfacesCustomizations,
  chartsCustomizations,
  dataGridCustomizations,
  datePickersCustomizations,
} from './customizations';

import { colorSchemes, typography, shadows, shape } from './themePrimitives';

/**
 * Top-level Material UI Theme Provider component.
 * Configures MUI v6 CSS variables, color schemes, typography, and component overrides.
 *
 * @component
 * @param {object} props - Component properties.
 * @param {React.ReactNode} props.children - Child components to wrap.
 * @returns {JSX.Element} The theme provider wrapping children with CssBaseline.
 */
export const AppTheme = ({ children }) => {
  const theme = useMemo(
    () =>
      createTheme({
        cssVariables: {
          colorSchemeSelector: 'data-mui-color-scheme',
          cssVarPrefix: 'template',
        },
        colorSchemes,
        typography,
        shadows,
        shape,
        components: {
          ...inputsCustomizations,
          ...dataDisplayCustomizations,
          ...feedbackCustomizations,
          ...navigationCustomizations,
          ...surfacesCustomizations,
          ...chartsCustomizations,
          ...dataGridCustomizations,
          ...datePickersCustomizations,
        },
      }),
    []
  );

  return (
    <ThemeProvider theme={theme} disableTransitionOnChange>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
};

AppTheme.propTypes = {
  children: PropTypes.node,
};

export default AppTheme;
