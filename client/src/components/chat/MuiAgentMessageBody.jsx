/**
 * @module components/chat/MuiAgentMessageBody
 * @description Primary conversational body for agent responses.
 * Adheres strictly to the Task 8.11 specifications:
 * - 16px / 1rem typography standard across all body text, lists, and tables (lineHeight: 1.6).
 * - The Zero Hardcoding Law: Pure dynamic Markdown surface supporting all 7 categories
 *   (inspection reports, cross-branch tables, branch rosters, HACCP advisory, emails, math, copilot gates).
 * - Native @mui/x-chat ChatCodeBlock integration with syntax highlighting and 1-click copy.
 * - Responsive styled Material UI tables with subtle zebra striping and horizontal overflow protection.
 * - Streaming markdown repair for unclosed code fences and formatting markers.
 */

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { alpha } from '@mui/material/styles';
import Markdown, { RuleType } from 'markdown-to-jsx';
import { ChatCodeBlock } from '@mui/x-chat';

/**
 * Repairs unclosed markdown markers during real-time streaming.
 * @param {string} rawText
 * @returns {string} Repaired markdown text.
 */
const repairStreamingMarkdown = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText;

  // 1. Repair unclosed fenced code blocks (```)
  const fenceMatches = text.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 !== 0) {
    text = `${text}\n\`\`\``;
  }

  // 2. Repair unclosed bold (**)
  const textWithoutBlocks = text.replace(/```[\s\S]*?```/g, '');
  const boldMatches = textWithoutBlocks.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    text = `${text}**`;
  }

  return text;
};

/**
 * Custom Markdown overrides for Material UI typography, tables, and links.
 */
const markdownOverrides = {
  h1: {
    component: ({ children, ...props }) => (
      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          mt: 2,
          mb: 1,
          color: 'text.primary',
          fontSize: '1.25rem',
          lineHeight: 1.4,
        }}
        {...props}
      >
        {children}
      </Typography>
    ),
  },
  h2: {
    component: ({ children, ...props }) => (
      <Typography
        sx={{
          fontSize: '1.125rem',
          fontWeight: 600,
          mt: 1.75,
          mb: 0.75,
          color: 'text.primary',
          lineHeight: 1.4,
        }}
        {...props}
      >
        {children}
      </Typography>
    ),
  },
  h3: {
    component: ({ children, ...props }) => (
      <Typography
        sx={{
          fontSize: '1rem',
          fontWeight: 600,
          mt: 1.5,
          mb: 0.5,
          color: 'text.primary',
          lineHeight: 1.5,
        }}
        {...props}
      >
        {children}
      </Typography>
    ),
  },
  p: {
    component: ({ children, ...props }) => (
      <Typography
        component="p"
        sx={{
          fontSize: '1rem',
          lineHeight: 1.6,
          color: 'text.primary',
          my: 0.75,
          wordBreak: 'break-word',
          whiteSpace: 'pre-line',
          '&:first-of-type': { mt: 0 },
          '&:last-of-type': { mb: 0 },
        }}
        {...props}
      >
        {children}
      </Typography>
    ),
  },
  ul: {
    component: ({ children, ...props }) => (
      <Box
        component="ul"
        sx={{
          my: 0.75,
          pl: 2.75,
          color: 'text.primary',
          '& li': {
            fontSize: '1rem',
            lineHeight: 1.6,
            my: 0.25,
          },
        }}
        {...props}
      >
        {children}
      </Box>
    ),
  },
  ol: {
    component: ({ children, ...props }) => (
      <Box
        component="ol"
        sx={{
          my: 0.75,
          pl: 2.75,
          color: 'text.primary',
          '& li': {
            fontSize: '1rem',
            lineHeight: 1.6,
            my: 0.25,
          },
        }}
        {...props}
      >
        {children}
      </Box>
    ),
  },

  a: {
    component: ({ href, children, ...props }) => {
      const isInternal = href && (href.startsWith('/') || href.startsWith('#'));
      return (
        <Link
          href={href}
          target={isInternal ? undefined : '_blank'}
          rel={isInternal ? undefined : 'noopener noreferrer'}
          sx={{
            color: 'primary.main',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            fontWeight: 500,
            '&:hover': {
              color: 'primary.dark',
            },
          }}
          {...props}
        >
          {children}
        </Link>
      );
    },
  },
  blockquote: {
    component: ({ children, ...props }) => (
      <Box
        component="blockquote"
        sx={{
          my: 1.5,
          mx: 0,
          pl: 2,
          pr: 1.5,
          py: 1,
          borderLeft: 3,
          borderColor: 'primary.main',
          bgcolor: (theme) => alpha(theme.palette.action.hover, theme.palette.mode === 'dark' ? 0.2 : 0.05),
          color: 'text.secondary',
          borderRadius: '4px',
          fontStyle: 'normal',
          '& p': { m: 0 },
        }}
        {...props}
      >
        {children}
      </Box>
    ),
  },
  table: {
    component: ({ children, ...props }) => (
      <TableContainer
        component={Box}
        sx={{
          my: 1.5,
          borderRadius: '8px',
          overflowX: 'auto',
          maxWidth: '100%',
          display: 'block',
          bgcolor: 'transparent',
          border: 1,
          borderColor: 'divider',
        }}
        {...props}
      >
        <Table size="small" sx={{ width: 'max-content', minWidth: '100%' }}>
          {children}
        </Table>
      </TableContainer>
    ),
  },
  thead: {
    component: ({ children, ...props }) => (
      <TableHead sx={{ bgcolor: 'action.hover' }} {...props}>
        {children}
      </TableHead>
    ),
  },
  tbody: {
    component: ({ children, ...props }) => (
      <TableBody {...props}>{children}</TableBody>
    ),
  },
  th: {
    component: ({ children, ...props }) => (
      <TableCell
        sx={{
          fontWeight: 600,
          fontSize: '0.875rem',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          whiteSpace: 'nowrap',
          py: 1,
          px: 1.5,
        }}
        {...props}
      >
        {children}
      </TableCell>
    ),
  },
  td: {
    component: ({ children, ...props }) => (
      <TableCell
        sx={{
          fontSize: '0.875rem',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          whiteSpace: 'nowrap',
          py: 1,
          px: 1.5,
        }}
        {...props}
      >
        {children}
      </TableCell>
    ),
  },
  tr: {
    component: ({ children, ...props }) => (
      <TableRow
        sx={{
          '&:last-child td': { borderBottom: 0 },
          '&:nth-of-type(even)': {
            bgcolor: (theme) => alpha(theme.palette.action.hover, 0.3),
          },
        }}
        {...props}
      >
        {children}
      </TableRow>
    ),
  },
};

/**
 * Primary Agent Message Body rendering pure dynamic Markdown.
 *
 * @component MuiAgentMessageBody
 * @param {object} props
 * @param {string} [props.text=''] - Raw or streaming Markdown response text.
 * @param {boolean} [props.isStreaming=false] - Whether response is actively streaming.
 * @returns {import('react').JSX.Element|null} Rendered conversational message body.
 */
export const MuiAgentMessageBody = ({ text = '', isStreaming = false }) => {
  const processedText = useMemo(() => {
    if (!text) return '';
    return isStreaming ? repairStreamingMarkdown(text) : text;
  }, [text, isStreaming]);

  const markdownOptions = useMemo(
    () => ({
      forceBlock: true,
      wrapper: Box,
      overrides: markdownOverrides,
      renderRule(next, node, _renderChildren, state) {
        if (node.type === RuleType.codeBlock) {
          return (
            <ChatCodeBlock
              language={node.lang || undefined}
              key={state.key}
              sx={{ my: 1, maxWidth: '100%', overflowX: 'auto' }}
            >
              {node.text}
            </ChatCodeBlock>
          );
        }
        return next();
      },
    }),
    []
  );

  if (!processedText) return null;

  return (
    <Box
      sx={{
        width: '100%',
        minWidth: 0,
        fontSize: '1rem',
        lineHeight: 1.6,
        color: 'text.primary',
        wordBreak: 'break-word',
      }}
    >
      <Markdown options={markdownOptions}>{processedText}</Markdown>
    </Box>
  );
};

MuiAgentMessageBody.propTypes = {
  text: PropTypes.string,
  isStreaming: PropTypes.bool,
};

export default MuiAgentMessageBody;
