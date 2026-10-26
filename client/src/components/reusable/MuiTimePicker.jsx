/**
 * @module components/reusable/MuiTimePicker
 * @description Universal, production-grade Material-UI 24-hour time picker wrapping official
 * MUI X TimePicker (@mui/x-date-pickers/TimePicker).
 * Renders a native Button (no TextField) with right-docked Clear button, and inherits 100% of styling from AppTheme.
 */

import React, { useState, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';

/**
 * Universal 24-Hour MuiTimePicker component wrapping official MUI X TimePicker.
 *
 * @component MuiTimePicker
 * @param {object} props - Component properties.
 * @param {string|Date|object} [props.value=''] - Time string in "HH:mm" 24-hour format or Dayjs/Date.
 * @param {Function} props.onChange - Time change callback receiving { value, hours, minutes, target: { name, value } }.
 * @param {string} [props.name='time'] - Form field name attribute.
 * @param {string} [props.label='Time'] - Input label.
 * @param {string} [props.placeholder='HH:mm'] - Placeholder text.
 * @param {boolean} [props.disabled=false] - Whether picker is disabled.
 * @param {Function} [props.renderButton] - Custom trigger renderer.
 * @param {React.ReactNode} [props.startAdornment] - Custom leading adornment.
 * @param {React.ReactNode} [props.endAdornment] - Custom trailing adornment.
 * @param {boolean} [props.allowClear=true] - Whether clear button is enabled.
 * @param {'small'|'medium'} [props.size='small'] - Input size.
 * @param {object} [props.sx] - Styling overrides.
 * @returns {import('react').JSX.Element} Rendered time picker element.
 */
export const MuiTimePicker = ({
  value = '',
  onChange,
  name = 'time',
  label = 'Time',
  placeholder = 'HH:mm',
  disabled = false,
  renderButton,
  startAdornment,
  endAdornment,
  allowClear = true,
  size = 'small',
  sx = {},
}) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  // Parse incoming value ("HH:mm") into a valid dayjs instance
  const dayjsValue = useMemo(() => {
    if (!value) return null;
    if (dayjs.isDayjs(value)) return value.isValid() ? value : null;
    if (value instanceof Date) {
      const d = dayjs(value);
      return d.isValid() ? d : null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          return dayjs().hour(hours).minute(minutes).second(0).millisecond(0);
        }
      }

      const d = dayjs(trimmed);
      return d.isValid() ? d : null;
    }
    return null;
  }, [value]);

  const formattedTime = useMemo(() => {
    if (!dayjsValue || !dayjsValue.isValid()) return '';
    return dayjsValue.format('HH:mm');
  }, [dayjsValue]);

  const handlePickerChange = useCallback(
    (newTime) => {
      if (!onChange) return;
      if (newTime && dayjs.isDayjs(newTime) && newTime.isValid()) {
        const timeStr = newTime.format('HH:mm');
        const hStr = newTime.format('HH');
        const mStr = newTime.format('mm');
        onChange({
          value: timeStr,
          hours: hStr,
          minutes: mStr,
          target: { name, value: timeStr },
        });
      } else {
        onChange({
          value: '',
          hours: '',
          minutes: '',
          target: { name, value: '' },
        });
      }
    },
    [name, onChange]
  );

  const handleClear = useCallback(
    (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (onChange) {
        onChange({
          value: '',
          hours: '',
          minutes: '',
          target: { name, value: '' },
        });
      }
    },
    [name, onChange]
  );

  const HiddenField = useCallback(
    () => <div tabIndex={-1} aria-hidden="true" style={{ display: 'none' }} />,
    []
  );

  return (
    <>
      {/* Visual Button Trigger (No TextField) */}
      {renderButton ? (
        <Box ref={anchorRef} sx={{ display: 'inline-flex' }}>
          {renderButton({
            value: dayjsValue,
            formatted: formattedTime,
            onClick: () => setOpen(true),
            onClear: handleClear,
            disabled,
          })}
        </Box>
      ) : (
        <Button
          variant="outlined"
          ref={anchorRef}
          onClick={() => setOpen(true)}
          disabled={disabled}
          size={size}
          startIcon={startAdornment || <AccessTimeOutlinedIcon fontSize="small" />}
          sx={{
            display: 'inline-flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'left',
            ...sx,
          }}
        >
          <Box component="span" sx={{ flexGrow: 1, mr: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formattedTime || placeholder || label}
          </Box>

          {allowClear && dayjsValue && !disabled ? (
            <IconButton
              size="small"
              component="span"
              onClick={handleClear}
              sx={{
                p: 0.25,
                ml: 'auto',
                bgcolor: 'transparent',
                color: 'text.secondary',
                '&:hover': { bgcolor: 'transparent', color: 'text.primary' },
              }}
              aria-label="Clear time selection"
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          ) : (
            endAdornment
          )}
        </Button>
      )}

      {/* Official MUI X TimePicker */}
      <TimePicker
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        value={dayjsValue}
        onChange={handlePickerChange}
        disabled={disabled}
        ampm={false}
        views={['hours', 'minutes']}
        viewRenderers={{
          hours: renderTimeViewClock,
          minutes: renderTimeViewClock,
        }}
        slots={{
          field: HiddenField,
        }}
        slotProps={{
          popper: {
            anchorEl: () => anchorRef.current,
          },
          dialog: {
            PaperProps: {
              sx: {
                backgroundImage: 'none',
                bgcolor: 'background.paper',
              },
            },
          },
        }}
      />
    </>
  );
};

MuiTimePicker.propTypes = {
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.instanceOf(Date),
    PropTypes.object,
  ]),
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string,
  label: PropTypes.string,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  renderButton: PropTypes.func,
  startAdornment: PropTypes.node,
  endAdornment: PropTypes.node,
  allowClear: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium']),
  sx: PropTypes.object,
};

export default MuiTimePicker;
