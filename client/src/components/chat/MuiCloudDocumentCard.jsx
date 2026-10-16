/**
 * @module components/chat/MuiCloudDocumentCard
 * @description Rich Cloud Document & Download Action Deck for AI Agent conversational messages.
 * Automatically inspects tool execution parts (create_cloud_document, generate_document_file,
 * manage_google_drive) and renders high-fidelity action cards with direct Google Drive links,
 * authenticated binary download buttons, and format badges (PDF, XLSX, DOCX, CSV, JSON).
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import DescriptionIcon from '@mui/icons-material/Description';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import CodeIcon from '@mui/icons-material/Code';
import ArticleIcon from '@mui/icons-material/Article';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { toast } from 'react-toastify';

import MuiButton from '../reusable/MuiButton.jsx';

/**
 * Returns icon, theme color, and format label for a given document type or format.
 * @param {string} formatOrType
 * @returns {{ icon: import('react').ReactNode, color: string, label: string }}
 */
const getFormatMetadata = (formatOrType = '') => {
  const normalized = String(formatOrType).toLowerCase().trim();

  switch (normalized) {
    case 'pdf':
      return {
        icon: <PictureAsPdfIcon fontSize="small" />,
        color: '#E53935',
        label: 'PDF Document',
      };
    case 'sheet':
    case 'gsheet':
      return {
        icon: <TableChartIcon fontSize="small" />,
        color: '#2E7D32',
        label: 'Google Sheet',
      };
    case 'xlsx':
    case 'excel':
    case 'spreadsheet':
      return {
        icon: <TableChartIcon fontSize="small" />,
        color: '#2E7D32',
        label: 'Excel Spreadsheet',
      };
    case 'doc':
    case 'gdoc':
      return {
        icon: <DescriptionIcon fontSize="small" />,
        color: '#1976D2',
        label: 'Google Doc',
      };
    case 'docx':
    case 'word':
      return {
        icon: <DescriptionIcon fontSize="small" />,
        color: '#1976D2',
        label: 'Word Document',
      };
    case 'csv':
      return {
        icon: <ViewWeekIcon fontSize="small" />,
        color: '#ED6C02',
        label: 'CSV Data',
      };
    case 'json':
      return {
        icon: <CodeIcon fontSize="small" />,
        color: '#546E7A',
        label: 'JSON Data',
      };
    case 'markdown':
    case 'md':
    case 'txt':
    default:
      return {
        icon: <ArticleIcon fontSize="small" />,
        color: '#607D8B',
        label: 'Document',
      };
  }
};

/**
 * Extracts all document items from tool parts.
 * @param {Array} toolParts
 * @returns {Array} List of document descriptor objects.
 */
const extractDocumentsFromToolParts = (toolParts = []) => {
  if (!Array.isArray(toolParts) || toolParts.length === 0) return [];

  const items = [];

  for (const part of toolParts) {
    const inv = part?.toolInvocation || part;
    if (!inv) continue;

    const rawOutput = inv.output !== undefined ? inv.output : inv.result;
    if (!rawOutput) continue;

    const out = rawOutput?.data !== undefined ? rawOutput.data : rawOutput;
    const toolName = inv.toolName || inv.name;
    const input = inv.input || inv.args || {};

    if (toolName === 'create_cloud_document' && (out.webViewLink || out.fileId)) {
      items.push({
        id: out.fileId || `doc_${items.length}`,
        title: out.title || input?.title || 'Cloud Document',
        format: out.type || 'doc',
        webViewLink: out.webViewLink,
        downloadUrl: null,
        fileSizeFormatted: null,
        detail: out.folder ? `In Google Drive / ${out.folder}` : 'Saved to Google Drive',
        isCloud: true,
      });
    } else if (toolName === 'generate_document_file' && (out.downloadUrl || out.webViewLink || out.fileId)) {
      items.push({
        id: out.fileId || `gen_${items.length}`,
        title: out.title || out.fileName || input?.title || 'Generated Document',
        format: out.format || 'pdf',
        webViewLink: out.webViewLink,
        downloadUrl: out.downloadUrl,
        fileSizeFormatted: out.fileSizeFormatted,
        detail: out.destination === 'both'
          ? 'Google Drive & Authenticated Download'
          : out.destination === 'google_drive'
            ? 'Saved to Google Drive'
            : 'Ready for Download',
        isCloud: Boolean(out.webViewLink),
      });
    } else if (toolName === 'manage_google_drive' && out.action === 'create_folder' && out.webViewLink) {
      items.push({
        id: out.folderId || `folder_${items.length}`,
        title: out.name || 'Personal AI Agent Folder',
        format: 'folder',
        webViewLink: out.webViewLink,
        downloadUrl: null,
        fileSizeFormatted: null,
        detail: 'Google Drive Directory',
        isCloud: true,
      });
    }
  }

  return items;
};

/**
 * Rich Cloud Document & Download Action Deck.
 *
 * @component MuiCloudDocumentCard
 * @param {object} props
 * @param {Array} props.toolParts - Autonomous tool execution parts from the message.
 * @returns {import('react').JSX.Element|null} Rendered document card deck or null.
 */
export const MuiCloudDocumentCard = ({ toolParts = [] }) => {
  const [downloadingId, setDownloadingId] = useState(null);

  const documentItems = extractDocumentsFromToolParts(toolParts);

  if (documentItems.length === 0) {
    return null;
  }

  /**
   * Performs authenticated file download without page reload.
   */
  const handleDownload = async (item) => {
    if (!item.downloadUrl && !item.id) return;
    try {
      setDownloadingId(item.id);
      const rawUrl = item.downloadUrl || `/api/v1/chat/downloads/${item.id}`;
      // In dev/prod, if rawUrl is relative, fetch from origin with credentials
      const response = await fetch(rawUrl, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = item.title ? (item.title.includes('.') ? item.title : `${item.title}.${item.format}`) : 'document';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Document downloaded successfully.');
    } catch (err) {
      toast.error(`Download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Box
      className="MuiCloudDocumentCard-deck"
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        my: 1.5,
      }}
    >
      {documentItems.map((item) => {
        const meta = getFormatMetadata(item.format);
        const isDownloading = downloadingId === item.id;

        return (
          <Card
            key={item.id}
            variant="outlined"
            sx={{
              borderRadius: '10px',
              border: 1,
              borderColor: 'divider',
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'background.paper',
              p: { xs: 1.5, sm: 2 },
              boxShadow: 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                borderColor: meta.color,
                boxShadow: (theme) =>
                  `0 2px 8px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)'}`,
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
              }}
            >
              {/* Left: Icon, Format Badge & Title Metadata */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: '8px',
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.04)',
                    color: meta.color,
                    flexShrink: 0,
                  }}
                >
                  {meta.icon}
                </Box>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: 'text.primary',
                        lineHeight: 1.2,
                      }}
                      noWrap
                    >
                      {item.title}
                    </Typography>

                    <Chip
                      label={meta.label}
                      size="small"
                      sx={{
                        fontSize: '0.675rem',
                        height: 20,
                        fontWeight: 600,
                        bgcolor: (theme) =>
                          theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.06)',
                        color: meta.color,
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {item.detail && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        {item.detail}
                      </Typography>
                    )}
                    {item.fileSizeFormatted && (
                      <>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          •
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                          {item.fileSizeFormatted}
                        </Typography>
                      </>
                    )}
                  </Box>
                </Box>
              </Box>

              {/* Right: Interactive Action Buttons */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  alignSelf: { xs: 'flex-end', sm: 'center' },
                  flexShrink: 0,
                }}
              >
                {/* Google Drive / Web Link Action */}
                {item.webViewLink && (
                  <MuiButton
                    variant="outlined"
                    size="small"
                    component="a"
                    href={item.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<OpenInNewIcon fontSize="small" />}
                    sx={{
                      fontSize: '0.75rem',
                      py: 0.5,
                      px: 1.25,
                      borderColor: meta.color,
                      color: meta.color,
                      '&:hover': {
                        borderColor: meta.color,
                        bgcolor: (theme) =>
                          theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.04)',
                      },
                    }}
                  >
                    Open in Drive
                  </MuiButton>
                )}

                {/* Authenticated Download Action */}
                {(item.downloadUrl || (!item.webViewLink && item.id)) && (
                  <MuiButton
                    variant="contained"
                    size="small"
                    color="primary"
                    startIcon={
                      isDownloading ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : (
                        <DownloadIcon fontSize="small" />
                      )
                    }
                    onClick={() => handleDownload(item)}
                    disabled={isDownloading}
                    sx={{
                      fontSize: '0.75rem',
                      py: 0.5,
                      px: 1.25,
                      fontWeight: 600,
                    }}
                  >
                    Download
                  </MuiButton>
                )}
              </Box>
            </Box>
          </Card>
        );
      })}
    </Box>
  );
};

MuiCloudDocumentCard.propTypes = {
  toolParts: PropTypes.array,
};

export default MuiCloudDocumentCard;
