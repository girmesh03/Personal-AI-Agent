/**
 * @module pages/Profile
 * @description Supervisor Profile, Account Governance, AI Inference Settings, Directives SSOT, and Cloud Integrations canvas.
 * Follows declarative orchestrator architecture, importing domain components from components/profile/*.
 */

import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import PersonIcon from '@mui/icons-material/Person';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import RuleIcon from '@mui/icons-material/Rule';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import SendIcon from '@mui/icons-material/Send';

import { selectAuthUser } from '../redux/features/authSlice.js';
import ProfileHeaderHero from '../components/profile/ProfileHeaderHero.jsx';
import ProfileAccountTab from '../components/profile/ProfileAccountTab.jsx';
import ProfileSecurityTab from '../components/profile/ProfileSecurityTab.jsx';
import ProfileAgentConfigTab from '../components/profile/ProfileAgentConfigTab.jsx';
import ProfileDirectivesTab from '../components/profile/ProfileDirectivesTab.jsx';
import CloudIntegrationsTab from '../components/profile/CloudIntegrationsTab.jsx';
import ProfileTelegramTab from '../components/profile/ProfileTelegramTab.jsx';
import ProfileDangerZone from '../components/profile/ProfileDangerZone.jsx';

const TAB_INDEX_MAP = {
  account: 0,
  security: 1,
  'ai-agent': 2,
  directives: 3,
  'cloud-integrations': 4,
  telegram: 5,
};

const TAB_NAME_MAP = {
  0: 'account',
  1: 'security',
  2: 'ai-agent',
  3: 'directives',
  4: 'cloud-integrations',
  5: 'telegram',
};

/**
 * Supervisor Profile and Governance Page.
 *
 * @component Profile
 * @returns {import('react').JSX.Element} Rendered profile canvas.
 */
export const Profile = () => {
  const user = useSelector(selectAuthUser);
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const activeTab = useMemo(() => {
    if (tabParam && TAB_INDEX_MAP[tabParam] !== undefined) {
      return TAB_INDEX_MAP[tabParam];
    }
    return 0; // Default to Account Profile
  }, [tabParam]);

  const handleTabChange = (_event, newIndex) => {
    const tabName = TAB_NAME_MAP[newIndex] || 'account';
    setSearchParams({ tab: tabName }, { replace: true });
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        p: { xs: 1.25, sm: 2.5, md: 3.5 },
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        {/* User Identity Header Hero */}
        <ProfileHeaderHero user={user} />

        {/* Section Navigation Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, sm: 3 } }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Profile and Governance Tabs"
            sx={{
              minHeight: { xs: 40, sm: 48 },
              '& .MuiTabs-scrollButtons': {
                width: 36,
                transition: 'opacity 0.2s ease, color 0.2s ease',
                '&.Mui-disabled': {
                  opacity: 0.2,
                  cursor: 'default',
                  pointerEvents: 'none',
                },
                '&:not(.Mui-disabled)': {
                  opacity: 0.85,
                  color: 'primary.main',
                  '&:hover': {
                    opacity: 1,
                    bgcolor: 'action.hover',
                  },
                },
              },
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none',
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                minHeight: { xs: 40, sm: 48 },
                py: { xs: 0.5, sm: 1 },
                px: { xs: 1.25, sm: 2 },
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
              icon={<LockOutlinedIcon fontSize="small" />}
              iconPosition="start"
              label="Security & Password"
              id="profile-tab-1"
              aria-controls="profile-tabpanel-1"
            />
            <Tab
              icon={<SmartToyOutlinedIcon fontSize="small" />}
              iconPosition="start"
              label="AI Agent & Inference"
              id="profile-tab-2"
              aria-controls="profile-tabpanel-2"
            />
            <Tab
              icon={<RuleIcon fontSize="small" />}
              iconPosition="start"
              label="Directives & Templates"
              id="profile-tab-3"
              aria-controls="profile-tabpanel-3"
            />
            <Tab
              icon={<CloudQueueIcon fontSize="small" />}
              iconPosition="start"
              label="Cloud Workspace"
              id="profile-tab-4"
              aria-controls="profile-tabpanel-4"
            />
            <Tab
              icon={<SendIcon fontSize="small" />}
              iconPosition="start"
              label="Telegram Channels"
              id="profile-tab-5"
              aria-controls="profile-tabpanel-5"
            />
          </Tabs>
        </Box>

        {/* Tab 0: Account Profile & Photo Deck + Danger Zone */}
        {activeTab === 0 && (
          <Box role="tabpanel" id="profile-tabpanel-0" aria-labelledby="profile-tab-0">
            <ProfileAccountTab user={user} />
            <ProfileDangerZone />
          </Box>
        )}

        {/* Tab 1: Security & Password Management */}
        {activeTab === 1 && (
          <Box role="tabpanel" id="profile-tabpanel-1" aria-labelledby="profile-tab-1">
            <ProfileSecurityTab />
          </Box>
        )}

        {/* Tab 2: AI Agent & Inference Configuration */}
        {activeTab === 2 && (
          <Box role="tabpanel" id="profile-tabpanel-2" aria-labelledby="profile-tab-2">
            <ProfileAgentConfigTab user={user} />
          </Box>
        )}

        {/* Tab 3: Supervisor Directives & Report Templates SSOT */}
        {activeTab === 3 && (
          <Box role="tabpanel" id="profile-tabpanel-3" aria-labelledby="profile-tab-3">
            <ProfileDirectivesTab user={user} />
          </Box>
        )}

        {/* Tab 4: Cloud Workspace & Google Drive Integration */}
        {activeTab === 4 && (
          <Box role="tabpanel" id="profile-tabpanel-4" aria-labelledby="profile-tab-4">
            <CloudIntegrationsTab />
          </Box>
        )}

        {/* Tab 5: Telegram Operational Channels */}
        {activeTab === 5 && (
          <Box role="tabpanel" id="profile-tabpanel-5" aria-labelledby="profile-tab-5">
            <ProfileTelegramTab user={user} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Profile;
