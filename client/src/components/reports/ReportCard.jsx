/**
 * @module components/reports/ReportCard
 * @description Operational inspection report card component for mobile (< 600px) and list views.
 * Features:
 * - Gregorian date paired with Ethiopian calendar (ዓ.ም) badge
 * - Shift duration and clockIn - clockOut timeframe
 * - Visited branch code badges with tooltips
 * - Activities & issues operational findings summary chips
 * - Amharic transcription snippet with Ethiopic font styling
 * - Action-scoped inline loading spinners and semantic RestoreOutlinedIcon.
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import MuiStatusChip from '../reusable/MuiStatusChip.jsx';
import { toEthiopianDateString, computeShiftDuration } from '../../utils/ethiopianCalendar.js';

/**
 * Report card representation for list view and mobile screens.
 *
 * @component ReportCard
 * @param {object} props - Component properties.
 * @param {object} props.report - Report document data.
 * @param {(report: object) => void} props.onView - Navigation to report dossier.
 * @param {(report: object) => void} [props.onEdit] - Navigation to report editor.
 * @param {(report: object) => void} [props.onArchive] - Trigger report archival.
 * @param {(report: object) => void} [props.onRestore] - Trigger report restoration.
 * @param {(report: object) => void} [props.onDelete] - Trigger report cascade deletion.
 * @param {object|null} [props.actionLoading=null] - Action-scoped loading state { id, action }.
 * @param {string|null} [props.actionLoadingId=null] - Legacy fallback ID of mutating report.
 * @returns {import('react').JSX.Element} Rendered report card.
 */
export const ReportCard = memo(({
  report,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  actionLoading = null,
  actionLoadingId = null,
}) => {
  const isArchived = Boolean(report?.isArchived);
  const activeLoading = actionLoading || (actionLoadingId ? { id: actionLoadingId } : null);
  const isCardBusy = Boolean(activeLoading && activeLoading.id === report?._id);

  const isArchiveLoading = isCardBusy && (activeLoading?.action === 'archive' || (!activeLoading?.action && !isArchived));
  const isRestoreLoading = isCardBusy && (activeLoading?.action === 'restore' || (!activeLoading?.action && isArchived));
  const isDeleteLoading = isCardBusy && activeLoading?.action === 'delete';

  const gregorianDate = report?.date ? new Date(report.date).toISOString().split('T')[0] : '—';
  const ethiopianDate = report?.ethiopianDate || toEthiopianDateString(report?.date);
  const shiftDuration = computeShiftDuration(report?.clockIn, report?.clockOut);

  const visits = report?.visits || [];
  const activities = report?.activities || [];
  const issues = report?.issues || [];

  const completedActivities = activities.filter((a) => a.status === 'completed').length;
  const inProgressActivities = activities.filter((a) => a.status === 'in_progress').length;

  const reportedIssues = issues.filter((i) => i.status === 'reported').length;
  const inProgressIssues = issues.filter((i) => i.status === 'in_progress').length;
  const completedIssues = issues.filter((i) => i.status === 'completed').length;

  const transcriptionSnippet = report?.transcription
    ? report.transcription.length > 130
      ? `${report.transcription.slice(0, 130)}...`
      : report.transcription
    : null;

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
        {/* Top Header: Inspection Date & Shift Duration */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
            mb: 1.25,
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2, color: 'text.primary' }}>
              {gregorianDate}
            </Typography>
            {ethiopianDate && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {ethiopianDate} ዓ.ም
              </Typography>
            )}
          </Box>

          {report?.clockIn && report?.clockOut && (
            <Chip
              icon={<AccessTimeOutlinedIcon sx={{ fontSize: '14px !important' }} />}
              label={shiftDuration ? `${report.clockIn} - ${report.clockOut} (${shiftDuration})` : `${report.clockIn} - ${report.clockOut}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.72rem', height: 24, fontWeight: 500 }}
            />
          )}
        </Box>

        {/* Visited Branches Badges */}
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <StoreOutlinedIcon sx={{ fontSize: 14 }} /> Visited Branches ({visits.length})
          </Typography>
          {visits.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {visits.map((v, idx) => (
                <Tooltip
                  key={v._id || idx}
                  title={`${v.branch?.name || 'Branch'} (${v.branch?.code || 'BR'}) • ${v.clockIn || '—'} to ${v.clockOut || '—'}`}
                  arrow
                >
                  <Chip
                    label={v.branch?.code || 'BR'}
                    size="small"
                    variant="outlined"
                    color="primary"
                    sx={{ fontSize: '0.72rem', height: 22, fontWeight: 600 }}
                  />
                </Tooltip>
              ))}
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              No branches recorded
            </Typography>
          )}
        </Box>

        {/* Findings Summary (Activities & Issues) */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
          {completedActivities > 0 && (
            <MuiStatusChip status="completed" label={`${completedActivities} done`} size="small" />
          )}
          {inProgressActivities > 0 && (
            <MuiStatusChip status="in_progress" label={`${inProgressActivities} prog`} size="small" />
          )}
          {reportedIssues > 0 && (
            <MuiStatusChip status="reported" label={`${reportedIssues} flagged`} size="small" />
          )}
          {inProgressIssues > 0 && (
            <MuiStatusChip status="in_progress" label={`${inProgressIssues} open`} size="small" />
          )}
          {completedIssues > 0 && (
            <MuiStatusChip status="completed" label={`${completedIssues} solved`} size="small" />
          )}
          {issues.length === 0 && (
            <MuiStatusChip status="no_issue" label="No Issues" size="small" />
          )}
        </Box>

        {/* Amharic Dossier Snippet */}
        {transcriptionSnippet && (
          <Box
            sx={{
              p: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
              fontFamily: "'Noto Sans Ethiopic', 'Nyala', sans-serif",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontFamily: 'inherit',
              }}
            >
              {transcriptionSnippet}
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Card Actions Bottom Deck */}
      <CardActions
        sx={{
          px: 2,
          py: 1.25,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Button
          size="small"
          variant="outlined"
          color="primary"
          startIcon={<VisibilityOutlinedIcon fontSize="small" />}
          onClick={() => onView(report)}
          disabled={isCardBusy}
          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem' }}
        >
          View Dossier
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {!isArchived ? (
            <>
              {onEdit && (
                <Tooltip title="Edit Report" arrow>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => onEdit(report)}
                      disabled={isCardBusy}
                      aria-label="edit report"
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              {onArchive && (
                <Tooltip title="Archive Report" arrow>
                  <span>
                    <IconButton
                      size="small"
                      color="warning"
                      onClick={() => onArchive(report)}
                      disabled={isCardBusy}
                      aria-label="archive report"
                    >
                      {isArchiveLoading ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <ArchiveOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </>
          ) : (
            <>
              {onRestore && (
                <Tooltip title="Restore Report" arrow>
                  <span>
                    <IconButton
                      size="small"
                      color="success"
                      onClick={() => onRestore(report)}
                      disabled={isCardBusy}
                      aria-label="restore report"
                    >
                      {isRestoreLoading ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <RestoreOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip title="Permanently Delete (Cascade)" arrow>
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(report)}
                      disabled={isCardBusy}
                      aria-label="permanently delete report"
                    >
                      {isDeleteLoading ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <DeleteForeverOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      </CardActions>
    </Card>
  );
});

ReportCard.displayName = 'ReportCard';

ReportCard.propTypes = {
  report: PropTypes.object.isRequired,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onArchive: PropTypes.func,
  onRestore: PropTypes.func,
  onDelete: PropTypes.func,
  actionLoading: PropTypes.shape({
    id: PropTypes.string,
    action: PropTypes.string,
  }),
  actionLoadingId: PropTypes.string,
};

export default ReportCard;
