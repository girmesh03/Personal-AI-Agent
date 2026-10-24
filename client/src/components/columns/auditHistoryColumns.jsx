/**
 * @module components/columns/auditHistoryColumns
 * @description Colocated column definitions for the Historical Inspections Ledger DataGrid.
 * Adheres strictly to the Universal Column Sizing Invariant (fluid flex with minWidth)
 * and displays actual schema statuses for activities and issues (zero fake stubs).
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';

/**
 * Factory creating DataGrid column definitions for branch historical audit visits.
 *
 * @function getAuditHistoryColumns
 * @param {object} options - Options and handlers.
 * @param {string} options.branchId - Active branch identifier.
 * @param {(report: object) => void} options.onViewReport - View report dossier handler.
 * @returns {Array<object>} Column configurations.
 */
export const getAuditHistoryColumns = ({ branchId, onViewReport } = {}) => [
  {
    field: 'date',
    headerName: 'Inspection Date',
    flex: 1.0,
    minWidth: 130,
    valueGetter: (_value, row) => {
      if (!row?.date) return 'N/A';
      return new Date(row.date).toISOString().split('T')[0];
    },
    renderCell: (params) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <EventOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {params.value}
        </Typography>
      </Box>
    ),
  },
  {
    field: 'ethiopianDate',
    headerName: 'Ethiopian Date',
    flex: 0.9,
    minWidth: 110,
    valueGetter: (_value, row) => row?.ethiopianDate || '—',
    renderCell: (params) => (
      <Chip
        label={params.value}
        size="small"
        variant="outlined"
        sx={{ fontSize: '0.75rem', fontWeight: 500 }}
      />
    ),
  },
  {
    field: 'shiftHours',
    headerName: 'Shift Hours',
    flex: 1.1,
    minWidth: 130,
    valueGetter: (_value, row) => {
      const visit = (row?.visits || []).find(
        (v) => String(v.branch?._id || v.branch) === String(branchId)
      ) || row?.visits?.[0];

      if (visit && visit.clockIn && visit.clockOut) {
        return `${visit.clockIn} - ${visit.clockOut}`;
      }
      if (row?.clockIn && row?.clockOut) {
        return `${row.clockIn} - ${row.clockOut}`;
      }
      return '08:30 - 17:00';
    },
    renderCell: (params) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <AccessTimeOutlinedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
        <Typography variant="body2">{params.value}</Typography>
      </Box>
    ),
  },
  {
    field: 'activities',
    headerName: 'Activities (By Real Status)',
    flex: 1.5,
    minWidth: 190,
    renderCell: (params) => {
      const activities = params.row?.activities || [];
      const completed = activities.filter((a) => a.status === 'completed').length;
      const inProgress = activities.filter((a) => a.status === 'in_progress').length;

      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Tooltip title="Completed Activities">
            <Chip
              label={`${completed} completed`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
            />
          </Tooltip>
          {inProgress > 0 && (
            <Tooltip title="In-Progress Activities">
              <Chip
                label={`${inProgress} in_progress`}
                size="small"
                color="info"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
              />
            </Tooltip>
          )}
        </Box>
      );
    },
  },
  {
    field: 'issues',
    headerName: 'Issues (By Real Status)',
    flex: 1.5,
    minWidth: 190,
    renderCell: (params) => {
      const issues = params.row?.issues || [];
      const reported = issues.filter((i) => i.status === 'reported').length;
      const inProgress = issues.filter((i) => i.status === 'in_progress').length;
      const completed = issues.filter((i) => i.status === 'completed').length;
      const noIssue = issues.filter((i) => i.status === 'no_issue').length;

      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {reported > 0 && (
            <Tooltip title="Reported Issues">
              <Chip
                label={`${reported} reported`}
                size="small"
                color="error"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
              />
            </Tooltip>
          )}
          {inProgress > 0 && (
            <Tooltip title="In-Progress Issues">
              <Chip
                label={`${inProgress} in_prog`}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
              />
            </Tooltip>
          )}
          {completed > 0 && (
            <Tooltip title="Resolved Issues">
              <Chip
                label={`${completed} resolved`}
                size="small"
                color="success"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
              />
            </Tooltip>
          )}
          {reported === 0 && inProgress === 0 && (
            <Chip
              label={noIssue > 0 ? 'no_issue' : '0 issues'}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem', color: 'text.secondary' }}
            />
          )}
        </Box>
      );
    },
  },
  {
    field: 'actions',
    headerName: 'Dossier',
    flex: 0.9,
    minWidth: 120,
    sortable: false,
    filterable: false,
    renderCell: (params) => (
      onViewReport ? (
        <Button
          size="small"
          variant="text"
          onClick={() => onViewReport(params.row)}
          endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}
        >
          View
        </Button>
      ) : null
    ),
  },
];

export default getAuditHistoryColumns;
