/**
 * @module components/columns/branchColumns
 * @description Colocated column definitions for the Branch Directory DataGrid.
 * Strictly adheres to:
 * 1. Universal Column Sizing Invariant: Zero static widths, fluid flex with protective minWidth.
 * 2. Two-Phase Action Lifecycle: Active (View, Edit, Archive) vs Archived (View, Restore, Permanent Delete).
 * 3. Inline Loading State: Renders CircularProgress inline on row actions during background mutations.
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Link from '@mui/material/Link';
import CircularProgress from '@mui/material/CircularProgress';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import MuiStatusChip from '../reusable/MuiStatusChip.jsx';
import { getCleanAliases } from '../../utils/constants.js';

/**
 * Factory creating DataGrid column definitions for physical store branches.
 *
 * @function getBranchColumns
 * @param {object} handlers - Action triggers and loading state.
 * @param {(branch: object) => void} handlers.onView - Navigation to branch details.
 * @param {(branch: object) => void} handlers.onEdit - Open edit modal.
 * @param {(branch: object) => void} handlers.onArchive - Open archive confirmation.
 * @param {(branch: object) => void} handlers.onRestore - Open restore confirmation.
 * @param {(branch: object) => void} handlers.onDelete - Open permanent delete confirmation.
 * @param {object|null} [handlers.actionLoading=null] - Action-scoped loading state { id, action }.
 * @param {string|null} [handlers.actionLoadingId=null] - Legacy fallback ID of mutating branch.
 * @returns {Array<object>} Array of DataGrid column configurations.
 */
export const getBranchColumns = ({
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  actionLoading = null,
  actionLoadingId = null,
} = {}) => [
  {
    field: 'code',
    headerName: 'Code',
    flex: 0.8,
    minWidth: 110,
    renderCell: (params) => (
      <Chip
        label={params.value || 'N/A'}
        size="small"
        variant="outlined"
        color="primary"
        sx={{ fontWeight: 700, letterSpacing: '0.04em' }}
      />
    ),
  },
  {
    field: 'name',
    headerName: 'Branch Name',
    flex: 1.6,
    minWidth: 200,
    renderCell: (params) => {
      const cleanAliases = getCleanAliases(params.row?.aliases, params.value);
      const visibleAliases = cleanAliases.slice(0, 2);
      const remainingCount = cleanAliases.length - visibleAliases.length;

      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 0.5, overflow: 'hidden' }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.3, textOverflow: 'ellipsis', overflow: 'hidden' }}
          >
            {params.value}
          </Typography>
          {visibleAliases.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontSize: '0.72rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
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
                      fontSize: '0.70rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    +{remainingCount}
                  </Typography>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>
      );
    },
  },
  {
    field: 'subcity',
    headerName: 'Subcity',
    flex: 1.0,
    minWidth: 130,
    valueGetter: (_value, row) => row?.location?.subcity || 'Addis Ababa',
    renderCell: (params) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <PlaceOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="body2">{params.value}</Typography>
      </Box>
    ),
  },
  {
    field: 'managerName',
    headerName: 'Store Manager',
    flex: 1.2,
    minWidth: 160,
    renderCell: (params) => (
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {params.value || 'Unassigned'}
      </Typography>
    ),
  },
  {
    field: 'contactPhone',
    headerName: 'Telephone',
    flex: 1.1,
    minWidth: 140,
    renderCell: (params) => (
      params.value ? (
        <Link
          href={`tel:${params.value}`}
          underline="hover"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontSize: '0.85rem' }}
        >
          <PhoneOutlinedIcon sx={{ fontSize: 14 }} />
          {params.value}
        </Link>
      ) : (
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          None
        </Typography>
      )
    ),
  },
  {
    field: 'isArchived',
    headerName: 'Status',
    flex: 0.8,
    minWidth: 110,
    renderCell: (params) => (
      <MuiStatusChip status={params.value ? 'archived' : 'active'} />
    ),
  },
  {
    field: 'actions',
    headerName: 'Actions',
    flex: 1.1,
    minWidth: 160,
    sortable: false,
    filterable: false,
    renderCell: (params) => {
      const isArchived = Boolean(params.row?.isArchived);
      const rowId = params.row?._id;
      const activeLoading = actionLoading || (actionLoadingId ? { id: actionLoadingId } : null);
      const isRowBusy = Boolean(activeLoading && activeLoading.id === rowId);

      const isArchiveLoading = isRowBusy && (activeLoading?.action === 'archive' || (!activeLoading?.action && !isArchived));
      const isRestoreLoading = isRowBusy && (activeLoading?.action === 'restore' || (!activeLoading?.action && isArchived));
      const isDeleteLoading = isRowBusy && activeLoading?.action === 'delete';

      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Universal View Details Action */}
          {onView && (
            <Tooltip title="View Inspection Profile">
              <span>
                <IconButton
                  size="small"
                  onClick={() => onView(params.row)}
                  disabled={isRowBusy}
                  aria-label="view branch details"
                >
                  <VisibilityOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {!isArchived ? (
            /* Active Branch Actions: Edit, Archive */
            <>
              {onEdit && (
                <Tooltip title="Edit Branch">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => onEdit(params.row)}
                      disabled={isRowBusy}
                      aria-label="edit branch"
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              {onArchive && (
                <Tooltip title="Archive Branch">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => onArchive(params.row)}
                      disabled={isRowBusy}
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
              )}
            </>
          ) : (
            /* Archived Branch Actions: Restore, Permanent Delete */
            <>
              {onRestore && (
                <Tooltip title="Restore Branch">
                  <span>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => onRestore(params.row)}
                      disabled={isRowBusy}
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
              )}
              {onDelete && (
                <Tooltip title="Permanently Delete (Cascade)">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(params.row)}
                      disabled={isRowBusy}
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
              )}
            </>
          )}
        </Box>
      );
    },
  },
];

export default getBranchColumns;
