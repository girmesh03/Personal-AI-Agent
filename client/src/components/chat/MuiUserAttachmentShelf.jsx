/**
 * @module components/chat/MuiUserAttachmentShelf
 * @description Dual-mode attachment shelf atop the user message card.
 * In View Mode: Multi-item natural flex-wrap deck with zero horizontal and zero vertical scrollbars.
 * In Edit Mode: Single-line horizontal scroll shelf with hidden scrollbars, scroll chevrons, and individual (x) dismiss pills.
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ImageIcon from '@mui/icons-material/Image';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { API_BASE_URL } from '../../utils/constants.js';

/**
 * Resolves attachment URL to fully qualified HTTP/HTTPS or blob URL.
 * @param {string|null} url
 * @returns {string|null}
 */
const resolveAttachmentUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  const hostOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${hostOrigin}${cleanPath}`;
};

/**
 * Formats byte size into human-readable label.
 * @param {number} bytes
 * @returns {string} Formatted size (e.g. "8.5 KB", "2.1 MB").
 */
const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Determines file category from MIME type or file extension.
 * @param {object} item
 * @returns {'audio'|'image'|'doc'} File category.
 */
const getFileCategory = (item) => {
  const mime = (item.mimeType || item.type || '').toLowerCase();
  const name = (item.name || item.originalName || item.fileName || '').toLowerCase();

  if (
    mime.startsWith('audio/') ||
    mime.includes('webm') ||
    name.endsWith('.webm') ||
    name.endsWith('.wav') ||
    name.endsWith('.mp3') ||
    name.endsWith('.ogg') ||
    name.endsWith('.m4a')
  ) {
    return 'audio';
  }
  if (
    mime.startsWith('image/') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp') ||
    name.endsWith('.gif') ||
    name.endsWith('.svg')
  ) {
    return 'image';
  }
  return 'doc';
};

/**
 * Extracts display extension badge.
 * @param {object} item
 * @returns {string} Badge text (e.g. "PDF", "WAV", "PNG").
 */
const getExtensionBadge = (item) => {
  const name = item.name || item.originalName || item.fileName || '';
  const ext = name.split('.').pop()?.toUpperCase();
  if (ext && ext.length <= 4) return ext;
  const cat = getFileCategory(item);
  if (cat === 'audio') return 'AUDIO';
  if (cat === 'image') return 'IMG';
  return 'DOC';
};

/**
 * Top-row attachment shelf component for User Message.
 *
 * @component MuiUserAttachmentShelf
 * @param {object} props
 * @param {Array<object>} props.attachments - List of attachment items.
 * @param {boolean} [props.isEditing=false] - Whether card is in Edit Mode.
 * @param {Function} [props.onRemoveAttachment] - Callback to remove individual attachment in Edit Mode.
 * @returns {import('react').JSX.Element|null} Rendered attachment shelf or null if empty.
 */
export const MuiUserAttachmentShelf = ({
  attachments = [],
  isEditing = false,
  onRemoveAttachment,
}) => {
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll boundary state in Edit Mode
  const checkScrollBoundaries = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || !isEditing) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, [isEditing]);

  useEffect(() => {
    checkScrollBoundaries();
  }, [attachments, isEditing, checkScrollBoundaries]);

  const handleScroll = (direction) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const offset = direction === 'left' ? -180 : 180;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  if (!Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        mb: isEditing ? 1 : 0,
      }}
    >
      {/* Edit Mode: Left scroll chevron */}
      {isEditing && canScrollLeft && (
        <IconButton
          size="small"
          onClick={() => handleScroll('left')}
          aria-label="Scroll attachments left"
          sx={{
            position: 'absolute',
            left: -8,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 2,
            bgcolor: 'background.paper',
            boxShadow: 'none',
            border: 1,
            borderColor: 'divider',
            width: 24,
            height: 24,
            p: 0,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <ChevronLeftIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}

      {/* Main attachment container: View Mode = flexWrap 'wrap' right-aligned; Edit Mode = nowrap overflowX 'auto' */}
      <Box
        ref={scrollContainerRef}
        onScroll={isEditing ? checkScrollBoundaries : undefined}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: 1,
          alignItems: 'center',
          ...(isEditing
            ? {
                flexWrap: 'nowrap',
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
                py: 0.5,
                px: 0.25,
              }
            : {
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                overflow: 'visible',
              }),
        }}
      >
        {attachments.map((item, index) => {
          const id = item.id || item._id || item.fileName || `att-${index}`;
          const name = item.name || item.originalName || item.fileName || 'Attachment';
          const size = item.size ? formatFileSize(item.size) : '';
          const category = getFileCategory(item);
          const badge = getExtensionBadge(item);

          return (
            <Paper
              key={id}
              variant="outlined"
              onClick={() => {
                if (!isEditing && (item.url || item.path)) {
                  const targetUrl = resolveAttachmentUrl(item.url || item.path);
                  if (targetUrl) {
                    window.open(targetUrl, '_blank', 'noopener,noreferrer');
                  }
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                py: 0.75,
                px: 1.25,
                borderRadius: '10px',
                bgcolor: 'action.hover',
                borderColor: 'divider',
                boxShadow: 'none',
                flexShrink: 0,
                maxWidth: isEditing ? 220 : 280,
                cursor: isEditing ? 'default' : 'pointer',
                transition: 'border-color 150ms ease, background-color 150ms ease',
                '&:hover': {
                  borderColor: isEditing ? 'divider' : 'text.secondary',
                  bgcolor: isEditing ? 'action.hover' : 'action.selected',
                },
              }}
            >
              {/* Category Icon */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  bgcolor: (theme) =>
                    alpha(
                      category === 'audio'
                        ? theme.palette.warning.main
                        : category === 'image'
                          ? theme.palette.info.main
                          : theme.palette.primary.main,
                      theme.palette.mode === 'dark' ? 0.22 : 0.12
                    ),
                  color:
                    category === 'audio'
                      ? 'warning.main'
                      : category === 'image'
                        ? 'info.main'
                        : 'primary.main',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                {category === 'audio' ? (
                  <GraphicEqIcon sx={{ fontSize: 20 }} />
                ) : category === 'image' ? (
                  <ImageIcon sx={{ fontSize: 20 }} />
                ) : (
                  <DescriptionIcon sx={{ fontSize: 20 }} />
                )}

                {(item.isUploading || item.uploadProgress !== undefined) && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      borderRadius: '8px',
                      bgcolor: 'rgba(0, 0, 0, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CircularProgress
                      size={18}
                      thickness={5}
                      variant={typeof item.uploadProgress === 'number' ? 'determinate' : 'indeterminate'}
                      value={typeof item.uploadProgress === 'number' ? item.uploadProgress : undefined}
                      sx={{ color: '#fff' }}
                    />
                  </Box>
                )}
              </Box>

              {/* Name & Badge metadata */}
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Tooltip title={isEditing ? name : `Click to open ${name}`} enterDelay={400}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      lineHeight: 1.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'text.primary',
                    }}
                  >
                    {name}
                  </Typography>
                </Tooltip>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.6875rem',
                    color: 'text.secondary',
                    fontWeight: 500,
                    lineHeight: 1.1,
                    display: 'block',
                    mt: 0.25,
                  }}
                >
                  {badge} {size}
                </Typography>
              </Box>

              {/* Edit Mode: (x) dismiss button */}
              {isEditing && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof onRemoveAttachment === 'function') {
                      onRemoveAttachment(id);
                    }
                  }}
                  aria-label={`Remove attachment ${name}`}
                  sx={{
                    p: 0.25,
                    ml: 0.5,
                    color: 'text.secondary',
                    '&:hover': {
                      color: 'error.main',
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Paper>
          );
        })}
      </Box>

      {/* Edit Mode: Right scroll chevron */}
      {isEditing && canScrollRight && (
        <IconButton
          size="small"
          onClick={() => handleScroll('right')}
          aria-label="Scroll attachments right"
          sx={{
            position: 'absolute',
            right: -8,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 2,
            bgcolor: 'background.paper',
            boxShadow: 'none',
            border: 1,
            borderColor: 'divider',
            width: 24,
            height: 24,
            p: 0,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <ChevronRightIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  );
};

MuiUserAttachmentShelf.propTypes = {
  attachments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
      fileName: PropTypes.string,
      originalName: PropTypes.string,
      size: PropTypes.number,
      mimeType: PropTypes.string,
      type: PropTypes.string,
      url: PropTypes.string,
    })
  ),
  isEditing: PropTypes.bool,
  onRemoveAttachment: PropTypes.func,
};

export default MuiUserAttachmentShelf;
