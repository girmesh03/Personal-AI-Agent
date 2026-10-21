/**
 * @module pages/Profile
 * @description Supervisor profile, account overview, and cloud workspace integrations page.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import PersonIcon from '@mui/icons-material/Person';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { selectAuthUser } from '../redux/features/authSlice.js';
import MuiButton from '../components/reusable/MuiButton.jsx';
import CloudIntegrationsTab from '../components/profile/CloudIntegrationsTab.jsx';

/**
 * Supervisor profile and settings view with account details and cloud workspace integration.
 *
 * @component Profile
 * @returns {import('react').JSX.Element} Rendered profile page view.
 */
export const Profile = () => {
  const user = useSelector(selectAuthUser);
  const [activeTab, setActiveTab] = useState(1); // Default to Cloud Integrations tab for immediate discoverability

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'U';

  const fullName =
    user?.fullName ||
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() ||
    'Supervisor';

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        p: { xs: 2, sm: 3, md: 4 },
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ maxWidth: 860, mx: 'auto' }}>
        {/* Navigation & Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <MuiButton
            variant="text"
            color="inherit"
            size="small"
            component={Link}
            to="/chat"
            startIcon={<ArrowBackIcon fontSize="small" />}
            sx={{ color: 'text.secondary', fontWeight: 500 }}
          >
            Back to Chat
          </MuiButton>

          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Account Settings & Integrations
          </Typography>
        </Box>

        {/* User Identity Header Card */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: '12px',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            mb: 3,
            boxShadow: 'none',
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  bgcolor: 'primary.main',
                }}
              >
                {initials}
              </Avatar>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.15rem', lineHeight: 1.2 }}>
                  {fullName}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 0.5 }}>
                  {user?.email || 'user@example.com'}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                  <Chip
                    label={user?.position || 'Area Supervisor'}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem', height: 22 }}
                  />
                  <Chip
                    label="Personal AI Agent Active"
                    size="small"
                    color="primary"
                    variant="filled"
                    sx={{ fontSize: '0.75rem', height: 22, fontWeight: 600 }}
                  />
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Section Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(_e, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Profile and Settings Tabs"
            sx={{
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '0.9rem',
                minHeight: 44,
                py: 1,
                whiteSpace: 'nowrap',
              },
            }}
          >
            <Tab
              icon={<PersonIcon fontSize="small" />}
              iconPosition="start"
              label="Account Profile"
              id="profile-tab-0"
              aria-controls="profile-tabpanel-0"
            />
            <Tab
              icon={<CloudQueueIcon fontSize="small" />}
              iconPosition="start"
              label="Cloud Workspace & Google Drive"
              id="profile-tab-1"
              aria-controls="profile-tabpanel-1"
            />
          </Tabs>
        </Box>

        {/* Tab 0: Account Profile Overview */}
        {activeTab === 0 && (
          <Box role="tabpanel" id="profile-tabpanel-0" aria-labelledby="profile-tab-0">
            <Card
              variant="outlined"
              sx={{
                borderRadius: '12px',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                boxShadow: 'none',
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1 }}>
                  Personal Information
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Your profile identity is used by your Personal AI Agent to tailor report headers and communications.
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={2} sx={{ maxWidth: 480 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      Full Name
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {fullName}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      Corporate Email
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {user?.email || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      Operational Role
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {user?.position || 'Area Supervisor'}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Tab 1: Cloud Workspace & Integrations */}
        {activeTab === 1 && (
          <Box role="tabpanel" id="profile-tabpanel-1" aria-labelledby="profile-tab-1">
            <CloudIntegrationsTab />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Profile;
