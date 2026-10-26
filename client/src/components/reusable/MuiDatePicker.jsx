/**
 * @module components/reusable/MuiDatePicker
 * @description Universal, production-grade Material-UI date picker wrapping official
 * MUI X DatePicker (@mui/x-date-pickers/DatePicker) with AdapterEthiopianDayjs scoped locally
 * under <LocalizationProvider> for 100% collision immunity.
 * Renders a native Button (no TextField) with right-docked Clear button, and inherits 100% of styling from AppTheme.
 */

import React, { useState, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { AdapterEthiopianDayjs } from '../../utils/AdapterEthiopianDayjs.js';
import {
  toEthiopianDate,
  formatEthiopianFullDate,
  parseEthiopianDate,
  ethiopianToGregorianDate,
} from '../../utils/ethiopianCalendar.js';

/**
 * Universal MuiDatePicker component wrapping official MUI X DatePicker.
 *
 * @component MuiDatePicker
 * @param {object} props - Component properties.
 * @param {string|Date|object} [props.value] - Date value (Gregorian 'YYYY-MM-DD', Ethiopian 'DD-MM-YY', or Dayjs/Date).
 * @param {Function} props.onChange - Selection callback receiving { gregorian, ethiopianDate, ethiopian, target: { name, value } }.
 * @param {string} [props.name='date'] - Form field name attribute.
 * @param {string} [props.label='Date'] - Input label.
 * @param {string} [props.placeholder='Select Date'] - Placeholder text.
 * @param {boolean} [props.disabled=false] - Whether picker is disabled.
 * @param {Function} [props.renderButton] - Custom trigger renderer.
 * @param {React.ReactNode} [props.startAdornment] - Custom leading adornment.
 * @param {React.ReactNode} [props.endAdornment] - Custom trailing adornment.
 * @param {boolean} [props.allowClear=true] - Whether clear button is enabled.
 * @param {'small'|'medium'} [props.size='small'] - Input size.
 * @param {object} [props.sx] - Styling overrides.
 * @returns {import('react').JSX.Element} Rendered date picker element.
 */
export const MuiDatePicker = ({
  value,
  onChange,
  name = 'date',
  label = 'Date',
  placeholder = 'Select Date',
  disabled = false,
  fullWidth = false,
  renderButton,
  startAdornment,
  endAdornment,
  allowClear = true,
  size = 'small',
  sx = {},
}) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  // Unpack raw value safely (supporting primitive strings, Dayjs/Date, and { value, gregorian, target } objects)
  const rawDateValue = useMemo(() => {
    if (!value) return null;
    if (typeof value === 'object' && !dayjs.isDayjs(value) && !(value instanceof Date)) {
      return value.gregorian ?? value.value ?? value.target?.value ?? null;
    }
    return value;
  }, [value]);

  // Parse incoming value into a valid dayjs instance
  const dayjsValue = useMemo(() => {
    if (!rawDateValue) return null;
    if (dayjs.isDayjs(rawDateValue)) return rawDateValue.isValid() ? rawDateValue : null;
    if (rawDateValue instanceof Date) {
      const d = dayjs(rawDateValue);
      return d.isValid() ? d : null;
    }
    if (typeof rawDateValue === 'string') {
      const trimmed = rawDateValue.trim();
      if (!trimmed) return null;

      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const d = dayjs(trimmed.slice(0, 10));
        if (d.isValid()) return d;
      }

      const ethParsed = parseEthiopianDate(trimmed);
      if (ethParsed) {
        const greg = ethiopianToGregorianDate(ethParsed.year, ethParsed.month, ethParsed.day);
        if (greg?.isoDate) {
          const d = dayjs(greg.isoDate);
          if (d.isValid()) return d;
        }
      }

      const fallback = dayjs(trimmed);
      return fallback.isValid() ? fallback : null;
    }
    return null;
  }, [rawDateValue]);

  const selectedEth = useMemo(() => {
    if (!dayjsValue || !dayjsValue.isValid()) return null;
    return toEthiopianDate(dayjsValue);
  }, [dayjsValue]);

  const ethiopianData = useMemo(() => {
    if (!selectedEth) {
      return {
        ethiopian: null,
        formatted: '',
        ethiopianDate: '',
      };
    }
    const dd = String(selectedEth.day).padStart(2, '0');
    const mm = String(selectedEth.month).padStart(2, '0');
    const yy = String(selectedEth.year).slice(-2);
    return {
      ethiopian: selectedEth,
      formatted: formatEthiopianFullDate(selectedEth),
      ethiopianDate: `${dd}-${mm}-${yy}`,
    };
  }, [selectedEth]);

  const handlePickerChange = useCallback(
    (newDate) => {
      if (!onChange) return;
      const d = dayjs.isDayjs(newDate) ? newDate : (newDate ? dayjs(newDate) : null);
      if (d && d.isValid()) {
        const gregStr = d.format('YYYY-MM-DD');
        const eth = toEthiopianDate(d);
        const dd = String(eth.day).padStart(2, '0');
        const mm = String(eth.month).padStart(2, '0');
        const yy = String(eth.year).slice(-2);
        const ethStr = `${dd}-${mm}-${yy}`;
        onChange({
          gregorian: gregStr,
          ethiopianDate: ethStr,
          ethiopian: eth,
          value: gregStr,
          target: { name, value: gregStr },
        });
      } else {
        onChange({
          gregorian: '',
          ethiopianDate: '',
          ethiopian: null,
          value: '',
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
          gregorian: '',
          ethiopianDate: '',
          ethiopian: null,
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
    <LocalizationProvider dateAdapter={AdapterEthiopianDayjs}>
      {/* Visual Button Trigger (No TextField) */}
      {renderButton ? (
        <Box
          ref={anchorRef}
          sx={{
            display: fullWidth ? 'flex' : 'inline-flex',
            width: fullWidth ? '100%' : 'auto',
          }}
        >
          {renderButton({
            value: dayjsValue,
            formatted: ethiopianData.formatted,
            ethiopianDate: ethiopianData.ethiopianDate,
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
          fullWidth={fullWidth}
          startIcon={startAdornment || <CalendarMonthOutlinedIcon fontSize="small" />}
          sx={{
            width: fullWidth ? '100%' : 'auto',
            display: 'inline-flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'left',
            ...sx,
          }}
        >
          <Box component="span" sx={{ flexGrow: 1, mr: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ethiopianData.ethiopianDate || placeholder || label}
          </Box>

          {allowClear && selectedEth && !disabled ? (
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
              aria-label="Clear date selection"
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          ) : (
            endAdornment
          )}
        </Button>
      )}

      {/* Official MUI X DatePicker wrapped in Scoped Adapter */}
      <DatePicker
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        value={dayjsValue}
        onChange={handlePickerChange}
        onAccept={handlePickerChange}
        disabled={disabled}
        dayOfWeekFormatter={(date) => {
          const day = typeof date?.day === 'function' ? date.day() : 0;
          const names = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
          return names[day] || '';
        }}
        slots={{
          field: HiddenField,
        }}
        slotProps={{
          popper: {
            anchorEl: () => anchorRef.current,
          },
        }}
      />
    </LocalizationProvider>
  );
};

MuiDatePicker.propTypes = {
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
  fullWidth: PropTypes.bool,
  renderButton: PropTypes.func,
  startAdornment: PropTypes.node,
  endAdornment: PropTypes.node,
  allowClear: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium']),
  sx: PropTypes.object,
};

export default MuiDatePicker;
