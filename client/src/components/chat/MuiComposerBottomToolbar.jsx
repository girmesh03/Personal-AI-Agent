/**
 * @module components/chat/MuiComposerBottomToolbar
 * @description Bottom toolbar for MUI X Chat composer.
 * In Step 1 baseline, cleanly houses strictly MuiSendButton docked to the right.
 * Additional controls (Attach, Model Selector, Audio Recorder) will be added
 * sequentially in subsequent subtasks after isolated testing.
 */

import React from 'react';
import Box from '@mui/material/Box';
import MuiSendButton from './MuiSendButton.jsx';

/**
 * MuiComposerBottomToolbar component.
 * @param {object} props - Component props passed from ChatComposer slot.
 * @returns {React.ReactElement}
 */
export const MuiComposerBottomToolbar = (props) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        px: 1,
        pb: 0.75,
        pt: 0.25,
        width: '100%',
        boxSizing: 'border-box',
        transition: 'none !important',
        animation: 'none !important',
      }}
    >
      <MuiSendButton disabled={props?.disabled} />
    </Box>
  );
};

export default React.memo(MuiComposerBottomToolbar);
