/**
 * @module layouts/ThemeToggle
 * @description Light/dark mode color scheme toggle button for application navigation bars.
 */

import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useColorScheme } from '@mui/material/styles';

/**
 * Standard color scheme toggle button switching between light and dark modes.
 *
 * @component ThemeToggle
 * @returns {JSX.Element} Rendered color scheme toggle icon button.
 */
export const ThemeToggle = () => {
  const { mode, setMode } = useColorScheme();
  const isLight = mode === 'light';

  return (
    <Tooltip title={isLight ? 'Dark mode' : 'Light mode'}>
      <IconButton
        size="small"
        aria-label="Toggle color scheme"
        onClick={() => setMode(isLight ? 'dark' : 'light')}
      >
        {isLight ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
