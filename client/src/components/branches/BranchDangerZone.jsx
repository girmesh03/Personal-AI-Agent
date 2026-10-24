/**
 * @module components/branches/BranchDangerZone
 * @description Danger zone card for operational branch details view (Row 5).
 * Houses soft archival, restoration, and irreversible cascade hard deletion actions.
 * Enforces immediate confirmation dismissal and displays inline loading states.
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';

/**
 * Branch danger zone component for destructive lifecycle management.
 *
 * @component BranchDangerZone
 * @param {object} props - Component properties.
 * @param {object} props.branch - Branch document.
 * @param {() => void} props.onArchive - Archive trigger.
 * @param {() => void} props.onRestore - Restore trigger.
 * @param {() => void} props.onDelete - Permanent cascade delete trigger.
 * @param {string|null} [props.actionLoading=null] - Active lifecycle action ('archive' | 'restore' | 'delete').
 * @param {boolean} [props.isActionLoading=false] - Whether an action mutation is currently executing.
 * @returns {import('react').JSX.Element} Rendered branch danger zone card.
 */
export const BranchDangerZone = memo(({
  branch,
  onArchive,
  onRestore,
  onDelete,
  actionLoading = null,
  isActionLoading = false,
}) => {
  const isArchived = Boolean(branch?.isArchived);
  const isBusy = Boolean(actionLoading || isActionLoading);
  const isArchiveLoading = actionLoading === 'archive' || (isActionLoading && !isArchived);
  const isRestoreLoading = actionLoading === 'restore' || (isActionLoading && isArchived && actionLoading !== 'delete');
  const isDeleteLoading = actionLoading === 'delete';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2.5,
        borderColor: 'error.main',
        bgcolor: 'background.paper',
        width: '100%',
      }}
    >
      {/* Title Strip */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <WarningAmberOutlinedIcon color="error" sx={{ fontSize: 22 }} />
        <Typography variant="h6" color="error" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
          Danger Zone
        </Typography>
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Manage lifecycle states for this operating location. Irreversible actions will permanently delete records across the platform.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {!isArchived ? (
          /* Active Branch Option: Archive */
          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1.5,
              p: 2,
              borderRadius: 2,
              bgcolor: 'action.hover',
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Archive this Branch
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Hides this branch from active report generation. Historical audit reports are preserved.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="warning"
              size="small"
              onClick={onArchive}
              disabled={isBusy}
              startIcon={
                isArchiveLoading ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <ArchiveOutlinedIcon fontSize="small" />
                )
              }
              sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0 }}
            >
              Archive Branch
            </Button>
          </Box>
        ) : (
          /* Archived Branch Options: Restore and Permanent Cascade Deletion */
          <>
            {/* Restore */}
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
                p: 2,
                borderRadius: 2,
                bgcolor: 'action.hover',
              }}
            >
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Restore this Branch
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Reactivates this branch for operational report creation and supervisor audits.
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={onRestore}
                disabled={isBusy}
                startIcon={
                  isRestoreLoading ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <RestoreOutlinedIcon fontSize="small" />
                  )
                }
                sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0 }}
              >
                Restore Branch
              </Button>
            </Box>

            {/* Permanent Cascade Deletion */}
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
                p: 2,
                borderRadius: 2,
                bgcolor: (theme) => `rgba(${theme.palette.error.mainChannel} / 0.08)`,
                border: (theme) => `1px dashed ${theme.palette.error.main}`,
              }}
            >
              <Box>
                <Typography variant="subtitle2" color="error" sx={{ fontWeight: 700 }}>
                  Permanently Delete Branch (Cascade)
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Irreversibly deletes this branch, all associated inspection reports, audio files, and database records.
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="error"
                size="small"
                onClick={onDelete}
                disabled={isBusy}
                startIcon={
                  isDeleteLoading ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <DeleteForeverOutlinedIcon fontSize="small" />
                  )
                }
                sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
              >
                Delete Permanently
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Paper>
  );
});

BranchDangerZone.displayName = 'BranchDangerZone';

BranchDangerZone.propTypes = {
  branch: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    code: PropTypes.string,
    isArchived: PropTypes.bool,
  }),
  onArchive: PropTypes.func,
  onRestore: PropTypes.func,
  onDelete: PropTypes.func,
  actionLoading: PropTypes.string,
  isActionLoading: PropTypes.bool,
};

export default BranchDangerZone;
