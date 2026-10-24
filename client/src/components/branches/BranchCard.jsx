/**
 * @module components/branches/BranchCard
 * @description Operational store branch card component for list and mobile views.
 * Features:
 * - Operational uppercase code badge
 * - Bilingual branch name and alias subtitles
 * - Store manager name and direct click-to-dial telephone link
 * - Municipal subcity and physical address landmark
 * - Two-phase action lifecycle with inline mutation loading spinner
 * - Responsive iconification on mobile viewports (< 600px).
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import MuiStatusChip from '../reusable/MuiStatusChip.jsx';
import { getCleanAliases } from '../../utils/constants.js';

/**
 * Branch card representation for list view and mobile screens.
 *
 * @component BranchCard
 * @param {object} props - Component properties.
 * @param {object} props.branch - Branch document data.
 * @param {(branch: object) => void} props.onView - Navigation to branch details.
 * @param {(branch: object) => void} props.onEdit - Open edit modal.
 * @param {(branch: object) => void} props.onArchive - Open archive confirmation.
 * @param {(branch: object) => void} props.onRestore - Open restore confirmation.
 * @param {(branch: object) => void} props.onDelete - Open permanent delete confirmation.
 * @param {object|null} [props.actionLoading=null] - Action-scoped loading state { id, action }.
 * @param {string|null} [props.actionLoadingId=null] - Legacy fallback ID of mutating branch.
 * @returns {import('react').JSX.Element} Rendered branch card.
 */
export const BranchCard = memo(({
  branch,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  actionLoading = null,
  actionLoadingId = null,
}) => {
  const isArchived = Boolean(branch.isArchived);
  const activeLoading = actionLoading || (actionLoadingId ? { id: actionLoadingId } : null);
  const isCardBusy = Boolean(activeLoading && activeLoading.id === branch._id);

  const isArchiveLoading = isCardBusy && (activeLoading?.action === 'archive' || (!activeLoading?.action && !isArchived));
  const isRestoreLoading = isCardBusy && (activeLoading?.action === 'restore' || (!activeLoading?.action && isArchived));
  const isDeleteLoading = isCardBusy && activeLoading?.action === 'delete';

  const cleanAliases = getCleanAliases(branch.aliases, branch.name);
  const visibleAliases = cleanAliases.slice(0, 2);
  const remainingCount = cleanAliases.length - visibleAliases.length;

  return (
    <Card
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: 2,
        height: '100%',
        bgcolor: 'background.paper',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: (theme) => `0 4px 12px ${theme.palette.action.hover}`,
        },
      }}
    >
      <CardContent sx={{ p: 2, pb: 1 }}>
        {/* Top Header: Code Badge and Status Chip */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Chip
            label={branch.code || 'N/A'}
            size="small"
            variant="outlined"
            color="primary"
            sx={{ fontWeight: 700, letterSpacing: '0.04em' }}
          />
          <MuiStatusChip status={isArchived ? 'archived' : 'active'} />
        </Box>

        {/* Branch Name & Secondary Aliases */}
        <Box sx={{ mb: 1.5 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              lineHeight: 1.3,
            }}
          >
            {branch.name}
          </Typography>
          {visibleAliases.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, overflow: 'hidden' }}>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontSize: '0.75rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
              >
                {visibleAliases.join(' • ')}
              </Typography>
              {remainingCount > 0 && (
                <Tooltip title={cleanAliases.slice(2).join(', ')} arrow>
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      color: 'primary.main',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    +{remainingCount} more
                  </Typography>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>

        {/* Location Landmark & Subcity */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.75 }}>
          <PlaceOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.2 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {branch.location?.subcity || 'Addis Ababa'}
            </Box>
            {branch.location?.address && ` • ${branch.location.address}`}
          </Typography>
        </Box>

        {/* Store Manager */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
          <PersonOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
            Manager:{' '}
            <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
              {branch.managerName || 'Unassigned'}
            </Box>
          </Typography>
        </Box>

        {/* Contact Telephone Link */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <PhoneOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          {branch.contactPhone ? (
            <Link
              href={`tel:${branch.contactPhone}`}
              underline="hover"
              sx={{
                fontSize: '0.8125rem',
                color: 'primary.main',
                fontWeight: 500,
              }}
            >
              {branch.contactPhone}
            </Link>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              No phone listed
            </Typography>
          )}
        </Box>
      </CardContent>

      {/* Card Actions Deck: Immediate Dismissal + Inline Loading */}
      <CardActions
        sx={{
          px: 2,
          py: 1.5,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left: View Details */}
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          onClick={() => onView(branch)}
          disabled={isCardBusy}
          startIcon={<VisibilityOutlinedIcon fontSize="small" />}
          sx={{
            textTransform: 'none',
            fontSize: '0.8125rem',
            display: { xs: 'none', sm: 'inline-flex' },
          }}
        >
          Details
        </Button>
        <Tooltip title="View Details">
          <span>
            <IconButton
              size="small"
              onClick={() => onView(branch)}
              disabled={isCardBusy}
              aria-label="view branch details"
              sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
            >
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        {/* Right: Lifecycle Actions (Active: Edit, Archive / Archived: Restore, Delete) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {!isArchived ? (
            <>
              {/* Edit Branch */}
              <Tooltip title="Edit Branch">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => onEdit(branch)}
                    disabled={isCardBusy}
                    aria-label="edit branch"
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              {/* Archive Branch with Inline Spinner */}
              <Tooltip title="Archive Branch">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => onArchive(branch)}
                    disabled={isCardBusy}
                    aria-label="archive branch"
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
          ) : (
            <>
              {/* Restore Branch with Inline Spinner */}
              <Tooltip title="Restore Branch">
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => onRestore(branch)}
                    disabled={isCardBusy}
                    aria-label="restore branch"
                  >
                    {isRestoreLoading ? (
                      <CircularProgress size={16} color="primary" />
                    ) : (
                      <RestoreOutlinedIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>

              {/* Permanent Cascade Delete with Inline Spinner */}
              <Tooltip title="Permanently Delete (Cascade)">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => onDelete(branch)}
                    disabled={isCardBusy}
                    aria-label="permanently delete branch"
                  >
                    {isDeleteLoading ? (
                      <CircularProgress size={16} color="error" />
                    ) : (
                      <DeleteForeverOutlinedIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
        </Box>
      </CardActions>
    </Card>
  );
});

BranchCard.displayName = 'BranchCard';

BranchCard.propTypes = {
  branch: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    code: PropTypes.string,
    name: PropTypes.string.isRequired,
    aliases: PropTypes.arrayOf(PropTypes.string),
    location: PropTypes.shape({
      city: PropTypes.string,
      subcity: PropTypes.string,
      address: PropTypes.string,
    }),
    managerName: PropTypes.string,
    contactPhone: PropTypes.string,
    isArchived: PropTypes.bool,
  }).isRequired,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onArchive: PropTypes.func.isRequired,
  onRestore: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  actionLoading: PropTypes.shape({
    id: PropTypes.string,
    action: PropTypes.string,
  }),
  actionLoadingId: PropTypes.string,
};

export default BranchCard;
