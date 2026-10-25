/**
 * @module components/reports/ReportDeliveryActionBar
 * @description The Corporate Delivery Channels Action Bar (Row 3 of Report Detail).
 * Implements:
 * 1. ⬇️ Unified "Download & Print" Dropdown Menu (UTF-8 BOM .txt, PDF, dedicated print view)
 * 2. ☁️ Google Workspace Drive Export with connected integration handshake & guidance modal
 * 3. ✈️ Telegram Operational Broadcast with connected integration verification & guidance modal
 * 4. Accessible focus management across Menu, Popover, Dialogs (purged conflicting aria-hidden trapping props).
 * 5. Redundant copy action purged (canonical home is Authoritative Amharic Dossier).
 */

import { useState, useCallback, useMemo, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Popover from '@mui/material/Popover';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import DialogContentText from '@mui/material/DialogContentText';

import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { toast } from 'react-toastify';

import MuiButton from '../reusable/MuiButton.jsx';
import MuiDialog from '../reusable/MuiDialog.jsx';
import { toEthiopianDateString } from '../../utils/ethiopianCalendar.js';
import { useShareTelegramMutation } from '../../redux/features/chatSlice.js';
import { useGetGoogleDriveStatusQuery } from '../../redux/features/userSlice.js';
import { useExportReportMutation } from '../../redux/features/reportSlice.js';

/**
 * Builds the authoritative operational report string.
 * Precedence:
 * 1. report.transcription (the authentic AI-synthesized document text).
 * 2. Predefined user template (user.settings.reportTemplates.singleBranch / multiBranch).
 * 3. Default structured template defined in prompt assembler / report guidelines.
 *
 * @function buildFormattedReportText
 * @param {object} report - Report document.
 * @param {object} [user] - User object with settings.
 * @returns {string} Formatted report text.
 */
export function buildFormattedReportText(report, user = null) {
  if (!report) return '';

  // 1. Authoritative transcription precedence
  if (report.transcription && typeof report.transcription === 'string' && report.transcription.trim()) {
    return report.transcription.trim();
  }

  const gregorian = report.date ? new Date(report.date).toISOString().split('T')[0] : '';
  const ethiopian = report.ethiopianDate || toEthiopianDateString(report.date) || '';
  const ethDateDisplay = ethiopian ? `${ethiopian} ዓ.ም (${gregorian})` : gregorian;
  const authorName = report.user?.fullName || report.supervisor?.fullName || 'ሱፐርቫይዘር';
  const shift = report.clockIn && report.clockOut ? `${report.clockIn} - ${report.clockOut}` : '—';

  const visits = report.visits || [];
  const visitsText =
    visits.length > 0
      ? visits
        .map(
          (v) =>
            `• ${v.branch?.name || 'ቅርንጫፍ'} (${v.branch?.code || 'BR'})፡ ${v.clockIn || '—'} - ${v.clockOut || '—'}`
        )
        .join('\n')
      : 'ምንም የቅርንጫፍ ጉብኝት አልተመዘገበም';

  const activities = report.activities || [];
  const activitiesText =
    activities.length > 0
      ? activities.map((a) => `• ${a.text} [${a.status === 'completed' ? 'ተጠናቋል' : 'በሂደት ላይ'}]`).join('\n')
      : 'ምንም የተከናወነ ሥራ አልተመዘገበም';

  const issues = report.issues || [];
  const issuesText =
    issues.length > 0
      ? issues.map((i) => `• ${i.text} [${i.status}]`).join('\n')
      : 'ምንም ያጋጠመ ችግር አልተመዘገበም';

  const comments = report.comments || [];
  const commentsText =
    comments.length > 0
      ? comments.map((c) => `• ${c.text}`).join('\n')
      : 'ምንም ተጨማሪ አስተያየት የለም';

  // 2. Predefined user template precedence
  let userTemplate = null;
  if (user?.settings?.reportTemplates) {
    userTemplate = visits.length > 1
      ? user.settings.reportTemplates.multiBranch
      : user.settings.reportTemplates.singleBranch;
  }

  if (userTemplate && typeof userTemplate === 'string' && userTemplate.trim()) {
    return userTemplate
      .replace(/\{\{date\}\}/g, ethDateDisplay)
      .replace(/\{\{clockIn\}\}/g, report.clockIn || '')
      .replace(/\{\{clockOut\}\}/g, report.clockOut || '')
      .replace(/\{\{visits\}\}/g, visitsText)
      .replace(/\{\{activities\}\}/g, activitiesText)
      .replace(/\{\{issues\}\}/g, issuesText)
      .replace(/\{\{comments\}\}/g, commentsText)
      .trim();
  }

  // 3. Default structured template defined in prompt assembler / report guidelines
  const parts = [
    `የዕለት የሥራ ክንውን ሪፖርት`,
    `ቀን፡ ${ethDateDisplay}`,
    `ሱፐርቫይዘር፡ ${authorName}`,
    shift !== '—' ? `የሥራ ሰዓት፡ ${shift}` : null,
    visitsText ? `[የቅርንጫፎች ጉብኝት]\n${visitsText}` : null,
    activitiesText ? `[የተከናወኑ ዋና ዋና ሥራዎች]\n${activitiesText}` : null,
    issuesText ? `[ያጋጠሙ ችግሮች እና መፍትሔ የሚሹ ጉዳዮች]\n${issuesText}` : null,
    commentsText ? `[አጠቃላይ አስተያየት]\n${commentsText}` : null,
  ].filter(Boolean);

  return parts.join('\n\n').trim();
}

/**
 * Report delivery channels action bar component.
 *
 * @component ReportDeliveryActionBar
 * @param {object} props - Component properties.
 * @param {object} props.report - Report document data.
 * @returns {import('react').JSX.Element} Rendered action bar.
 */
export const ReportDeliveryActionBar = memo(({ report }) => {
  const user = useSelector((state) => state.auth?.user);
  const [shareTelegram, { isLoading: isTelegramSending }] = useShareTelegramMutation();
  const [exportReport, { isLoading: isExporting }] = useExportReportMutation();
  const { data: driveStatus } = useGetGoogleDriveStatusQuery(undefined, { skip: !user });

  // Granular export destination loading tracking (isolates spinner strictly to triggered channel)
  const [activeExportDestination, setActiveExportDestination] = useState(null);

  // Download Menu state
  const [downloadAnchor, setDownloadAnchor] = useState(null);
  const isDownloadOpen = Boolean(downloadAnchor);

  // Drive Export Menu state
  const [driveAnchor, setDriveAnchor] = useState(null);
  const isDriveOpen = Boolean(driveAnchor);

  // Guidance modal state
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  // Telegram Popover state
  const [telegramAnchor, setTelegramAnchor] = useState(null);
  const telegram = user?.integrations?.telegram || {};
  const isTelegramConnected = Boolean(telegram.connected);
  const isTelegramEnabled = telegram.enabled !== false;

  const [sharingChannel, setSharingChannel] = useState(null);
  const [telegramFormat, setTelegramFormat] = useState(telegram.defaultFormat || 'text');

  useEffect(() => {
    if (telegram.defaultFormat) {
      setTelegramFormat(telegram.defaultFormat);
    }
  }, [telegram.defaultFormat]);

  // Integration connection status checks
  const isDriveConnected = useMemo(
    () => Boolean(driveStatus?.connected || user?.integrations?.googleDrive?.connected),
    [driveStatus, user]
  );

  const telegramChannels = useMemo(
    () => [
      { id: 'management', label: 'Management (Default)', configured: Boolean(telegram.managementChatId) },
      { id: 'maintenance', label: 'Maintenance & Facilities', configured: Boolean(telegram.maintenanceChatId) },
      { id: 'general', label: 'General Operations', configured: Boolean(telegram.generalChatId) },
    ],
    [telegram]
  );

  // 1. Download Menu Handlers
  const handleOpenDownload = useCallback((e) => {
    setDownloadAnchor(e.currentTarget);
  }, []);

  const handleCloseDownload = useCallback(() => {
    setDownloadAnchor(null);
  }, []);

  // 2. Drive Menu Handlers
  const handleOpenDrive = useCallback((e) => {
    setDriveAnchor(e.currentTarget);
  }, []);

  const handleCloseDrive = useCallback(() => {
    setDriveAnchor(null);
  }, []);

  // Unified Export & Download Trigger
  const handleTriggerExport = useCallback(
    async (format, destination) => {
      if (!report) return;
      handleCloseDownload();
      handleCloseDrive();

      if (destination === 'google_drive' && !isDriveConnected) {
        setIsDriveModalOpen(true);
        return;
      }

      setActiveExportDestination(destination);
      try {
        const res = await exportReport({
          reportId: report._id,
          format,
          destination,
        }).unwrap();

        if (destination === 'download') {
          if (res?.data?.downloadUrl) {
            const link = document.createElement('a');
            link.href = res.data.downloadUrl;
            link.download = res.data.fileName || `Operational_Report_${report.date ? new Date(report.date).toISOString().split('T')[0] : 'Report'}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else {
            // Client-side fallback for text format
            const text = buildFormattedReportText(report, user);
            const blob = new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const dateStr = report.date ? new Date(report.date).toISOString().split('T')[0] : 'Report';
            link.href = url;
            link.download = `Operational_Report_${dateStr}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
          toast.success(`${format.toUpperCase()} dossier downloaded successfully.`);
        } else {
          toast.success(res?.data?.message || "Operational report exported to Google Drive 'Personal AI Agent' folder!");
        }
      } catch (err) {
        toast.error(err?.data?.message || err?.message || 'Failed to export report document.');
      } finally {
        setActiveExportDestination(null);
      }
    },
    [report, user, isDriveConnected, exportReport, handleCloseDownload, handleCloseDrive]
  );

  // 3. Telegram Broadcast Handler
  const handleOpenTelegram = useCallback((e) => {
    setTelegramAnchor(e.currentTarget);
  }, []);

  const handleCloseTelegram = useCallback(() => {
    setTelegramAnchor(null);
  }, []);

  const handleShareToTelegramChannel = useCallback(
    async (channel) => {
      if (!report || sharingChannel) return;
      setSharingChannel(channel);
      try {
        const text = (report.transcription && report.transcription.trim()) || buildFormattedReportText(report, user);
        await shareTelegram({
          text,
          targetChannel: channel,
          asImage: telegramFormat === 'image',
        }).unwrap();

        const modeLabel = telegramFormat === 'image' ? 'Image Card' : 'Text';
        toast.success(`Dispatched to Telegram: ${channel} [${modeLabel}]`);
        handleCloseTelegram();
      } catch (err) {
        toast.error(err?.data?.message || err?.message || 'Telegram dispatch failed');
      } finally {
        setSharingChannel(null);
      }
    },
    [report, user, sharingChannel, telegramFormat, shareTelegram, handleCloseTelegram]
  );

  const isTelegramOpen = Boolean(telegramAnchor);

  return (
    <Paper
      variant="outlined"
      className="report-action-bar"
      sx={{
        p: { xs: 1.25, sm: 1.75 },
        borderRadius: 2,
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        gap: { xs: 1, sm: 1.5 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            color: 'text.secondary',
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            display: { xs: 'none', lg: 'block' },
            mr: 1,
          }}
        >
          Delivery Channels:
        </Typography>

        {/* 1. ⬇️ Download Dropdown Menu Button */}
        <Tooltip title="Download Report in various formats" arrow>
          <span>
            <MuiButton
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={
                isExporting && activeExportDestination === 'download' ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <DownloadOutlinedIcon fontSize="small" sx={{ color: 'success.main' }} />
                )
              }
              endIcon={<ArrowDropDownIcon fontSize="small" />}
              onClick={handleOpenDownload}
              disabled={isExporting}
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, fontWeight: 600, fontSize: '0.78rem' }}
            >
              Download
            </MuiButton>
            <IconButton
              size="small"
              onClick={handleOpenDownload}
              disabled={isExporting}
              aria-label="Download Menu"
              sx={{
                display: { xs: 'inline-flex', sm: 'none' },
                border: (t) => `1px solid ${t.palette.divider}`,
                color: 'success.main',
              }}
            >
              {isExporting && activeExportDestination === 'download' ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DownloadOutlinedIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>

        {/* Download Formats Menu (Text, PDF, Word) */}
        <Menu
          anchorEl={downloadAnchor}
          open={isDownloadOpen}
          onClose={handleCloseDownload}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              elevation: 4,
              sx: { borderRadius: 1.5, minWidth: 220, border: (t) => `1px solid ${t.palette.divider}` },
            },
          }}
        >
          <MenuItem onClick={() => handleTriggerExport('text', 'download')} sx={{ gap: 1.5, fontSize: '0.85rem' }}>
            <DescriptionOutlinedIcon fontSize="small" color="primary" />
            Plain Text Dossier (.txt - UTF-8 BOM)
          </MenuItem>
          <MenuItem onClick={() => handleTriggerExport('pdf', 'download')} sx={{ gap: 1.5, fontSize: '0.85rem' }}>
            <PictureAsPdfOutlinedIcon fontSize="small" color="error" />
            Adobe PDF Document (.pdf)
          </MenuItem>
          <MenuItem onClick={() => handleTriggerExport('docx', 'download')} sx={{ gap: 1.5, fontSize: '0.85rem' }}>
            <ArticleOutlinedIcon fontSize="small" color="info" />
            Microsoft Word Document (.docx)
          </MenuItem>
        </Menu>

        {/* 2. ☁️ Google Workspace Drive Export Dropdown Button */}
        <Tooltip title="Export report to Google Drive 'Personal AI Agent' folder" arrow>
          <span>
            <MuiButton
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={
                isExporting && activeExportDestination === 'google_drive' ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <CloudUploadOutlinedIcon fontSize="small" sx={{ color: '#0F9D58' }} />
                )
              }
              endIcon={<ArrowDropDownIcon fontSize="small" />}
              onClick={handleOpenDrive}
              disabled={isExporting}
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, fontWeight: 600, fontSize: '0.78rem' }}
            >
              Export Drive
            </MuiButton>
            <IconButton
              size="small"
              onClick={handleOpenDrive}
              disabled={isExporting}
              aria-label="Export to Google Drive"
              sx={{
                display: { xs: 'inline-flex', sm: 'none' },
                border: (t) => `1px solid ${t.palette.divider}`,
                color: '#0F9D58',
              }}
            >
              {isExporting && activeExportDestination === 'google_drive' ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CloudUploadOutlinedIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>

        {/* Google Drive 5-Format Export Menu */}
        <Menu
          anchorEl={driveAnchor}
          open={isDriveOpen}
          onClose={handleCloseDrive}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              elevation: 4,
              sx: { borderRadius: 1.5, minWidth: 240, border: (t) => `1px solid ${t.palette.divider}` },
            },
          }}
        >
          <MenuItem onClick={() => handleTriggerExport('text', 'google_drive')} sx={{ gap: 1.5, fontSize: '0.85rem' }}>
            <DescriptionOutlinedIcon fontSize="small" color="primary" />
            Plain Text Dossier (.txt)
          </MenuItem>
          <MenuItem onClick={() => handleTriggerExport('csv', 'google_drive')} sx={{ gap: 1.5, fontSize: '0.85rem' }}>
            <TableChartOutlinedIcon fontSize="small" color="action" />
            Comma-Separated Values (.csv)
          </MenuItem>
          <MenuItem onClick={() => handleTriggerExport('docx', 'google_drive')} sx={{ gap: 1.5, fontSize: '0.85rem' }}>
            <ArticleOutlinedIcon fontSize="small" color="info" />
            Microsoft Word (.docx)
          </MenuItem>
          <MenuItem onClick={() => handleTriggerExport('pdf', 'google_drive')} sx={{ gap: 1.5, fontSize: '0.85rem' }}>
            <PictureAsPdfOutlinedIcon fontSize="small" color="error" />
            Adobe PDF Document (.pdf)
          </MenuItem>
          <MenuItem onClick={() => handleTriggerExport('spreadsheet', 'google_drive')} sx={{ gap: 1.5, fontSize: '0.85rem' }}>
            <TableChartOutlinedIcon fontSize="small" color="success" />
            Excel Spreadsheet (.xlsx)
          </MenuItem>
        </Menu>
      </Box>

      {/* 3. ✈️ Telegram Operational Broadcast Trigger */}
      <Box sx={{ flexShrink: 0 }}>
        <Tooltip title="Broadcast report to Telegram channels" arrow>
          <span>
            <MuiButton
              variant="contained"
              size="small"
              startIcon={<TelegramIcon fontSize="small" />}
              onClick={handleOpenTelegram}
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                fontWeight: 600,
                fontSize: '0.78rem',
                bgcolor: '#2AABEE',
                color: '#fff',
                '&:hover': { bgcolor: '#229ED9' },
              }}
            >
              Broadcast Telegram
            </MuiButton>
            <IconButton
              size="small"
              onClick={handleOpenTelegram}
              aria-label="Broadcast to Telegram"
              sx={{
                display: { xs: 'inline-flex', sm: 'none' },
                color: '#2AABEE',
              }}
            >
              <TelegramIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Telegram Channel Dispatch Popover (Strict Parity with MuiAgentMessageBottomBar) */}
      <Popover
        open={isTelegramOpen}
        anchorEl={telegramAnchor}
        onClose={handleCloseTelegram}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              width: 260,
              borderRadius: 2,
              boxShadow: 4,
              border: (t) => `1px solid ${t.palette.divider}`,
              bgcolor: 'background.paper',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
          <TelegramIcon sx={{ fontSize: 18, color: '#2AABEE' }} />
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            Share to Telegram
          </Typography>
        </Box>

        {!isTelegramConnected || !isTelegramEnabled ? (
          <Box sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 1.5 }}>
              {!isTelegramConnected
                ? 'Telegram bot integration is not connected.'
                : 'Telegram integration is currently paused.'}
            </Typography>
            <MuiButton
              size="small"
              variant="outlined"
              fullWidth
              component={RouterLink}
              to="/profile?tab=telegram"
              onClick={handleCloseTelegram}
              sx={{ fontSize: '0.75rem' }}
            >
              Configure Telegram
            </MuiButton>
          </Box>
        ) : (
          <>
            <ToggleButtonGroup
              value={telegramFormat}
              exclusive
              onChange={(_e, val) => val && setTelegramFormat(val)}
              size="small"
              fullWidth
              sx={{ mb: 1 }}
            >
              <ToggleButton value="text" sx={{ fontSize: '0.75rem', py: 0.3 }}>
                Text (HTML)
              </ToggleButton>
              <ToggleButton value="image" sx={{ fontSize: '0.75rem', py: 0.3 }}>
                Image Card
              </ToggleButton>
            </ToggleButtonGroup>

            <Divider sx={{ my: 0.8 }} />

            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
              Select Channel:
            </Typography>

            <MenuList disablePadding>
              {telegramChannels.map((item) => {
                const isDisabled = !item.configured || Boolean(sharingChannel);
                const menuItem = (
                  <MenuItem
                    key={item.id}
                    onClick={() => item.configured && handleShareToTelegramChannel(item.id)}
                    disabled={isDisabled}
                    sx={{
                      fontSize: '0.8125rem',
                      borderRadius: 1,
                      py: 0.6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: item.configured ? 1 : 0.6,
                    }}
                  >
                    <span>{item.label}</span>
                    {sharingChannel === item.id ? (
                      <CircularProgress size={12} sx={{ ml: 1 }} />
                    ) : !item.configured ? (
                      <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                        Not set
                      </Typography>
                    ) : null}
                  </MenuItem>
                );

                if (!item.configured) {
                  return (
                    <Tooltip key={item.id} title="Chat ID not configured in Profile > Telegram" arrow placement="left">
                      <span>{menuItem}</span>
                    </Tooltip>
                  );
                }

                return menuItem;
              })}
            </MenuList>
          </>
        )}
      </Popover>

      {/* Google Drive Connection Guidance Modal */}
      <MuiDialog
        open={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        title="Google Drive Not Connected"
        maxWidth="xs"
        actions={
          <>
            <MuiButton color="inherit" onClick={() => handleTriggerExport('text', 'download')}>
              Download Locally
            </MuiButton>
            <MuiButton
              variant="contained"
              component={RouterLink}
              to="/profile?tab=cloud"
              startIcon={<SettingsOutlinedIcon />}
            >
              Connect Drive
            </MuiButton>
          </>
        }
      >
        <DialogContentText sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
          Your Google Drive account is not connected yet. Connect your Google account under Profile Settings to automatically export reports into your personal <strong>Personal AI Agent</strong> root folder.
        </DialogContentText>
      </MuiDialog>
    </Paper>
  );
});

ReportDeliveryActionBar.displayName = 'ReportDeliveryActionBar';

ReportDeliveryActionBar.propTypes = {
  report: PropTypes.object,
};

export default ReportDeliveryActionBar;
