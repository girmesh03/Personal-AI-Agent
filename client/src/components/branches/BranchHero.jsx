/**
 * @module components/branches/BranchHero
 * @description Hero profile component for operational branch details view (Row 2).
 * Displays:
 * - Operational uppercase code badge and semantic status chip
 * - Bilingual branch name and transliterated search aliases
 * - Store manager name and direct click-to-dial telephone link
 * - Municipal subcity, city, and physical landmark address
 * - Action buttons for editing, archiving, or restoring with inline loading
 * - Responsive iconification on mobile viewports (< 600px).
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import MuiStatusChip from '../reusable/MuiStatusChip.jsx';
import { getCleanAliases } from '../../utils/constants.js';

/**
 * Branch hero banner component.
 *
 * @component BranchHero
 * @param {object} props - Component properties.
 * @param {object} props.branch - Branch document.
 * @param {() => void} props.onEdit - Edit modal trigger handler.
 * @param {() => void} props.onArchive - Archive trigger handler.
 * @param {() => void} props.onRestore - Restore trigger handler.
 * @param {string|null} [props.actionLoading=null] - Active lifecycle action ('archive' | 'restore' | 'delete').
 * @param {boolean} [props.isActionLoading=false] - Whether an action mutation is currently executing.
 * @returns {import('react').JSX.Element} Rendered branch hero banner.
 */
export const BranchHero = memo(({
  branch,
  onEdit,
  onArchive,
  onRestore,
  actionLoading = null,
  isActionLoading = false,
}) => {
  const isArchived = Boolean(branch?.isArchived);
  const isBusy = Boolean(actionLoading || isActionLoading);
  const isArchiveLoading = actionLoading === 'archive' || (isActionLoading && !isArchived);
  const isRestoreLoading = actionLoading === 'restore' || (isActionLoading && isArchived);

  const cleanAliases = getCleanAliases(branch?.aliases, branch?.name);
  const heroVisibleAliases = cleanAliases.slice(0, 3);
  const heroRemainingCount = cleanAliases.length - heroVisibleAliases.length;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 2.5,
        bgcolor: 'background.paper',
        width: '100%',
      }}
    >
      {/* Top Strip: Badges & Action Buttons */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 2,
        }}
      >
        {/* Left: Code badge & status chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={branch?.code || 'N/A'}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 700, letterSpacing: '0.04em' }}
          />
          <MuiStatusChip status={isArchived ? 'archived' : 'active'} />
        </Box>

        {/* Right: Quick Actions with Mobile Iconification */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Edit Branch Button */}
          {onEdit && (
            <>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<EditOutlinedIcon fontSize="small" />}
                onClick={onEdit}
                disabled={isBusy}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  textTransform: 'none',
                  fontWeight: 500,
                }}
              >
                Edit Branch
              </Button>
              <Tooltip title="Edit Branch">
                <span>
                  <IconButton
                    size="small"
                    onClick={onEdit}
                    disabled={isBusy}
                    aria-label="Edit branch"
                    sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}

          {/* Active: Archive Button */}
          {!isArchived && onArchive && (
            <>
              <Button
                variant="outlined"
                color="warning"
                size="small"
                startIcon={
                  isArchiveLoading ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <ArchiveOutlinedIcon fontSize="small" />
                  )
                }
                onClick={onArchive}
                disabled={isBusy}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  textTransform: 'none',
                  fontWeight: 500,
                }}
              >
                Archive
              </Button>
              <Tooltip title="Archive Branch">
                <span>
                  <IconButton
                    size="small"
                    color="warning"
                    onClick={onArchive}
                    disabled={isBusy}
                    aria-label="Archive branch"
                    sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                  >
                    {isArchiveLoading ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <ArchiveOutlinedIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}

          {/* Archived: Restore Button */}
          {isArchived && onRestore && (
            <>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={
                  isRestoreLoading ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <RestoreOutlinedIcon fontSize="small" />
                  )
                }
                onClick={onRestore}
                disabled={isBusy}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                Restore
              </Button>
              <Tooltip title="Restore Branch">
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={onRestore}
                    disabled={isBusy}
                    aria-label="Restore branch"
                    sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                  >
                    {isRestoreLoading ? (
                      <CircularProgress size={16} color="primary" />
                    ) : (
                      <RestoreOutlinedIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>

      {/* Main Branch Title & Bounded Deduplicated Aliases */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="h5"
          component="h1"
          sx={{
            fontWeight: 700,
            color: 'text.primary',
            lineHeight: 1.25,
            fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
          }}
        >
          {branch?.name}
        </Typography>
        {cleanAliases.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Aliases:
            </Typography>
            {heroVisibleAliases.map((alias) => (
              <Chip
                key={alias}
                label={alias}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: '0.75rem',
                  height: 24,
                  borderRadius: 1.5,
                  color: 'text.secondary',
                  borderColor: 'divider',
                }}
              />
            ))}
            {heroRemainingCount > 0 && (
              <Tooltip title={cleanAliases.slice(3).join(', ')} arrow>
                <Chip
                  label={`+${heroRemainingCount} more`}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{
                    fontSize: '0.75rem',
                    height: 24,
                    borderRadius: 1.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                />
              </Tooltip>
            )}
          </Box>
        )}
      </Box>

      {/* Meta Attributes Grid (Subcity, Landmark, Manager, Contact) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
          gap: 2,
          pt: 2,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* Subcity & City */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <PlaceOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }} />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Municipal Subcity
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {branch?.location?.subcity || 'Addis Ababa'}
              {branch?.location?.city ? `, ${branch.location.city}` : ''}
            </Typography>
          </Box>
        </Box>

        {/* Physical Address / Landmark */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <PlaceOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }} />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Physical Address
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {branch?.location?.address || 'No landmark specified'}
            </Typography>
          </Box>
        </Box>

        {/* Store Manager */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <PersonOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }} />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Store Manager
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {branch?.managerName || 'Unassigned'}
            </Typography>
          </Box>
        </Box>

        {/* Contact Telephone */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <PhoneOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }} />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Telephone
            </Typography>
            {branch?.contactPhone ? (
              <Link
                href={`tel:${branch.contactPhone}`}
                underline="hover"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: 'primary.main',
                }}
              >
                {branch.contactPhone}
              </Link>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                None listed
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
});

BranchHero.displayName = 'BranchHero';

BranchHero.propTypes = {
  branch: PropTypes.shape({
    _id: PropTypes.string,
    code: PropTypes.string,
    name: PropTypes.string,
    aliases: PropTypes.arrayOf(PropTypes.string),
    location: PropTypes.shape({
      city: PropTypes.string,
      subcity: PropTypes.string,
      address: PropTypes.string,
    }),
    managerName: PropTypes.string,
    contactPhone: PropTypes.string,
    isArchived: PropTypes.bool,
  }),
  onEdit: PropTypes.func,
  onArchive: PropTypes.func,
  onRestore: PropTypes.func,
  actionLoading: PropTypes.string,
  isActionLoading: PropTypes.bool,
};

export default BranchHero;
