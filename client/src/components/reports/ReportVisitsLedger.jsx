/**
 * @module components/reports/ReportVisitsLedger
 * @description Structured subdocument ledger displaying branch visit intervals.
 * Features:
 * - Clean English title strictly formatted as "Branch Visits Ledger (N)"
 * - MaxHeight scroll bounds with custom theme scrollbars for collection scalability
 * - Item-level editing capability enabling in-place modification of clockIn and clockOut times
 * - Responsive table on sm+ and ergonomic stacked cards on xs viewports.
 */

import { useState, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';

import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

import MuiButton from '../reusable/MuiButton.jsx';
import MuiTimePicker from '../reusable/MuiTimePicker.jsx';
import { computeShiftDuration } from '../../utils/ethiopianCalendar.js';

/**
 * Branch visits ledger subdocument table.
 *
 * @component ReportVisitsLedger
 * @param {object} props - Component properties.
 * @param {Array<object>} [props.visits=[]] - Array of visit subdocuments.
 * @param {(updatedVisits: Array<object>) => void} [props.onUpdateVisits] - Item-level edit callback.
 * @returns {import('react').JSX.Element} Rendered visits ledger.
 */
export const ReportVisitsLedger = memo(({ visits = [], onUpdateVisits }) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');

  const handleStartEdit = useCallback((idx, item) => {
    setEditingIndex(idx);
    setEditClockIn(item.clockIn || '08:00');
    setEditClockOut(item.clockOut || '17:00');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditClockIn('');
    setEditClockOut('');
  }, []);

  const handleSaveEdit = useCallback(
    (idx) => {
      if (!onUpdateVisits) {
        setEditingIndex(null);
        return;
      }
      const updated = visits.map((item, i) =>
        i === idx ? { ...item, clockIn: editClockIn.trim(), clockOut: editClockOut.trim() } : item
      );
      onUpdateVisits(updated);
      setEditingIndex(null);
    },
    [visits, editClockIn, editClockOut, onUpdateVisits]
  );

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StoreOutlinedIcon color="primary" sx={{ fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
            Branch Visits Ledger ({visits.length})
          </Typography>
        </Box>
      </Box>

      {visits.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 1 }}>
          No branch visits recorded for this inspection.
        </Typography>
      ) : (
        <Box
          sx={{
            maxHeight: { xs: 320, sm: 400, md: 480 },
            overflowY: 'auto',
            pr: 0.5,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.2),
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.4),
            },
          }}
        >
          {/* sm+ Table View */}
          <TableContainer
            sx={{
              display: { xs: 'none', sm: 'block' },
              overflowX: 'auto',
              '& table': { minWidth: { sm: 540, md: '100%' } },
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.78rem' } }}>
                  <TableCell sx={{ minWidth: 100 }}>Branch</TableCell>
                  <TableCell sx={{ minWidth: 100 }}>Manager</TableCell>
                  <TableCell sx={{ minWidth: 80 }}>Arrival</TableCell>
                  <TableCell sx={{ minWidth: 80 }}>Departure</TableCell>
                  <TableCell align="right" sx={{ minWidth: 70 }}>Duration</TableCell>
                  {onUpdateVisits && <TableCell align="right" sx={{ width: 60 }}>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {visits.map((v, idx) => {
                  const b = v.branch || {};
                  const isEditing = editingIndex === idx;
                  const duration = computeShiftDuration(v.clockIn, v.clockOut);

                  if (isEditing) {
                    return (
                      <TableRow key={v._id || idx} sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.04) }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {b.name || 'Branch'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {b.managerName || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <MuiTimePicker
                            size="small"
                            value={editClockIn}
                            onChange={(val) => setEditClockIn(val ? val.value : '')}
                            placeholder="HH:mm"
                            sx={{ minWidth: 105, height: 32 }}
                          />
                        </TableCell>
                        <TableCell>
                          <MuiTimePicker
                            size="small"
                            value={editClockOut}
                            onChange={(val) => setEditClockOut(val ? val.value : '')}
                            placeholder="HH:mm"
                            sx={{ minWidth: 105, height: 32 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={computeShiftDuration(editClockIn, editClockOut) || '—'}
                            size="small"
                            sx={{ fontSize: '0.72rem', height: 20, fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                            <Tooltip title="Save visit times">
                              <IconButton size="small" color="primary" onClick={() => handleSaveEdit(idx)}>
                                <CheckIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton size="small" color="inherit" onClick={handleCancelEdit}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <TableRow key={v._id || idx} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={b.code || 'BR'}
                            size="small"
                            variant="outlined"
                            color="primary"
                            sx={{ fontWeight: 700, fontSize: '0.72rem', height: 22 }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {b.name || 'Branch'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {b.managerName || '—'}
                          </Typography>
                          {b.managerPhone && (
                            <Link
                              href={`tel:${b.managerPhone}`}
                              underline="hover"
                              sx={{
                                color: 'primary.main',
                                fontSize: '0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <PhoneOutlinedIcon sx={{ fontSize: 13 }} />
                              {b.managerPhone}
                            </Link>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{v.clockIn || '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{v.clockOut || '—'}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        {duration ? (
                          <Chip
                            label={duration}
                            size="small"
                            sx={{ fontSize: '0.72rem', height: 20, fontWeight: 600 }}
                          />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      {onUpdateVisits && (
                        <TableCell align="right">
                          <Tooltip title="Edit visit times">
                            <IconButton
                              size="small"
                              onClick={() => handleStartEdit(idx, v)}
                              sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                            >
                              <EditOutlinedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* xs Mobile Card View */}
          <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 1.5 }}>
            {visits.map((v, idx) => {
              const b = v.branch || {};
              const isEditing = editingIndex === idx;
              const duration = computeShiftDuration(v.clockIn, v.clockOut);

              if (isEditing) {
                return (
                  <Box
                    key={v._id || idx}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: (theme) => `1px solid ${theme.palette.primary.main}`,
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.25,
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Edit {b.name || 'Branch'} Times
                    </Typography>
                    {/* Row 1: Fullwidth Arrival */}
                    <MuiTimePicker
                      size="small"
                      label="Arrival Time"
                      value={editClockIn}
                      onChange={(val) => setEditClockIn(val ? val.value : '')}
                      placeholder="HH:mm"
                      sx={{ width: '100%' }}
                    />
                    {/* Row 2: Fullwidth Departure */}
                    <MuiTimePicker
                      size="small"
                      label="Departure Time"
                      value={editClockOut}
                      onChange={(val) => setEditClockOut(val ? val.value : '')}
                      placeholder="HH:mm"
                      sx={{ width: '100%' }}
                    />
                    {/* Row 3: Actions Right-Aligned */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
                      <MuiButton size="small" color="inherit" onClick={handleCancelEdit} sx={{ fontSize: '0.75rem' }}>
                        Cancel
                      </MuiButton>
                      <MuiButton size="small" variant="contained" color="primary" onClick={() => handleSaveEdit(idx)} sx={{ fontSize: '0.75rem' }}>
                        Save
                      </MuiButton>
                    </Box>
                  </Box>
                );
              }

              return (
                <Box
                  key={v._id || idx}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    bgcolor: 'action.hover',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Chip
                        label={b.code || 'BR'}
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{ fontWeight: 700, fontSize: '0.72rem', height: 20 }}
                      />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {b.name || 'Branch'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {duration && (
                        <Chip label={duration} size="small" sx={{ fontSize: '0.7rem', height: 20, fontWeight: 600 }} />
                      )}
                      {onUpdateVisits && (
                        <IconButton
                          size="small"
                          onClick={() => handleStartEdit(idx, v)}
                          sx={{ p: 0.5, color: 'text.secondary' }}
                        >
                          <EditOutlinedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Hours: {v.clockIn || '—'} to {v.clockOut || '—'}
                    </Typography>
                    {b.managerPhone && (
                      <Link
                        href={`tel:${b.managerPhone}`}
                        underline="hover"
                        sx={{
                          color: 'primary.main',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        <PhoneOutlinedIcon sx={{ fontSize: 13 }} />
                        {b.managerName || 'Call Manager'}
                      </Link>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Paper>
  );
});

ReportVisitsLedger.displayName = 'ReportVisitsLedger';

ReportVisitsLedger.propTypes = {
  visits: PropTypes.arrayOf(PropTypes.object),
  onUpdateVisits: PropTypes.func,
};

export default ReportVisitsLedger;
