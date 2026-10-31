/**
 * @module components/reusable/MuiStatCard
 * @description Standardized KPI stat card primitive for executive dashboards, branch profiles, and report metrics.
 */

import { memo } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PropTypes from 'prop-types';

/**
 * Standardized KPI metric card component.
 *
 * @component MuiStatCard
 * @param {object} props - Component properties.
 * @param {string} props.title - Metric title / label.
 * @param {string|number} props.value - Primary numeric or text metric value.
 * @param {import('react').ReactElement} props.icon - Prominent metric icon element.
 * @param {string|import('react').ReactNode} [props.subtitle] - Supporting description or trend badge.
 * @param {string} [props.accentColor='primary.main'] - Accent color for the icon background.
 * @param {Function} [props.onClick] - Optional click interaction handler.
 * @param {object} [props.sx={}] - Card style overrides.
 * @returns {JSX.Element} Rendered Stat Card.
 */
export const MuiStatCard = memo(({
  title,
  value,
  icon,
  subtitle,
  accentColor = 'primary.main',
  onClick,
  sx = {},
}) => {
  const isClickable = typeof onClick === 'function';

  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        borderRadius: '10px',
        bgcolor: 'background.paper',
        borderColor: 'divider',
        height: '100%',
        boxShadow: 'none',
        transition: 'all 0.2s ease-in-out',
        cursor: isClickable ? 'pointer' : 'default',
        ...(isClickable && {
          '&:hover': {
            borderColor: accentColor,
            transform: 'translateY(-2px)',
            boxShadow: (theme) => `0 4px 12px ${theme.palette.action.hover}`,
          },
        }),
        ...sx,
      }}
    >
      <CardContent sx={{ p: { xs: 1.75, sm: 2, md: 2.5 }, '&:last-child': { pb: { xs: 1.75, sm: 2, md: 2.5 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: { xs: 1, sm: 1.5 }, minWidth: 0, gap: 1 }}>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontSize: { xs: '0.72rem', sm: '0.75rem' },
              lineHeight: 1.25,
              flexGrow: 1,
              minWidth: 0,
            }}
          >
            {title}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: { xs: 32, sm: 36 },
              height: { xs: 32, sm: 36 },
              borderRadius: '8px',
              bgcolor: (theme) => `${theme.palette.primary.main}15`,
              color: accentColor,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        </Box>

        <Typography
          variant="h5"
          component="div"
          sx={{
            fontWeight: 800,
            fontSize: { xs: '1.35rem', sm: '1.45rem', md: '1.6rem', lg: '1.75rem' },
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            mb: subtitle ? { xs: 0.5, sm: 0.75 } : 0,
          }}
        >
          {value}
        </Typography>

        {subtitle && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            {typeof subtitle === 'string' ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: { xs: '0.72rem', sm: '0.75rem' }, lineHeight: 1.25, flexGrow: 1 }}>
                {subtitle}
              </Typography>
            ) : (
              subtitle
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
});

MuiStatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.element.isRequired,
  subtitle: PropTypes.node,
  accentColor: PropTypes.string,
  onClick: PropTypes.func,
  sx: PropTypes.object,
};

export default MuiStatCard;
