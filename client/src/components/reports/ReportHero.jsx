/**
 * @module components/reports/ReportHero
 * @description Executive Dossier Header & Profile Banner for Report Inspection Detail (Row 2).
 * Implements the approved 2-Tier Executive Dossier Architecture (Sections 10.9 & 10.10):
 * - Tier 1: Dossier Identity (Supervisor Avatar, "Inspection Dossier" title, vertical author profile with semantic theme icons & ellipsis protection) paired with Action Deck (Edit, Archive, Restore) on sm+.
 * - Divider: Subtle theme separation between Identity and Operational Chronology.
 * - Tier 2: Dedicated full-width metadata ribbon (Active/Archived status chip, unified dual-calendar Ethiopian + Gregorian date badge, shift hours & duration badge, visits count badge).
 * - Mobile xs: Clean vertical rhythm with full-width metadata ribbon and 50/50 touch-friendly action buttons.
 */

import { useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import MuiButton from '../reusable/MuiButton.jsx';
import { toEthiopianDateString, computeShiftDuration } from '../../utils/ethiopianCalendar.js';

export const ReportHero = memo(({
  report,
  onEdit,
  onArchive,
  onRestore,
  actionLoading = null,
}) => {
  if (!report) return null;

  const isArchived = Boolean(report.isArchived);
  const isMutating = actionLoading?.id === report._id;
  const isArchiveLoading = isMutating && actionLoading?.action === 'archive';
  const isRestoreLoading = isMutating && actionLoading?.action === 'restore';

  const gregorianDate = report.date ? new Date(report.date).toISOString().split('T')[0] : '—';
  const ethiopianDate = report.ethiopianDate || toEthiopianDateString(report.date);
  const shiftDuration = computeShiftDuration(report.clockIn, report.clockOut);
  const visitsCount = report.visits?.length || 0;

  // Unified dual-calendar date display (100% English UI Chrome)
  const dualDateDisplay = ethiopianDate
    ? `${ethiopianDate} (${gregorianDate})`
    : gregorianDate;

  // Multi-tier supervisor name and identity resolution (Zero artificial strings)
  const author = report.supervisor || report.user || {};
  const authorName = useMemo(() => {
    if (author.fullName && author.fullName.trim() !== '' && !author.fullName.includes('undefined')) {
      return author.fullName.trim();
    }
    const combined = [author.firstName, author.lastName].filter(Boolean).join(' ').trim();
    if (combined && !combined.includes('undefined')) return combined;
    if (author.username) return author.username;
    if (author.email) return author.email.split('@')[0];
    return '';
  }, [author]);

  const authorPosition = author.position || author.role || '';
  const authorEmail = author.email || '';
  const authorAvatar = author.avatar || '';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.75, sm: 2.5 },
        borderRadius: 2.5,
        bgcolor: 'background.paper',
        width: '100%',
      }}
    >
      {/* TIER 1: Dossier Identity & Header Action Deck */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        {/* Left: Supervisor Avatar, Dossier Title & Vertical Linear Attribute Stack */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 1.5, sm: 2 }, minWidth: 0, flex: 1 }}>
          <Avatar
            src={authorAvatar}
            alt={authorName}
            sx={{
              width: { xs: 46, sm: 54 },
              height: { xs: 46, sm: 54 },
              bgcolor: 'primary.main',
              fontWeight: 700,
              fontSize: { xs: '1.1rem', sm: '1.3rem' },
              flexShrink: 0,
              alignSelf: 'flex-start',
            }}
          >
            {authorName ? authorName.charAt(0).toUpperCase() : 'S'}
          </Avatar>

          <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                lineHeight: 1.25,
                color: 'text.primary',
                fontSize: { xs: '1.15rem', sm: '1.35rem' },
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Inspection Dossier
            </Typography>

            {/* Row 2: Supervisor Full Name */}
            {authorName && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                <PersonOutlineOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                <Tooltip title={authorName} arrow placement="top">
                  <Typography
                    sx={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'text.primary',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {authorName}
                  </Typography>
                </Tooltip>
              </Box>
            )}

            {/* Row 3: Position / Role */}
            {authorPosition && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                <WorkOutlineOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                <Tooltip title={authorPosition} arrow placement="top">
                  <Typography
                    sx={{
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      color: 'text.secondary',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {authorPosition}
                  </Typography>
                </Tooltip>
              </Box>
            )}

            {/* Row 4: Email */}
            {authorEmail && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                <MailOutlineOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                <Tooltip title={authorEmail} arrow placement="top">
                  <Typography
                    sx={{
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      color: 'text.secondary',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {authorEmail}
                  </Typography>
                </Tooltip>
              </Box>
            )}
          </Box>
        </Box>

        {/* Right: Quick Action Deck (Inline on sm+, hidden on xs) */}
        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: 1.25,
            flexShrink: 0,
          }}
        >
          {/* Active: Edit Button */}
          {!isArchived && onEdit && (
            <MuiButton
              variant="contained"
              color="primary"
              size="small"
              startIcon={<EditOutlinedIcon fontSize="small" />}
              onClick={onEdit}
              disabled={isMutating}
              sx={{ fontWeight: 600, fontSize: '0.8125rem' }}
            >
              Edit Report
            </MuiButton>
          )}

          {/* Active: Archive Button */}
          {!isArchived && onArchive && (
            <MuiButton
              variant="outlined"
              color="warning"
              size="small"
              startIcon={isArchiveLoading ? <CircularProgress size={14} color="inherit" /> : <ArchiveOutlinedIcon fontSize="small" />}
              onClick={onArchive}
              disabled={isMutating}
              sx={{ fontWeight: 600, fontSize: '0.8125rem' }}
            >
              Archive
            </MuiButton>
          )}

          {/* Archived: Restore Button */}
          {isArchived && onRestore && (
            <MuiButton
              variant="contained"
              color="success"
              size="small"
              startIcon={isRestoreLoading ? <CircularProgress size={14} color="inherit" /> : <RestoreOutlinedIcon fontSize="small" />}
              onClick={onRestore}
              disabled={isMutating}
              sx={{ fontWeight: 600, fontSize: '0.8125rem' }}
            >
              Restore
            </MuiButton>
          )}
        </Box>
      </Box>

      {/* Structural Divider */}
      <Divider sx={{ my: { xs: 1.5, sm: 2 } }} />

      {/* TIER 2: Dedicated Full-Width Operational Metadata Strip */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          width: '100%',
        }}
      >
        {/* 1. Status Badge */}
        <Chip
          label={isArchived ? 'Archived Report' : 'Active Report'}
          color={isArchived ? 'default' : 'success'}
          variant="outlined"
          size="small"
          sx={{ fontWeight: 600, fontSize: '0.75rem', height: 26 }}
        />

        {/* 2. Unified Dual-Calendar Date Badge */}
        <Chip
          icon={<CalendarMonthOutlinedIcon sx={{ fontSize: '15px !important' }} />}
          label={dualDateDisplay}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.75rem', height: 26 }}
        />

        {/* 3. Shift Hours & Duration Badge */}
        {report.clockIn && report.clockOut && (
          <Chip
            icon={<AccessTimeOutlinedIcon sx={{ fontSize: '15px !important' }} />}
            label={shiftDuration ? `${report.clockIn} - ${report.clockOut} (${shiftDuration})` : `${report.clockIn} - ${report.clockOut}`}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 500, fontSize: '0.75rem', height: 26 }}
          />
        )}

        {/* 4. Inspection Scope Badge (Visits Count) */}
        {visitsCount > 0 && (
          <Chip
            icon={<StorefrontOutlinedIcon sx={{ fontSize: '15px !important' }} />}
            label={`${visitsCount} ${visitsCount === 1 ? 'Branch Visit' : 'Branch Visits'}`}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 500, fontSize: '0.75rem', height: 26 }}
          />
        )}
      </Box>

      {/* Mobile Action Deck (xs only: 50/50 touch-friendly buttons) */}
      <Box
        sx={{
          display: { xs: 'flex', sm: 'none' },
          gap: 1,
          mt: 1.5,
          pt: 1.5,
          borderTop: (t) => `1px dashed ${t.palette.divider}`,
        }}
      >
        {!isArchived && onEdit && (
          <MuiButton
            variant="contained"
            color="primary"
            size="small"
            fullWidth
            startIcon={<EditOutlinedIcon fontSize="small" />}
            onClick={onEdit}
            disabled={isMutating}
            sx={{ flex: 1, fontWeight: 600, fontSize: '0.8rem', py: 0.75 }}
          >
            Edit Report
          </MuiButton>
        )}

        {!isArchived && onArchive && (
          <MuiButton
            variant="outlined"
            color="warning"
            size="small"
            fullWidth
            startIcon={isArchiveLoading ? <CircularProgress size={14} color="inherit" /> : <ArchiveOutlinedIcon fontSize="small" />}
            onClick={onArchive}
            disabled={isMutating}
            sx={{ flex: 1, fontWeight: 600, fontSize: '0.8rem', py: 0.75 }}
          >
            Archive
          </MuiButton>
        )}

        {isArchived && onRestore && (
          <MuiButton
            variant="contained"
            color="success"
            size="small"
            fullWidth
            startIcon={isRestoreLoading ? <CircularProgress size={14} color="inherit" /> : <RestoreOutlinedIcon fontSize="small" />}
            onClick={onRestore}
            disabled={isMutating}
            sx={{ flex: 1, fontWeight: 600, fontSize: '0.8rem', py: 0.75 }}
          >
            Restore
          </MuiButton>
        )}
      </Box>
    </Paper>
  );
});

ReportHero.displayName = 'ReportHero';

ReportHero.propTypes = {
  report: PropTypes.object,
  onEdit: PropTypes.func,
  onArchive: PropTypes.func,
  onRestore: PropTypes.func,
  actionLoading: PropTypes.shape({
    id: PropTypes.string,
    action: PropTypes.string,
  }),
};

export default ReportHero;
