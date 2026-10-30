/**
 * @module components/chat/MuiComposerBottomToolbar
 * @description Ergonomic bottom toolbar for the chat composer (Row 3).
 * Dual-cluster layout:
 * - Left Cluster: MuiAttachButton (and in subsequent steps: Model Selector)
 * - Right Cluster: MuiSendButton (and in subsequent steps: Audio Recorder)
 */

import { forwardRef, useState } from 'react';
import Box from '@mui/material/Box';
import MuiSendButton from './MuiSendButton.jsx';
import MuiAttachButton from './MuiAttachButton.jsx';
import MuiAudioRecorder from './MuiAudioRecorder.jsx';
import MuiLiveSttButton from './MuiLiveSttButton.jsx';
import MuiModelSelector from './MuiModelSelector.jsx';

/**
 * MuiComposerBottomToolbar component.
 */
export const MuiComposerBottomToolbar = forwardRef((props, ref) => {
  const [isLiveSttActive, setIsLiveSttActive] = useState(false);

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <MuiAttachButton disabled={props?.disabled} />
        <MuiModelSelector disabled={props?.disabled} />
      </Box>

      {/* Right Cluster: Audio Dictation, Live STT & Send / Stop Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <Box sx={{ display: isLiveSttActive ? 'none' : 'inline-flex' }}>
          <MuiAudioRecorder disabled={props?.disabled} />
        </Box>
        <MuiLiveSttButton
          disabled={props?.disabled}
          onActiveChange={setIsLiveSttActive}
        />
        <MuiSendButton disabled={props?.disabled} />
      </Box>
    </Box>
  );
});

MuiComposerBottomToolbar.displayName = 'MuiComposerBottomToolbar';

export default MuiComposerBottomToolbar;
