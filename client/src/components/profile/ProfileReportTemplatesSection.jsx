/**
 * @module components/profile/ProfileReportTemplatesSection
 * @description Isolated and memoized corporate report templates editor.
 * Eliminates keystroke lag in ProfileDirectivesTab by decoupling template text editing
 * from the directives ledger, phrase mapping table, and vocabulary chip collections.
 */

import { memo, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PropTypes from 'prop-types';

import MuiButton from '../reusable/MuiButton.jsx';
import MuiTextField from '../reusable/MuiTextField.jsx';
import { REPORT_CONSTANTS } from '../../utils/constants.js';

/**
 * Memoized report templates configuration section.
 * Employs 100% uncontrolled inputs and native DOM counter refs to guarantee zero-lag typing.
 *
 * @component ProfileReportTemplatesSection
 * @param {Object} props
 * @param {string} props.initialSingle - Initial single-branch template.
 * @param {string} props.initialMulti - Initial multi-branch template.
 * @param {Function} props.onSingleChange - Callback invoked on single template changes.
 * @param {Function} props.onMultiChange - Callback invoked on multi template changes.
 * @param {Function} props.onReset - Callback when user clicks Reset Defaults.
 * @param {number} [props.resetCounter] - External trigger to re-initialize fields.
 * @returns {import('react').JSX.Element}
 */
export const ProfileReportTemplatesSection = memo(({
  initialSingle,
  initialMulti,
  onSingleChange,
  onMultiChange,
  onReset,
  resetCounter = 0,
}) => {
  const singleInputRef = useRef(null);
  const multiInputRef = useRef(null);
  const singleCountRef = useRef(null);
  const multiCountRef = useRef(null);

  useEffect(() => {
    if (singleInputRef.current) {
      singleInputRef.current.value = initialSingle || '';
    }
    if (singleCountRef.current) {
      singleCountRef.current.textContent = `${(initialSingle || '').length}`;
    }
  }, [initialSingle, resetCounter]);

  useEffect(() => {
    if (multiInputRef.current) {
      multiInputRef.current.value = initialMulti || '';
    }
    if (multiCountRef.current) {
      multiCountRef.current.textContent = `${(initialMulti || '').length}`;
    }
  }, [initialMulti, resetCounter]);

  const handleSingleInput = (e) => {
    if (singleCountRef.current) {
      singleCountRef.current.textContent = `${e.target.value.length}`;
    }
  };

  const handleSingleBlur = (e) => {
    onSingleChange(e.target.value);
  };

  const handleMultiInput = (e) => {
    if (multiCountRef.current) {
      multiCountRef.current.textContent = `${e.target.value.length}`;
    }
  };

  const handleMultiBlur = (e) => {
    onMultiChange(e.target.value);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DescriptionOutlinedIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Corporate Report Templates (SSOT)
          </Typography>
        </Box>
        <MuiButton
          variant="text"
          color="inherit"
          size="small"
          startIcon={<RestartAltIcon fontSize="small" />}
          onClick={onReset}
          sx={{ color: 'text.secondary' }}
        >
          Reset Defaults
        </MuiButton>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
        Authoritative Amharic report layouts applied when synthesizing inspection records (up to{' '}
        {REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH.toLocaleString()} characters each). Leave blank to use system standard templates.
      </Typography>

      <Grid container spacing={{ xs: 2, sm: 2.5 }}>
        <Grid size={{ xs: 12 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
            Single-Branch Inspection Template
          </Typography>
          <MuiTextField
            inputRef={singleInputRef}
            multiline
            rows={4}
            fullWidth
            defaultValue={initialSingle || ''}
            onInput={handleSingleInput}
            onBlur={handleSingleBlur}
            placeholder="Enter custom Single-Branch report header and section layout..."
            helperText={
              <Box component="span">
                <Box component="span" ref={singleCountRef}>
                  {(initialSingle || '').length}
                </Box>
                /{REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH.toLocaleString()} characters
              </Box>
            }
            slotProps={{
              htmlInput: { maxLength: REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH },
            }}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
            Multi-Branch Consolidated Inspection Template
          </Typography>
          <MuiTextField
            inputRef={multiInputRef}
            multiline
            rows={4}
            fullWidth
            defaultValue={initialMulti || ''}
            onInput={handleMultiInput}
            onBlur={handleMultiBlur}
            placeholder="Enter custom Multi-Branch report header and branch-separated layout..."
            helperText={
              <Box component="span">
                <Box component="span" ref={multiCountRef}>
                  {(initialMulti || '').length}
                </Box>
                /{REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH.toLocaleString()} characters
              </Box>
            }
            slotProps={{
              htmlInput: { maxLength: REPORT_CONSTANTS.TEMPLATE_MAX_LENGTH },
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
});

ProfileReportTemplatesSection.displayName = 'ProfileReportTemplatesSection';

ProfileReportTemplatesSection.propTypes = {
  initialSingle: PropTypes.string,
  initialMulti: PropTypes.string,
  onSingleChange: PropTypes.func.isRequired,
  onMultiChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  resetCounter: PropTypes.number,
};

export default ProfileReportTemplatesSection;
