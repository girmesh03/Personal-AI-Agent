/**
 * @module components/reusable/MuiConfirmDialog
 * @description Generic, reusable confirmation dialog modal adhering strictly to modern MUI
 * slotProps (zero deprecated props) and the Universal Arrow Functions Law.
 */

import PropTypes from 'prop-types';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import MuiButton from './MuiButton.jsx';

/**
 * Universal confirmation modal component.
 *
 * @component MuiConfirmDialog
 * @param {object} props - Component properties.
 * @param {boolean} props.open - Modal visibility state.
 * @param {() => void} props.onClose - Modal dismissal handler.
 * @param {() => void} props.onConfirm - Action confirmation handler.
 * @param {string} [props.title='Confirm Action'] - Dialog header title.
 * @param {string} [props.message='Are you sure you want to proceed?'] - Descriptive body notice.
 * @param {string} [props.confirmText='Confirm'] - Confirmation action label.
 * @param {string} [props.cancelText='Cancel'] - Rejection / dismissal action label.
 * @param {'error'|'primary'|'secondary'|'warning'} [props.confirmColor='error'] - Primary action intent color.
 * @param {boolean} [props.loading=false] - Whether operation is currently executing.
 * @returns {import('react').JSX.Element} Rendered confirmation dialog element.
 */
export const MuiConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'error',
  loading = false,
  disablePortal = false,
}) => {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      disablePortal={disablePortal}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            p: 1,
            backgroundImage: "none",
            minWidth: { xs: 280, sm: 360 },
          },
        },
      }}
    >
      <DialogTitle id="confirm-dialog-title" sx={{ fontWeight: 600, pb: 1 }}>
        {title}
      </DialogTitle>
      <DialogContent sx={{ py: 1 }}>
        <DialogContentText id="confirm-dialog-description" sx={{ color: 'text.secondary' }}>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5, gap: 1 }}>
        <MuiButton
          variant="outlined"
          color="inherit"
          onClick={onClose}
          disabled={loading}
        >
          {cancelText}
        </MuiButton>
        <MuiButton
          variant="contained"
          color={confirmColor}
          onClick={onConfirm}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {confirmText}
        </MuiButton>
      </DialogActions>
    </Dialog>
  );
};

MuiConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  confirmColor: PropTypes.oneOf(['error', 'primary', 'secondary', 'warning']),
  loading: PropTypes.bool,
  disablePortal: PropTypes.bool,
};

export default MuiConfirmDialog;
