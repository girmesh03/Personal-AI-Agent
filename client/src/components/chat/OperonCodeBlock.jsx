/**
 * @module components/chat/OperonCodeBlock
 * @description Dynamic multi-language code block renderer for operational chat.
 * Intercepts Markdown code fences across all 4 interaction quadrants (Excel formulas,
 * Python scripts, JSON payloads, and SQL queries) with language header tags,
 * 1-click clipboard copy, and strict horizontal overflow containment.
 */

import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { toast } from 'react-toastify';

/**
 * Operon Code Block Component.
 *
 * @component OperonCodeBlock
 * @param {object} props - Component props.
 * @param {string|import('react').ReactNode} props.children - Code snippet content.
 * @param {string} [props.language] - Language identifier (excel, python, json, sql, etc.).
 * @param {object} [props.sx] - Custom styling overrides.
 * @returns {import('react').JSX.Element} Rendered component.
 */
export const OperonCodeBlock = ({ children, language = '', sx = {} }) => {
  const [copied, setCopied] = useState(false);
  const codeContent = typeof children === 'string' ? children : String(children || '');

  // Format language display badge
  const displayLanguage = (language || 'code').toUpperCase();

  const handleCopy = useCallback(async () => {
    if (!codeContent.trim()) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(codeContent.trim());
      }
      setCopied(true);
      toast.success('Code copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy code to clipboard.');
    }
  }, [codeContent]);

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        my: 1.5,
        bgcolor: 'background.paper',
        maxWidth: '100%',
        ...sx,
      }}
    >
      {/* Code Block Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.75,
          bgcolor: 'action.hover',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '0.75rem',
            color: 'text.secondary',
            letterSpacing: '0.05em',
          }}
        >
          {displayLanguage}
        </Typography>

        <Tooltip title={copied ? 'Copied!' : 'Copy snippet'} arrow>
          <IconButton
            size="small"
            onClick={handleCopy}
            aria-label="Copy code block"
            sx={{ p: 0.5, color: 'text.secondary' }}
          >
            {copied ? (
              <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
            ) : (
              <ContentCopyIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Code Block Content Container */}
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          fontFamily: 'monospace',
          fontSize: '0.82rem',
          lineHeight: 1.5,
          color: 'text.primary',
          overflowX: 'auto',
          whiteSpace: 'pre',
          wordBreak: 'normal',
          '&::-webkit-scrollbar': {
            height: 6,
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'divider',
            borderRadius: 3,
          },
        }}
      >
        <code>{codeContent}</code>
      </Box>
    </Box>
  );
};

OperonCodeBlock.propTypes = {
  children: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  language: PropTypes.string,
  sx: PropTypes.object,
};

export default OperonCodeBlock;
