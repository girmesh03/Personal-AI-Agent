/**
 * @module components/reusable/MuiPagination
 * @description Universal, accessible pagination component adhering strictly to
 * the conditional render invariant: returns null if totalPages <= 1.
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

/**
 * Standardized pagination bar for card lists, tables, and audit logs.
 * Strictly returns null if totalPages <= 1.
 *
 * @component MuiPagination
 * @param {object} props - Component properties.
 * @param {number} props.page - Current 1-based active page.
 * @param {number} props.totalPages - Total number of available pages.
 * @param {(event: React.ChangeEvent<unknown>, value: number) => void} props.onChange - Page change handler.
 * @param {'small'|'medium'|'large'} [props.size] - Size variant (defaults to responsive).
 * @param {'primary'|'secondary'|'standard'} [props.color='primary'] - Pagination color intent.
 * @param {'rounded'|'circular'} [props.shape='rounded'] - Pagination item border radius shape.
 * @param {boolean} [props.showFirstButton=true] - Display fast-forward jump to first page.
 * @param {boolean} [props.showLastButton=true] - Display fast-forward jump to last page.
 * @param {boolean} [props.disabled=false] - Whether pagination controls are disabled.
 * @param {object} [props.sx={}] - Container style overrides.
 * @returns {import('react').JSX.Element|null} Rendered pagination or null if totalPages <= 1.
 */
export const MuiPagination = memo(({
  page,
  totalPages,
  onChange,
  size,
  color = 'primary',
  shape = 'rounded',
  showFirstButton = true,
  showLastButton = true,
  disabled = false,
  sx = {},
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Strict Invariant: Do NOT render pagination when only 1 page exists or total is zero/undefined
  if (!totalPages || totalPages <= 1) {
    return null;
  }

  const effectiveSize = size || (isMobile ? 'small' : 'medium');

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mt: 3,
        mb: 1.5,
        width: '100%',
        ...sx,
      }}
    >
      <Pagination
        count={totalPages}
        page={page || 1}
        onChange={onChange}
        color={color}
        shape={shape}
        size={effectiveSize}
        showFirstButton={showFirstButton}
        showLastButton={showLastButton}
        disabled={disabled}
        siblingCount={isMobile ? 0 : 1}
        boundaryCount={isMobile ? 1 : 1}
        sx={{
          '& .MuiPaginationItem-root': {
            fontWeight: 500,
          },
        }}
      />
    </Box>
  );
});

MuiPagination.displayName = 'MuiPagination';

MuiPagination.propTypes = {
  page: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  color: PropTypes.oneOf(['primary', 'secondary', 'standard']),
  shape: PropTypes.oneOf(['rounded', 'circular']),
  showFirstButton: PropTypes.bool,
  showLastButton: PropTypes.bool,
  disabled: PropTypes.bool,
  sx: PropTypes.object,
};

export default MuiPagination;
