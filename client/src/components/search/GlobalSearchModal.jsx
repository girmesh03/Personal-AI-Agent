/**
 * @module components/search/GlobalSearchModal
 * @description Decoupled Command-Palette Global Search modal mounted from MuiAppbar.
 * Implements Invariant 43 (Zero-Lag Uncontrolled & Explicit-Trigger Law) and Invariant 45.
 * Strictly zero debounces and zero react-hook-form watch.
 */

import { useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import StorefrontIcon from '@mui/icons-material/Storefront';
import DescriptionIcon from '@mui/icons-material/Description';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import PropTypes from 'prop-types';

import MuiSearchInput from '../reusable/MuiSearchInput.jsx';
import { useGetChatsQuery } from '../../redux/features/chatSlice.js';
import { apiSlice } from '../../redux/app/apiSlice.js';

// Lazy injected endpoints for branches and reports to avoid circular dependencies
const searchApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    searchBranches: builder.query({
      query: (params) => ({
        url: '/branches',
        params,
      }),
      providesTags: ['Branch'],
    }),
    searchReports: builder.query({
      query: (params) => ({
        url: '/reports',
        params,
      }),
      providesTags: ['Report'],
    }),
  }),
  overrideExisting: false,
});

const { useSearchBranchesQuery, useSearchReportsQuery } = searchApi;

/**
 * Command-palette style global search modal.
 * Completely decoupled from AppShell render tree.
 *
 * @component GlobalSearchModal
 * @param {object} props - Component properties.
 * @param {boolean} props.open - Modal visibility boolean.
 * @param {Function} props.onClose - Modal dismissal callback.
 * @returns {JSX.Element} Rendered command-palette dialog.
 */
export const GlobalSearchModal = memo(({ open, onClose }) => {
  const navigate = useNavigate();
  const [activeQuery, setActiveQuery] = useState('');

  // Fetch categorized records based on explicit query
  const shouldQuery = Boolean(activeQuery && activeQuery.length >= 1);

  const { data: branchesData, isFetching: isBranchesFetching } = useSearchBranchesQuery(
    { search: activeQuery, limit: 5 },
    { skip: !shouldQuery || !open }
  );

  const { data: reportsData, isFetching: isReportsFetching } = useSearchReportsQuery(
    { search: activeQuery, limit: 5 },
    { skip: !shouldQuery || !open }
  );

  const { data: chatsData, isFetching: isChatsFetching } = useGetChatsQuery(
    { search: activeQuery, limit: 5 },
    { skip: !shouldQuery || !open }
  );

  const handleSearch = useCallback((query) => {
    setActiveQuery(query.trim());
  }, []);

  const handleSelectBranch = useCallback(
    (branchId) => () => {
      onClose();
      navigate(`/branches/${branchId}/details`);
    },
    [navigate, onClose]
  );

  const handleSelectReport = useCallback(
    (reportId) => () => {
      onClose();
      navigate(`/reports/${reportId}/details`);
    },
    [navigate, onClose]
  );

  const handleSelectChat = useCallback(
    (chatId) => () => {
      onClose();
      navigate(`/chat/${chatId}`);
    },
    [navigate, onClose]
  );

  const branches = branchesData?.branches || branchesData?.data?.branches || [];
  const reports = reportsData?.reports || reportsData?.docs || reportsData?.data?.reports || reportsData?.data?.docs || [];
  const chats = chatsData?.chats || chatsData?.data?.chats || [];

  const isSearching = isBranchesFetching || isReportsFetching || isChatsFetching;
  const hasResults = branches.length > 0 || reports.length > 0 || chats.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableEnforceFocus={true}
      disableRestoreFocus={true}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '12px',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            border: 1,
            borderColor: 'divider',
            maxHeight: '80vh',
          },
        },
      }}
    >
      <DialogContent sx={{ p: 2 }}>
        {/* Isolated Zero-Lag Search Input */}
        <MuiSearchInput
          autoFocus
          placeholder="Search branches, reports, chats... (Press Enter)"
          initialValue={activeQuery}
          onSearch={handleSearch}
          fullWidth
          sx={{ mb: 2 }}
        />

        {/* Results Container */}
        {isSearching && (
          <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
            <CircularProgress size={28} thickness={4} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Searching branches, reports, and chats...
            </Typography>
          </Box>
        )}

        {!isSearching && shouldQuery && !hasResults && (
          <Box sx={{ py: 4, textAlign: 'center', px: 2 }}>
            <SearchOffIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
              No matches found for &quot;{activeQuery}&quot;
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', maxWidth: 360, display: 'block', mx: 'auto' }}>
              Try searching with English or Amharic (e.g. Bole, መድኃኒዓለም, Sarbet), branch codes (e.g. BOLE-01), or operational keywords.
            </Typography>
          </Box>
        )}

        {!isSearching && !shouldQuery && (
          <Box sx={{ py: 3, textAlign: 'center', px: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Type an operational branch name, report date, or keyword and press <strong>Enter</strong> or click <strong>[🔍]</strong>
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
              Supports English and Amharic queries (e.g. Bole, መድኃኒዓለም)
            </Typography>
          </Box>
        )}

        {!isSearching && hasResults && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Branch Network Matches */}
            {branches.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    px: 1,
                    display: 'block',
                    mb: 0.5,
                  }}
                >
                  Branch Network ({branches.length})
                </Typography>
                <List disablePadding>
                  {branches.map((b) => (
                    <ListItemButton
                      key={b._id}
                      onClick={handleSelectBranch(b._id)}
                      sx={{ borderRadius: '8px', py: 1, mb: 0.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, color: 'primary.main' }}>
                        <StorefrontIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {b.name}
                            </Typography>
                            <Chip label={b.code} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                          </Box>
                        }
                        secondary={b.location?.subcity || b.managerName || 'Addis Ababa'}
                      />
                      <ArrowForwardIosIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}

            {branches.length > 0 && (reports.length > 0 || chats.length > 0) && <Divider />}

            {/* Operational Reports Matches */}
            {reports.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    px: 1,
                    display: 'block',
                    mb: 0.5,
                  }}
                >
                  Operational Reports ({reports.length})
                </Typography>
                <List disablePadding>
                  {reports.map((r) => (
                    <ListItemButton
                      key={r._id}
                      onClick={handleSelectReport(r._id)}
                      sx={{ borderRadius: '8px', py: 1, mb: 0.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, color: 'success.main' }}>
                        <DescriptionIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {r.date ? new Date(r.date).toLocaleDateString() : 'Operational Audit'}
                            {r.ethiopianDate ? ` (${r.ethiopianDate})` : ''}
                          </Typography>
                        }
                        secondary={`${r.visits?.length || 0} branches visited • ${r.activities?.length || 0} activities`}
                      />
                      <ArrowForwardIosIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}

            {reports.length > 0 && chats.length > 0 && <Divider />}

            {/* Chat History Matches */}
            {chats.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    px: 1,
                    display: 'block',
                    mb: 0.5,
                  }}
                >
                  Chat Conversations ({chats.length})
                </Typography>
                <List disablePadding>
                  {chats.map((c) => (
                    <ListItemButton
                      key={c._id}
                      onClick={handleSelectChat(c._id)}
                      sx={{ borderRadius: '8px', py: 1, mb: 0.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, color: 'info.main' }}>
                        <ChatBubbleOutlineIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {c.title || 'Untitled Inspection'}
                          </Typography>
                        }
                        secondary={c.updatedAt ? new Date(c.updatedAt).toLocaleString() : ''}
                      />
                      <ArrowForwardIosIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
});

GlobalSearchModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default GlobalSearchModal;
