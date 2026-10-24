/**
 * @module components/reusable/MuiStatusChip
 * @description Standardized semantic status badge chip mapping domain statuses to
 * Material-UI colors, labels, and icons. Strictly 100% English UI chrome.
 */

import { memo, useMemo } from 'react';
import Chip from '@mui/material/Chip';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PropTypes from 'prop-types';

/**
 * Status configuration lookup mapping raw domain status keys to semantic representations.
 * @constant
 */
const STATUS_CONFIGS = Object.freeze({
  active: {
    label: 'Active',
    color: 'success',
    icon: <CheckCircleOutlineIcon fontSize="small" />,
  },
  archived: {
    label: 'Archived',
    color: 'default',
    icon: <ArchiveOutlinedIcon fontSize="small" />,
  },
  completed: {
    label: 'Completed',
    color: 'success',
    icon: <CheckCircleOutlineIcon fontSize="small" />,
  },
  in_progress: {
    label: 'In Progress',
    color: 'warning',
    icon: <ScheduleIcon fontSize="small" />,
  },
  reported: {
    label: 'Issue Flagged',
    color: 'error',
    icon: <WarningAmberIcon fontSize="small" />,
  },
  no_issue: {
    label: 'No Issues',
    color: 'success',
    icon: <CheckCircleOutlineIcon fontSize="small" />,
  },
  clean: {
    label: 'Clean Audit',
    color: 'success',
    icon: <CheckCircleOutlineIcon fontSize="small" />,
  },
  connected: {
    label: 'Connected',
    color: 'success',
    icon: <CloudDoneOutlinedIcon fontSize="small" />,
  },
  disconnected: {
    label: 'Disconnected',
    color: 'default',
    icon: <CloudOffOutlinedIcon fontSize="small" />,
  },
  enabled: {
    label: 'Enabled',
    color: 'primary',
    icon: <CheckCircleOutlineIcon fontSize="small" />,
  },
  disabled: {
    label: 'Disabled',
    color: 'default',
    icon: <RadioButtonUncheckedIcon fontSize="small" />,
  },
});

const DEFAULT_CONFIG = Object.freeze({
  label: 'Unknown',
  color: 'default',
  icon: <RadioButtonUncheckedIcon fontSize="small" />,
});

/**
 * Reusable semantic status chip component.
 *
 * @component MuiStatusChip
 * @param {object} props - Component properties.
 * @param {string} props.status - Raw domain status key.
 * @param {string} [props.label] - Optional explicit label override.
 * @param {'small'|'medium'} [props.size='small'] - Chip size variant.
 * @param {'outlined'|'filled'} [props.variant='outlined'] - Chip visual variant.
 * @param {import('react').ReactElement} [props.icon] - Optional explicit icon override.
 * @param {object} [props.sx={}] - Style overrides.
 * @returns {JSX.Element} Rendered Status Chip.
 */
export const MuiStatusChip = memo(({
  status,
  label,
  size = 'small',
  variant = 'outlined',
  icon,
  sx = {},
}) => {
  const normalizedKey = typeof status === 'string' ? status.toLowerCase() : '';
  const config = STATUS_CONFIGS[normalizedKey] || DEFAULT_CONFIG;

  const resolvedLabel = useMemo(
    () => label || config.label,
    [label, config.label]
  );

  const resolvedIcon = useMemo(
    () => (icon !== undefined ? icon : config.icon),
    [icon, config.icon]
  );

  return (
    <Chip
      size={size}
      variant={variant}
      color={config.color}
      icon={resolvedIcon}
      label={resolvedLabel}
      sx={{
        fontWeight: 600,
        fontSize: size === 'small' ? '0.75rem' : '0.85rem',
        borderRadius: '6px',
        height: size === 'small' ? 24 : 32,
        ...sx,
      }}
    />
  );
});

MuiStatusChip.propTypes = {
  status: PropTypes.string.isRequired,
  label: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium']),
  variant: PropTypes.oneOf(['outlined', 'filled']),
  icon: PropTypes.element,
  sx: PropTypes.object,
};

export default MuiStatusChip;
