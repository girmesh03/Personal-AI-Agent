/**
 * @module pages/Chat
 * @description Universal AI chat and shift synthesis canvas placeholder.
 */

import { Link } from 'react-router';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import MuiButton from '../components/reusable/MuiButton.jsx';
import MuiEmptyState from '../components/reusable/MuiEmptyState.jsx';

/**
 * Universal AI chat and shift synthesis canvas view placeholder.
 *
 * @component Chat
 * @returns {JSX.Element} Rendered chat view presentation.
 */
export const Chat = () => {
  return (
    <MuiEmptyState
      icon={<SmartToyIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />}
      title="Universal AI Chat & Shift Synthesis"
      subtitle="@mui/x-chat conversational canvas, audio recording HUD, and closed-loop Amharic corporate shift report synthesis will be mounted here in Milestones 3-6."
      action={
        <MuiButton variant="outlined" size="small" component={Link} to="/dashboard">
          Back to Dashboard
        </MuiButton>
      }
    />
  );
};

export default Chat;
