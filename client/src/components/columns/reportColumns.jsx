/**
 * @module components/columns/reportColumns
 * @description Colocated column definitions for the Operational Reports Archive DataGrid.
 * Strictly adheres to:
 * 1. Fluid Proportional Column Law: 100% flex + minWidth floors (zero static widths).
 * 2. Real Schema Statuses: Zero synthetic open/clean stubs.
 * 3. Temporal SSOT: Primary Gregorian date paired with derived Ethiopian calendar (ዓ.ም).
 * 4. Action-Scoped Loading & Restore Icon: Scoped { id, action } spinner, RestoreOutlinedIcon for unarchiving.
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import MuiStatusChip from '../reusable/MuiStatusChip.jsx';
import { toEthiopianDateString, computeShiftDuration } from '../../utils/ethiopianCalendar.js';

/**
 * Factory creating DataGrid column definitions for operational reports.
 *
 * @function getReportColumns
 * @param {object} handlers - Action triggers and loading state.
 * @param {(report: object) => void} handlers.onView - Navigation to report dossier.
 * @param {(report: object) => void} [handlers.onEdit] - Navigation to report editor.
 * @param {(report: object) => void} [handlers.onArchive] - Trigger report archival.
 * @param {(report: object) => void} [handlers.onRestore] - Trigger report restoration.
 * @param {(report: object) => void} [handlers.onDelete] - Trigger report cascade deletion.
 * @param {object|null} [handlers.actionLoading=null] - Action-scoped loading state { id, action }.
 * @param {string|null} [handlers.actionLoadingId=null] - Legacy fallback ID of mutating report.
 * @param {boolean} [handlers.isArchived=false] - Whether displaying archived reports dataset.
 * @returns {Array<object>} Array of DataGrid column configurations.
 */
export const getReportColumns = ({
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  actionLoading = null,
  actionLoadingId = null,
  isArchived = false,
} = {}) => [
    {
      field: 'date',
      headerName: 'Date',
      flex: 1.2,
      minWidth: 150,
      renderCell: (params) => {
        const row = params.row;
        const gregorian = row?.date ? new Date(row.date).toISOString().split('T')[0] : '—';
        const ethiopian = row?.ethiopianDate || toEthiopianDateString(row?.date);
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.2 }}>
              {gregorian}
            </Typography>
            {ethiopian && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.72rem' }}>
                {ethiopian}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'branches',
      headerName: 'Visited Branches',
      flex: 1.8,
      minWidth: 200,
      sortable: false,
      renderCell: (params) => {
        const visits = params.row?.visits || [];
        if (visits.length === 0) {
          return <Typography variant="caption" sx={{ color: 'text.secondary' }}>No visits recorded</Typography>;
        }
        const firstTwo = visits.slice(0, 2);
        const remaining = visits.length - 2;

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'nowrap', overflow: 'hidden' }}>
            {firstTwo.map((v, idx) => {
              const b = v.branch;
              const code = b?.code || 'BR';
              const name = b?.name || 'Branch';
              const clockInfo = v.clockIn && v.clockOut ? ` • ${v.clockIn} - ${v.clockOut}` : '';
              return (
                <Tooltip key={v._id || idx} title={`${name} (${code})${clockInfo}`} arrow>
                  <Chip
                    label={code}
                    size="small"
                    variant="outlined"
                    color="primary"
                    sx={{ fontWeight: 600, fontSize: '0.72rem', height: 22 }}
                  />
                </Tooltip>
              );
            })}
            {remaining > 0 && (
              <Tooltip
                arrow
                title={visits
                  .slice(2)
                  .map((v) => `${v.branch?.name || 'Branch'} (${v.branch?.code || 'BR'})`)
                  .join(', ')}
              >
                <Chip
                  label={`+${remaining}`}
                  size="small"
                  sx={{ fontSize: '0.7rem', height: 20, bgcolor: 'action.hover', fontWeight: 600 }}
                />
              </Tooltip>
            )}
          </Box>
        );
      },
    },
    {
      field: 'shiftHours',
      headerName: 'Shift Hours',
      flex: 1.1,
      minWidth: 130,
      renderCell: (params) => {
        const { clockIn, clockOut } = params.row || {};
        if (!clockIn || !clockOut) {
          return <Typography variant="caption" sx={{ color: 'text.secondary' }}>—</Typography>;
        }
        const duration = computeShiftDuration(clockIn, clockOut);
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
              {clockIn} - {clockOut}
            </Typography>
            {duration && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                {duration}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'activities',
      headerName: 'Activities',
      flex: 1.2,
      minWidth: 140,
      sortable: false,
      renderCell: (params) => {
        const acts = params.row?.activities || [];
        if (acts.length === 0) {
          return <Typography variant="caption" sx={{ color: 'text.secondary' }}>None</Typography>;
        }
        const completed = acts.filter((a) => a.status === 'completed').length;
        const inProgress = acts.filter((a) => a.status === 'in_progress').length;

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {completed > 0 && (
              <MuiStatusChip status="completed" label={`${completed} done`} size="small" />
            )}
            {inProgress > 0 && (
              <MuiStatusChip status="in_progress" label={`${inProgress} prog`} size="small" />
            )}
            {completed === 0 && inProgress === 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{acts.length} logged</Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'issues',
      headerName: 'Issues & Findings',
      flex: 1.5,
      minWidth: 170,
      sortable: false,
      renderCell: (params) => {
        const issues = params.row?.issues || [];
        const reported = issues.filter((i) => i.status === 'reported').length;
        const inProgress = issues.filter((i) => i.status === 'in_progress').length;
        const completed = issues.filter((i) => i.status === 'completed').length;

        if (issues.length === 0) {
          return <MuiStatusChip status="no_issue" label="No Issues" size="small" />;
        }

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            {reported > 0 && <MuiStatusChip status="reported" label={`${reported} flagged`} size="small" />}
            {inProgress > 0 && <MuiStatusChip status="in_progress" label={`${inProgress} open`} size="small" />}
            {completed > 0 && <MuiStatusChip status="completed" label={`${completed} solved`} size="small" />}
            {reported === 0 && inProgress === 0 && completed === 0 && (
              <MuiStatusChip status="no_issue" label="No Issues" size="small" />
            )}
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1.1,
      minWidth: 140,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const row = params.row;
        const isMutating = actionLoading?.id === row?._id || actionLoadingId === row?._id;
        const isArchiveLoading = isMutating && (actionLoading?.action === 'archive' || (!actionLoading?.action && isMutating));
        const isRestoreLoading = isMutating && (actionLoading?.action === 'restore' || (!actionLoading?.action && isMutating));
        const isDeleteLoading = isMutating && (actionLoading?.action === 'delete' || (!actionLoading?.action && isMutating));

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {/* View Details Action */}
            {onView && (
              <Tooltip title="View Report Dossier" arrow>
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => onView(row)}
                    disabled={isMutating}
                    aria-label="view report dossier"
                  >
                    <VisibilityOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}

            {/* Active Report Actions: Edit & Archive */}
            {!isArchived ? (
              <>
                {onEdit && (
                  <Tooltip title="Edit Report" arrow>
                    <span>
                      <IconButton
                        size="small"
                        color="default"
                        onClick={() => onEdit(row)}
                        disabled={isMutating}
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
                        onClick={() => onArchive(row)}
                        disabled={isMutating}
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
              /* Archived Report Actions: Restore & Permanent Delete */
              <>
                {onRestore && (
                  <Tooltip title="Restore Report" arrow>
                    <span>
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => onRestore(row)}
                        disabled={isMutating}
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
                        onClick={() => onDelete(row)}
                        disabled={isMutating}
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
        );
      },
    },
  ];

export default getReportColumns;
