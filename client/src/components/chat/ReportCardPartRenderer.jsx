/**
 * @module components/chat/ReportCardPartRenderer
 * @description In-canvas report card renderer presenting synthesized operational reports.
 * Displays formatted Amharic corporate template sections with circular bullet dots (•)
 * and provides the responsive 4-action delivery bar (Copy, Download .txt with UTF-8 BOM,
 * Print, and View Details).
 */

import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckIcon from '@mui/icons-material/Check';
import DescriptionIcon from '@mui/icons-material/Description';
import { toast } from 'react-toastify';
import MuiButton from '../reusable/MuiButton.jsx';

/**
 * Operon Report Card Part Renderer Component.
 *
 * @component ReportCardPartRenderer
 * @param {object} props - Component props.
 * @param {object} [props.report] - Synthesized report document.
 * @param {string} [props.report._id] - Report ID.
 * @param {string} [props.report.ethiopianDate] - Ethiopian date string.
 * @param {Array<{ branch: object|string, clockIn: string, clockOut: string }>} [props.report.visits] - Branch visits.
 * @param {Array<{ text: string, status?: string }>} [props.report.activities] - Activities list.
 * @param {Array<{ text: string, status?: string }>} [props.report.issues] - Issues list.
 * @param {Array<{ text: string }>} [props.report.comments] - Comments list.
 * @param {string} [props.report.fullAmharicText] - Complete Amharic text export.
 * @returns {import('react').JSX.Element|null} Rendered component.
 */
export const ReportCardPartRenderer = ({ report }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const {
    _id: reportId,
    ethiopianDate = '',
    visits = [],
    activities = [],
    issues = [],
    comments = [],
    fullAmharicText = '',
  } = report || {};

  // Reconstruct full text if fullAmharicText is missing
  const getExportText = useCallback(() => {
    if (fullAmharicText && fullAmharicText.trim()) {
      return fullAmharicText.trim();
    }
    const lines = [];
    if (ethiopianDate) lines.push(`ቀን፡ ${ethiopianDate}`);
    visits.forEach((v) => {
      const bName = typeof v.branch === 'object' ? v.branch?.name : v.branch;
      lines.push(`ቅርንጫፍ፡ ${bName || 'ቦሌ'}`);
      if (v.clockIn && v.clockOut) lines.push(`የስራ ሰዓት፡ ${v.clockIn} - ${v.clockOut}`);
    });
    if (activities.length > 0) {
      lines.push('\nየተከናወኑ ተግባራት፡');
      activities.forEach((a) => lines.push(` • ${a.text}`));
    }
    if (issues.length > 0) {
      lines.push('\nያጋጠሙ ችግሮች፡');
      issues.forEach((i) => lines.push(` • ${i.text}`));
    }
    if (comments.length > 0) {
      lines.push('\nአስተያየት እና ቀጣይ እርምጃዎች፡');
      comments.forEach((c) => lines.push(` • ${c.text}`));
    }
    return lines.join('\n');
  }, [fullAmharicText, ethiopianDate, visits, activities, issues, comments]);

  // Action 1: One-Click Clipboard Copy
  const handleCopy = useCallback(async () => {
    const textToCopy = getExportText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      }
      setCopied(true);
      toast.success('Operational report copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy report text.');
    }
  }, [getExportText]);

  // Action 2: Plain-Text Download with UTF-8 BOM (\uFEFF)
  const handleDownload = useCallback(() => {
    const textContent = getExportText();
    // Prepend UTF-8 BOM so Windows Notepad and Excel decode Ethiopic script correctly
    const blob = new Blob(['\uFEFF' + textContent], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeDate = (ethiopianDate || 'report').replace(/[\s,:/]+/g, '_');
    link.href = url;
    link.download = `Operon_Report_${safeDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Report downloaded as UTF-8 text file.');
  }, [getExportText, ethiopianDate]);

  // Action 3: Browser Print to PDF
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Action 4: View in Details
  const handleViewDetails = useCallback(() => {
    if (reportId) {
      navigate(`/reports/${reportId}`);
    } else {
      toast.info('Report identifier not yet committed to storage.');
    }
  }, [navigate, reportId]);

  if (!report) {
    return null;
  }

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        my: 1.5,
        overflow: 'hidden',
        boxShadow: 'none',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          bgcolor: 'action.hover',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DescriptionIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Operational Audit Report
          </Typography>
        </Box>
        {ethiopianDate && (
          <Chip
            label={ethiopianDate}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 500, fontSize: '0.75rem' }}
          />
        )}
      </Box>

      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: 1.5 } }}>
        {/* Branch & Time Header */}
        {visits.map((v, idx) => {
          const branchName = typeof v.branch === 'object' ? v.branch?.name : v.branch;
          return (
            <Box key={idx} sx={{ mb: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                ቅርንጫፍ፡ {branchName || 'ቦሌ'}
              </Typography>
              {v.clockIn && v.clockOut && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  {`የስራ ሰዓት፡ ${v.clockIn} - ${v.clockOut}`}
                </Typography>
              )}
            </Box>
          );
        })}

        {/* Activities Section */}
        {activities.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
              የተከናወኑ ተግባራት
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0, mt: 0.5 }}>
              {activities.map((act, i) => (
                <Typography key={i} component="li" variant="body2" sx={{ mb: 0.25 }}>
                  {act.text}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Issues Section */}
        {issues.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
              ያጋጠሙ ችግሮች
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0, mt: 0.5 }}>
              {issues.map((iss, i) => (
                <Typography key={i} component="li" variant="body2" sx={{ mb: 0.25 }}>
                  {iss.text}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Comments Section */}
        {comments.length > 0 && (
          <Box sx={{ mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
              አስተያየት እና ቀጣይ እርምጃዎች
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0, mt: 0.5 }}>
              {comments.map((comm, i) => (
                <Typography key={i} component="li" variant="body2" sx={{ mb: 0.25 }}>
                  {comm.text}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>

      <Divider />

      {/* 4-Action Delivery Bar (Responsive: Text+Icon on md+, Icon-only on xs) */}
      <CardActions
        sx={{
          px: 1.5,
          py: 1,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.75,
          justifyContent: { xs: 'space-around', sm: 'flex-start' },
        }}
      >
        {/* Action 1: Copy */}
        <Tooltip title="Copy report text" arrow>
          <span>
            {/* Desktop Button */}
            <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              <MuiButton
                size="small"
                variant="outlined"
                startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
                onClick={handleCopy}
              >
                {copied ? 'Copied' : 'Copy'}
              </MuiButton>
            </Box>
            {/* Mobile Icon Button */}
            <Box sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
              <IconButton
                size="small"
                onClick={handleCopy}
                aria-label="Copy report text"
                sx={{ border: '1px solid', borderColor: 'divider', p: 0.75 }}
              >
                {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Box>
          </span>
        </Tooltip>

        {/* Action 2: Download */}
        <Tooltip title="Download as .txt" arrow>
          <span>
            <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              <MuiButton
                size="small"
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
              >
                Download
              </MuiButton>
            </Box>
            <Box sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
              <IconButton
                size="small"
                onClick={handleDownload}
                aria-label="Download as text file"
                sx={{ border: '1px solid', borderColor: 'divider', p: 0.75 }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Box>
          </span>
        </Tooltip>

        {/* Action 3: Print */}
        <Tooltip title="Print report" arrow>
          <span>
            <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              <MuiButton
                size="small"
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
              >
                Print
              </MuiButton>
            </Box>
            <Box sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
              <IconButton
                size="small"
                onClick={handlePrint}
                aria-label="Print report"
                sx={{ border: '1px solid', borderColor: 'divider', p: 0.75 }}
              >
                <PrintIcon fontSize="small" />
              </IconButton>
            </Box>
          </span>
        </Tooltip>

        {/* Action 4: View Details */}
        {reportId && (
          <Tooltip title="Open in report details" arrow>
            <span>
              <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                <MuiButton
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewIcon />}
                  onClick={handleViewDetails}
                >
                  Details
                </MuiButton>
              </Box>
              <Box sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
                <IconButton
                  size="small"
                  onClick={handleViewDetails}
                  aria-label="Open report details"
                  sx={{ border: '1px solid', borderColor: 'divider', p: 0.75 }}
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Box>
            </span>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
};

ReportCardPartRenderer.propTypes = {
  report: PropTypes.shape({
    _id: PropTypes.string,
    ethiopianDate: PropTypes.string,
    visits: PropTypes.array,
    activities: PropTypes.array,
    issues: PropTypes.array,
    comments: PropTypes.array,
    fullAmharicText: PropTypes.string,
  }),
};

export default ReportCardPartRenderer;
