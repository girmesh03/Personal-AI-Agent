/**
 * @module components/reusable/MuiDialog
 * @description Enterprise-grade, accessible Material-UI Dialog modal wrapper.
 * Strictly eliminates the browser warning:
 * "Blocked aria-hidden on an element because its descendant that has focus was not hidden"
 * by enforcing disableEnforceFocus={true} and disableRestoreFocus={true}.
 * Automatically provides responsive fullScreen on mobile viewports (< 600px).
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

/**
 * Accessible, responsive modal dialog wrapper.
 *
 * @component MuiDialog
 * @param {object} props - Component properties.
 * @param {boolean} props.open - Modal visibility state.
 * @param {() => void} props.onClose - Modal dismissal callback.
 * @param {import('react').ReactNode} props.title - Modal title header.
 * @param {import('react').ReactNode} props.children - Modal body content.
 * @param {import('react').ReactNode} [props.actions] - Optional dialog actions button deck.
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|false} [props.maxWidth='sm'] - Maximum dialog width breakpoint.
 * @param {boolean} [props.fullWidth=true] - Whether dialog spans up to maxWidth.
 * @param {boolean} [props.fullScreenOnMobile=true] - Whether to adapt to fullscreen on xs (< 600px).
 * @param {boolean} [props.disablePortal=false] - Whether to render inline rather than via portal.
 * @param {object} [props.slotProps={}] - Granular slotProps overrides for dialog elements.
 * @returns {import('react').JSX.Element} Rendered modal dialog.
 */
export const MuiDialog = memo(({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
  fullScreenOnMobile = true,
  disablePortal = false,
  slotProps = {},
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isFullScreen = fullScreenOnMobile && isMobile;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isFullScreen}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      disablePortal={disablePortal}
      disableEnforceFocus={true}
      disableRestoreFocus={true}
      aria-labelledby="mui-dialog-title"
      slotProps={{
        paper: {
          sx: {
            borderRadius: isFullScreen ? 0 : 2.5,
            p: 0,
            backgroundImage: 'none',
            overflow: 'hidden',
            ...(slotProps.paper?.sx || {}),
          },
          ...slotProps.paper,
        },
        backdrop: slotProps.backdrop,
      }}
    >
      {title && (
        <DialogTitle
          id="mui-dialog-title"
          sx={{
            m: 0,
            px: { xs: 2, sm: 3 },
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {typeof title === 'string' ? (
            <Typography variant="h6" component="div" sx={{ fontWeight: 600, fontSize: { xs: '1.05rem', sm: '1.25rem' } }}>
              {title}
            </Typography>
          ) : (
            title
          )}
          {onClose && (
            <IconButton
              aria-label="close"
              onClick={onClose}
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': { color: 'text.primary' },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </DialogTitle>
      )}

      <DialogContent
        dividers
        sx={{
          p: { xs: 2, sm: 3 },
          ...(slotProps.content?.sx || {}),
        }}
      >
        {children}
      </DialogContent>

      {actions && (
        <DialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            py: 2,
            gap: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
            ...(slotProps.actions?.sx || {}),
          }}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
});

MuiDialog.displayName = 'MuiDialog';

MuiDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  title: PropTypes.node,
  children: PropTypes.node,
  actions: PropTypes.node,
  maxWidth: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl', false]),
  fullWidth: PropTypes.bool,
  fullScreenOnMobile: PropTypes.bool,
  disablePortal: PropTypes.bool,
  slotProps: PropTypes.object,
};

export default MuiDialog;
