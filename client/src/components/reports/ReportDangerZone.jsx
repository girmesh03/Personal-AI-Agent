/**
 * @module components/reports/ReportDangerZone
 * @description Danger Zone panel for operational report management (Row 7 of Report Detail).
 * Features:
 * - Active: Soft-archive action with 30-day retention explanation
 * - Archived: Restore action OR Permanent Cascade Deletion (purging report, audios, disk files)
 * - Immediate modal closing and inline loading state.
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import MuiButton from '../reusable/MuiButton.jsx';

/**
 * Report danger zone actions panel.
 *
 * @component ReportDangerZone
 * @param {object} props - Component properties.
 * @param {boolean} [props.isArchived=false] - Whether report is currently archived.
 * @param {() => void} props.onArchive - Archive trigger.
 * @param {() => void} props.onRestore - Restore trigger.
 * @param {() => void} props.onDelete - Permanent delete trigger.
 * @param {object|null} [props.actionLoading=null] - Action loading state { id, action }.
 * @returns {import('react').JSX.Element} Rendered danger zone.
 */
export const ReportDangerZone = memo(({
  isArchived = false,
  onArchive,
  onRestore,
  onDelete,
  actionLoading = null,
}) => {
  const isArchiveLoading = actionLoading?.action === 'archive';
  const isRestoreLoading = actionLoading?.action === 'restore';
  const isDeleteLoading = actionLoading?.action === 'delete';

  return (
    <Paper
      variant="outlined"
      className="report-danger-zone"
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2,
        borderColor: (theme) => alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.3 : 0.2),
        bgcolor: (theme) => alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.08 : 0.04),
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberOutlinedIcon color="error" sx={{ fontSize: 22 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main', fontSize: { xs: '1rem', sm: '1.15rem' } }}>
          Danger Zone
        </Typography>
      </Box>

      {/* Action Rows */}
      {!isArchived ? (
        /* Active Report: Soft-Archive */
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            pt: 1,
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Archive This Inspection Report
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
              Archiving hides this report from active listings. All data and audio files are preserved and can be restored at any time within 30 days.
            </Typography>
          </Box>

          <MuiButton
            variant="outlined"
            color="warning"
            startIcon={isArchiveLoading ? <CircularProgress size={16} color="inherit" /> : <ArchiveOutlinedIcon />}
            onClick={onArchive}
            disabled={Boolean(actionLoading)}
            sx={{ flexShrink: 0, fontWeight: 600, width: { xs: '100%', sm: 'auto' } }}
          >
            Archive Report
          </MuiButton>
        </Box>
      ) : (
        /* Archived Report: Restore OR Permanent Cascade Delete */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {/* Restore Option */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
              pb: 2,
              borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'success.main' }}>
                Restore Operational Report
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                Restores this report back into the active operational directory and dashboard aggregates.
              </Typography>
            </Box>

            <MuiButton
              variant="contained"
              color="success"
              startIcon={isRestoreLoading ? <CircularProgress size={16} color="inherit" /> : <RestoreOutlinedIcon />}
              onClick={onRestore}
              disabled={Boolean(actionLoading)}
              sx={{ flexShrink: 0, fontWeight: 600, width: { xs: '100%', sm: 'auto' } }}
            >
              Restore Report
            </MuiButton>
          </Box>

          {/* Cascade Delete Option */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'error.main' }}>
                Permanent Cascade Deletion
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                Permanently purges this report from MongoDB and completely unlinks all associated voice audio recordings from disk. This action is irreversible.
              </Typography>
            </Box>

            <MuiButton
              variant="contained"
              color="error"
              startIcon={isDeleteLoading ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverOutlinedIcon />}
              onClick={onDelete}
              disabled={Boolean(actionLoading)}
              sx={{ flexShrink: 0, fontWeight: 600, width: { xs: '100%', sm: 'auto' } }}
            >
              Delete Permanently
            </MuiButton>
          </Box>
        </Box>
      )}
    </Paper>
  );
});

ReportDangerZone.displayName = 'ReportDangerZone';

ReportDangerZone.propTypes = {
  isArchived: PropTypes.bool,
  onArchive: PropTypes.func.isRequired,
  onRestore: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  actionLoading: PropTypes.shape({
    id: PropTypes.string,
    action: PropTypes.string,
  }),
};

export default ReportDangerZone;
