/**
 * @module components/branches/MuiBranchDialog
 * @description Create & Edit modal dialog for physical operating store branches.
 * Wraps MuiDialog (enforcing disableEnforceFocus & disableRestoreFocus).
 * Strictly adheres to the Zero-Lag Law (Invariant 22, 43): 100% uncontrolled native inputs
 * with defaultValue, eliminating per-keystroke React reconciliations and re-renders.
 * Supports responsive fullScreen on mobile (< 600px) and handles HTTP 409 collisions.
 */

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import MuiDialog from '../reusable/MuiDialog.jsx';
import MuiButton from '../reusable/MuiButton.jsx';
import MuiTextField from '../reusable/MuiTextField.jsx';
import { useCreateBranchMutation, useUpdateBranchMutation } from '../../redux/features/branchSlice.js';
import { toast } from 'react-toastify';

/**
 * Standard municipal subcities of Addis Ababa.
 * @constant
 */
const ADDIS_ABABA_SUBCITIES = [
  'Bole',
  'Arada',
  'Kirkos',
  'Yeka',
  'Nifas Silk-Lafto',
  'Kolfe Keranio',
  'Gullele',
  'Lideta',
  'Akaky Kaliti',
  'Addis Ketema',
  'Lemi Kura',
];

/**
 * Modal dialog for creating and updating operational store branches with zero typing lag.
 *
 * @component MuiBranchDialog
 * @param {object} props - Component properties.
 * @param {boolean} props.open - Modal visibility state.
 * @param {() => void} props.onClose - Modal dismissal handler.
 * @param {object|null} [props.branch=null] - Branch record for edit mode (null for create mode).
 * @param {(savedBranch: object) => void} [props.onSuccess] - Callback invoked on successful save.
 * @returns {import('react').JSX.Element} Rendered branch dialog element.
 */
export const MuiBranchDialog = memo(({
  open,
  onClose,
  branch = null,
  onSuccess,
}) => {
  const isEditMode = Boolean(branch);
  const formRef = useRef(null);
  const [subcity, setSubcity] = useState('Bole');
  const [errors, setErrors] = useState({});

  const [createBranch, { isLoading: isCreating }] = useCreateBranchMutation();
  const [updateBranch, { isLoading: isUpdating }] = useUpdateBranchMutation();
  const isSubmitting = isCreating || isUpdating;

  // Initialize subcity and reset errors when modal opens or active branch changes
  useEffect(() => {
    if (open) {
      setSubcity(branch?.location?.subcity || 'Bole');
      setErrors({});
    }
  }, [open, branch]);

  // Form submission handler using native uncontrolled FormData
  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    const form = formRef.current || e?.currentTarget;
    if (!form) return;

    const data = new FormData(form);
    const trimmedName = String(data.get('name') || '').trim();
    const selectedSubcity = subcity || String(data.get('subcity') || '').trim();
    const trimmedCity = String(data.get('city') || 'Addis Ababa').trim();
    const trimmedAddress = String(data.get('address') || '').trim();
    const trimmedManager = String(data.get('managerName') || '').trim();
    const trimmedPhone = String(data.get('contactPhone') || '').trim();

    // Synchronous client validation
    const newErrors = {};
    if (!trimmedName) {
      newErrors.name = 'Branch name is required.';
    } else if (trimmedName.length < 2) {
      newErrors.name = 'Branch name must be at least 2 characters.';
    } else if (trimmedName.length > 50) {
      newErrors.name = 'Branch name cannot exceed 50 characters.';
    }

    if (!selectedSubcity) {
      newErrors.subcity = 'Subcity is required.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      name: trimmedName,
      location: {
        city: trimmedCity || 'Addis Ababa',
        subcity: selectedSubcity,
        address: trimmedAddress,
      },
      managerName: trimmedManager,
      contactPhone: trimmedPhone,
    };

    try {
      let savedResult;
      if (isEditMode) {
        savedResult = await updateBranch({
          branchId: branch._id,
          ...payload,
        }).unwrap();
        toast.success(`Branch "${trimmedName}" updated successfully.`);
      } else {
        savedResult = await createBranch(payload).unwrap();
        toast.success(`Branch "${trimmedName}" created successfully.`);
      }

      const savedBranch = savedResult?.branch || savedResult?.data?.branch;
      if (onSuccess) {
        onSuccess(savedBranch);
      }
      onClose();
    } catch (err) {
      // Handle HTTP 409 Conflict: Duplicate branch name collision
      if (
        err?.status === 409 ||
        err?.data?.status === 409 ||
        err?.data?.message?.toLowerCase().includes('already exists')
      ) {
        setErrors((prev) => ({
          ...prev,
          name: 'A branch with this name already exists. Please choose a distinct name.',
        }));
      } else {
        toast.error(err?.data?.message || 'Failed to save branch. Please try again.');
      }
    }
  }, [subcity, isEditMode, branch, createBranch, updateBranch, onSuccess, onClose]);

  return (
    <MuiDialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      title={isEditMode ? 'Edit Operational Branch' : 'Add Operational Branch'}
      maxWidth="sm"
      fullWidth
      actions={
        <>
          <MuiButton
            variant="outlined"
            color="inherit"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </MuiButton>
          <MuiButton
            type="submit"
            form="branch-form"
            variant="contained"
            color="primary"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isSubmitting
              ? isEditMode ? 'Saving...' : 'Creating...'
              : isEditMode ? 'Save Changes' : 'Create Branch'}
          </MuiButton>
        </>
      }
    >
      {/* Dynamic key guarantees instant pristine reset of uncontrolled defaultValue inputs on open/branch change */}
      <Box
        component="form"
        id="branch-form"
        key={open ? (branch?._id || 'new-branch') : 'closed'}
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        sx={{ mt: 0.5 }}
      >
        <Grid container spacing={2}>
          {/* Branch Name Field (100% Uncontrolled, Zero Keystroke Lag) */}
          <Grid size={{ xs: 12 }}>
            <MuiTextField
              name="name"
              label="Branch Name"
              placeholder="e.g. Bole Medhanialem (ቦሌ መድኃኔዓለም)"
              defaultValue={branch?.name || ''}
              onFocus={() => {
                if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
              }}
              error={Boolean(errors.name)}
              helperText={errors.name || 'Required. Bilingual Amharic and English script supported.'}
              fullWidth
              required
              autoFocus
              disabled={isSubmitting}
              startAdornment={<StorefrontOutlinedIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />}
            />
          </Grid>

          {/* Subcity Selection */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <MuiTextField
              select
              name="subcity"
              label="Subcity"
              value={subcity}
              onChange={(e) => {
                setSubcity(e.target.value);
                if (errors.subcity) setErrors((prev) => ({ ...prev, subcity: null }));
              }}
              error={Boolean(errors.subcity)}
              helperText={errors.subcity || 'Required store municipal subcity.'}
              fullWidth
              required
              disabled={isSubmitting}
              startAdornment={<PlaceOutlinedIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />}
            >
              {ADDIS_ABABA_SUBCITIES.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </MuiTextField>
          </Grid>

          {/* City Field (Uncontrolled) */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <MuiTextField
              name="city"
              label="City"
              defaultValue={branch?.location?.city || 'Addis Ababa'}
              fullWidth
              disabled={isSubmitting}
            />
          </Grid>

          {/* Physical Address / Landmark (Uncontrolled) */}
          <Grid size={{ xs: 12 }}>
            <MuiTextField
              name="address"
              label="Street Address / Landmark"
              placeholder="e.g. Next to Edna Mall, Ground Floor"
              defaultValue={branch?.location?.address || ''}
              fullWidth
              disabled={isSubmitting}
              helperText="Physical street address or nearby commercial landmarks."
            />
          </Grid>

          {/* Store Manager Name (Uncontrolled) */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <MuiTextField
              name="managerName"
              label="Store Manager Name"
              placeholder="e.g. Tigist Alemu"
              defaultValue={branch?.managerName || ''}
              fullWidth
              disabled={isSubmitting}
              startAdornment={<PersonOutlinedIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />}
            />
          </Grid>

          {/* Contact Telephone (Uncontrolled) */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <MuiTextField
              name="contactPhone"
              label="Contact Telephone"
              placeholder="e.g. 0911223344"
              defaultValue={branch?.contactPhone || ''}
              fullWidth
              disabled={isSubmitting}
              startAdornment={<PhoneOutlinedIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />}
              helperText="Direct operational telephone contact."
            />
          </Grid>
        </Grid>
      </Box>
    </MuiDialog>
  );
});

MuiBranchDialog.displayName = 'MuiBranchDialog';

MuiBranchDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  branch: PropTypes.object,
  onSuccess: PropTypes.func,
};

export default MuiBranchDialog;
