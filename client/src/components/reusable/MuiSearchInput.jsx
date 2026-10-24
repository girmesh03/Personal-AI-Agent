/**
 * @module components/reusable/MuiSearchInput
 * @description Zero-lag explicit-trigger search input component strictly adhering to
 * the Zero-Lag Uncontrolled & Explicit-Trigger Law (Invariant 43).
 * Strictly zero debounces and zero react-hook-form watch.
 */

import { useState, useRef, useCallback, memo, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PropTypes from 'prop-types';

/**
 * High-performance, zero-lag search input component.
 * Uses an uncontrolled DOM input reference to handle typing at native hardware speed
 * without triggering React state reconciliations or parent re-renders on keystroke.
 * Dispatches searches exclusively on explicit user triggers:
 *   1. Pressing the Enter key
 *   2. Clicking the Search icon button
 *   3. Clicking the Clear icon button
 *
 * @component MuiSearchInput
 * @param {object} props - Component properties.
 * @param {Function} props.onSearch - Callback invoked with the search query string upon explicit trigger.
 * @param {string} [props.placeholder='Search...'] - Placeholder text.
 * @param {string} [props.initialValue=''] - Initial query value if resuming state.
 * @param {'small'|'medium'} [props.size='small'] - Input size variant.
 * @param {boolean} [props.fullWidth=true] - Whether input fills container width.
 * @param {boolean} [props.disabled=false] - Disabled state flag.
 * @param {boolean} [props.autoFocus=false] - Autofocus flag upon mount.
 * @param {boolean} [props.searchOnBlur=false] - Optional trigger on input blur.
 * @param {object} [props.sx={}] - Style overrides.
 * @returns {JSX.Element} Rendered search input component.
 */
export const MuiSearchInput = memo(({
  onSearch,
  placeholder = 'Search...',
  initialValue = '',
  size = 'small',
  fullWidth = true,
  disabled = false,
  autoFocus = false,
  searchOnBlur = false,
  sx = {},
}) => {
  const inputRef = useRef(null);
  const [hasContent, setHasContent] = useState(Boolean(initialValue));

  // Sync initialValue if provided or updated externally
  useEffect(() => {
    if (inputRef.current && initialValue !== undefined) {
      inputRef.current.value = initialValue;
      setHasContent(Boolean(initialValue));
    }
  }, [initialValue]);

  // Handle explicit search dispatch
  const handleTriggerSearch = useCallback(() => {
    const query = inputRef.current ? inputRef.current.value.trim() : '';
    if (onSearch) {
      onSearch(query);
    }
  }, [onSearch]);

  // Keydown handler: triggers search on Enter key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleTriggerSearch();
      }
    },
    [handleTriggerSearch]
  );

  // Native input change: updates internal hasContent state purely for clear button visibility
  const handleNativeInput = useCallback(() => {
    const currentVal = inputRef.current ? inputRef.current.value : '';
    const nowHasContent = Boolean(currentVal);
    setHasContent((prev) => (prev !== nowHasContent ? nowHasContent : prev));
  }, []);

  // Clear handler: resets input value and dispatches empty search
  const handleClear = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
    setHasContent(false);
    if (onSearch) {
      onSearch('');
    }
  }, [onSearch]);

  // Optional blur trigger
  const handleBlur = useCallback(() => {
    if (searchOnBlur) {
      handleTriggerSearch();
    }
  }, [searchOnBlur, handleTriggerSearch]);

  return (
    <TextField
      inputRef={inputRef}
      defaultValue={initialValue}
      placeholder={placeholder}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      autoFocus={autoFocus}
      onKeyDown={handleKeyDown}
      onInput={handleNativeInput}
      onBlur={handleBlur}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end" sx={{ gap: 0.5 }}>
              {hasContent && (
                <Tooltip title="Clear search">
                  <IconButton
                    size="small"
                    aria-label="Clear search query"
                    onClick={handleClear}
                    edge="end"
                    sx={{ p: 0.5 }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Search (Enter)">
                <IconButton
                  size="small"
                  aria-label="Execute search"
                  onClick={handleTriggerSearch}
                  edge="end"
                  color="primary"
                  sx={{ p: 0.5 }}
                >
                  <SearchIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        },
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
          bgcolor: 'background.paper',
        },
        ...sx,
      }}
    />
  );
});

MuiSearchInput.propTypes = {
  onSearch: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  initialValue: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium']),
  fullWidth: PropTypes.bool,
  disabled: PropTypes.bool,
  autoFocus: PropTypes.bool,
  searchOnBlur: PropTypes.bool,
  sx: PropTypes.object,
};

export default MuiSearchInput;
