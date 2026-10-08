/**
 * @module components/chat/MuiComposerBottomToolbar
 * @description Ergonomic bottom toolbar for the chat composer (Row 3).
 * Dual-cluster layout:
 * - Left Cluster: MuiAttachButton (and in subsequent steps: Model Selector)
 * - Right Cluster: MuiSendButton (and in subsequent steps: Audio Recorder)
 */

import { forwardRef } from 'react';
import Box from '@mui/material/Box';
import MuiSendButton from './MuiSendButton.jsx';
import MuiAttachButton from './MuiAttachButton.jsx';
import MuiAudioRecorder from './MuiAudioRecorder.jsx';

/**
 * MuiComposerBottomToolbar component.
 */
export const MuiComposerBottomToolbar = forwardRef((props, ref) => {
  return (
    <Box
      ref={ref}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        pt: 0.5,
        px: 0.5,
      }}
    >
      {/* Left Cluster: Attachments & Inference Settings */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <MuiAttachButton disabled={props?.disabled} />
      </Box>

      {/* Right Cluster: Audio Dictation & Send / Stop Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <MuiAudioRecorder disabled={props?.disabled} />
        <MuiSendButton disabled={props?.disabled} />
      </Box>
    </Box>
  );
});

MuiComposerBottomToolbar.displayName = 'MuiComposerBottomToolbar';

export default MuiComposerBottomToolbar;
