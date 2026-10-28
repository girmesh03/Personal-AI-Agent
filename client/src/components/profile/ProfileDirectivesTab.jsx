/**
 * @module components/profile/ProfileDirectivesTab
 * @description Supervisor Directives, Negative Vocabulary, Phrase Mappings, and Report Templates SSOT tab.
 * Enforces zero-lag typing, clear end-adornments, in-place rule editing, scrollable growing containers,
 * and strict sx alignment styling.
 */

import { useState, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ClearIcon from '@mui/icons-material/Clear';
import SaveIcon from '@mui/icons-material/Save';
import BlockIcon from '@mui/icons-material/Block';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import RuleIcon from '@mui/icons-material/Rule';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';

import {
  useUpdateDirectivesMutation,
  useUpdateAgentConfigMutation,
} from '../../redux/features/userSlice.js';
import MuiButton from '../reusable/MuiButton.jsx';
import MuiTextField from '../reusable/MuiTextField.jsx';
import ProfileReportTemplatesSection from './ProfileReportTemplatesSection.jsx';

/**
 * Directives & Report Templates SSOT tab.
 *
 * @component ProfileDirectivesTab
 * @param {object} props - Component properties.
 * @param {object} props.user - Current supervisor user object.
 * @returns {import('react').JSX.Element} Rendered directives tab.
 */
export const ProfileDirectivesTab = ({ user }) => {
  const [updateDirectives, { isLoading: isUpdatingDirectives }] = useUpdateDirectivesMutation();
  const [updateAgentConfig, { isLoading: isUpdatingTemplates }] = useUpdateAgentConfigMutation();

  const initialDirectives = user?.settings?.directives || {};
  const initialTemplates = user?.settings?.reportTemplates || {};

  // Directives State
  const [negativeVocabulary, setNegativeVocabulary] = useState(
    Array.isArray(initialDirectives.negativeVocabulary) ? initialDirectives.negativeVocabulary : []
  );

  const [phraseMappings, setPhraseMappings] = useState(() => {
    const raw = initialDirectives.phraseMappings;
    if (!raw) return {};
    if (raw instanceof Map) return Object.fromEntries(raw);
    return typeof raw === 'object' ? raw : {};
  });

  const [customInstructions, setCustomInstructions] = useState(
    Array.isArray(initialDirectives.customInstructions) ? initialDirectives.customInstructions : []
  );

  // In-Place Rule Edit State
  const [editingRuleIndex, setEditingRuleIndex] = useState(null);
  const editRuleInputRef = useRef(null);

  // Report Templates State (Isolated Uncontrolled Refs for Zero-Lag Typing)
  const [resetCounter, setResetCounter] = useState(0);
  const singleTemplateRef = useRef(initialTemplates.singleBranch || '');
  const multiTemplateRef = useRef(initialTemplates.multiBranch || '');

  const handleSingleChange = useCallback((val) => {
    singleTemplateRef.current = val;
  }, []);

  const handleMultiChange = useCallback((val) => {
    multiTemplateRef.current = val;
  }, []);

  // Uncontrolled Input Refs for Zero-Lag Typing
  const newWordInputRef = useRef(null);
  const mappingKeyInputRef = useRef(null);
  const mappingValInputRef = useRef(null);
  const newInstructionInputRef = useRef(null);

  // Direct DOM Refs for Clear Buttons (100% Zero-Lag: Zero React state updates while typing)
  const clearWordBtnRef = useRef(null);
  const clearMappingKeyBtnRef = useRef(null);
  const clearMappingValBtnRef = useRef(null);
  const clearInstructionBtnRef = useRef(null);

  // 1. Negative Vocabulary Handlers
  const handleAddNegativeWord = () => {
    const word = newWordInputRef.current?.value?.trim();
    if (!word) return;
    if (negativeVocabulary.includes(word)) {
      toast.warning(`'${word}' is already in negative vocabulary.`);
      return;
    }
    setNegativeVocabulary((prev) => [...prev, word]);
    if (newWordInputRef.current) {
      newWordInputRef.current.value = '';
      newWordInputRef.current.focus();
    }
    if (clearWordBtnRef.current) {
      clearWordBtnRef.current.style.display = 'none';
    }
  };

  const handleClearNegativeWord = () => {
    if (newWordInputRef.current) {
      newWordInputRef.current.value = '';
      newWordInputRef.current.focus();
    }
    if (clearWordBtnRef.current) {
      clearWordBtnRef.current.style.display = 'none';
    }
  };

  const handleRemoveNegativeWord = (targetWord) => {
    setNegativeVocabulary((prev) => prev.filter((w) => w !== targetWord));
  };

  // 2. Phrase Mappings Handlers
  const handleAddPhraseMapping = () => {
    const key = mappingKeyInputRef.current?.value?.trim();
    const val = mappingValInputRef.current?.value?.trim();
    if (!key || !val) {
      toast.error('Both shorthand key and corporate replacement are required.');
      return;
    }
    setPhraseMappings((prev) => ({ ...prev, [key]: val }));
    if (mappingKeyInputRef.current) mappingKeyInputRef.current.value = '';
    if (mappingValInputRef.current) mappingValInputRef.current.value = '';
    if (clearMappingKeyBtnRef.current) clearMappingKeyBtnRef.current.style.display = 'none';
    if (clearMappingValBtnRef.current) clearMappingValBtnRef.current.style.display = 'none';
  };

  const handleClearMappingKey = () => {
    if (mappingKeyInputRef.current) {
      mappingKeyInputRef.current.value = '';
      mappingKeyInputRef.current.focus();
    }
    if (clearMappingKeyBtnRef.current) {
      clearMappingKeyBtnRef.current.style.display = 'none';
    }
  };

  const handleClearMappingVal = () => {
    if (mappingValInputRef.current) {
      mappingValInputRef.current.value = '';
      mappingValInputRef.current.focus();
    }
    if (clearMappingValBtnRef.current) {
      clearMappingValBtnRef.current.style.display = 'none';
    }
  };

  const handleRemovePhraseMapping = (targetKey) => {
    setPhraseMappings((prev) => {
      const copy = { ...prev };
      delete copy[targetKey];
      return copy;
    });
  };

  // 3. Custom Instructions Handlers
  const handleAddInstruction = () => {
    const inst = newInstructionInputRef.current?.value?.trim();
    if (!inst) return;
    setCustomInstructions((prev) => [...prev, inst]);
    if (newInstructionInputRef.current) {
      newInstructionInputRef.current.value = '';
      newInstructionInputRef.current.focus();
    }
    if (clearInstructionBtnRef.current) {
      clearInstructionBtnRef.current.style.display = 'none';
    }
  };

  const handleClearInstruction = () => {
    if (newInstructionInputRef.current) {
      newInstructionInputRef.current.value = '';
      newInstructionInputRef.current.focus();
    }
    if (clearInstructionBtnRef.current) {
      clearInstructionBtnRef.current.style.display = 'none';
    }
  };

  const handleRemoveInstruction = (indexToRemove) => {
    if (editingRuleIndex === indexToRemove) {
      setEditingRuleIndex(null);
    }
    setCustomInstructions((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleStartEditRule = (idx) => {
    setEditingRuleIndex(idx);
  };

  const handleSaveEditRule = (idx) => {
    const updated = editRuleInputRef.current?.value?.trim();
    if (!updated) {
      toast.error('Rule content cannot be empty.');
      return;
    }
    setCustomInstructions((prev) => {
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
    setEditingRuleIndex(null);
    toast.success('Rule updated.');
  };

  const handleCancelEditRule = () => {
    setEditingRuleIndex(null);
  };

  // 4. Template Reset
  const handleResetTemplates = useCallback(() => {
    singleTemplateRef.current = '';
    multiTemplateRef.current = '';
    setResetCounter((c) => c + 1);
    toast.info('Report templates reset to system defaults. Click Save to persist.');
  }, []);

  // 5. Submit All Changes
  const handleSaveAll = async () => {
    try {
      await updateDirectives({
        negativeVocabulary,
        phraseMappings,
        customInstructions,
      }).unwrap();

      await updateAgentConfig({
        reportTemplates: {
          singleBranch: (singleTemplateRef.current || '').trim() || null,
          multiBranch: (multiTemplateRef.current || '').trim() || null,
        },
      }).unwrap();

      toast.success('Supervisor directives and report templates saved successfully.');
    } catch (err) {
      const errorMsg =
        err?.data?.message || err?.message || 'Failed to save directives and templates.';
      toast.error(errorMsg);
    }
  };

  const isSaving = isUpdatingDirectives || isUpdatingTemplates;

  // Zero-Lag Native Input Listeners: Pure DOM ref style toggling (0 React state updates while typing)
  const onWordInput = (e) => {
    if (clearWordBtnRef.current) {
      clearWordBtnRef.current.style.display = e.target.value ? 'inline-flex' : 'none';
    }
  };

  const onMappingKeyInput = (e) => {
    if (clearMappingKeyBtnRef.current) {
      clearMappingKeyBtnRef.current.style.display = e.target.value ? 'inline-flex' : 'none';
    }
  };

  const onMappingValInput = (e) => {
    if (clearMappingValBtnRef.current) {
      clearMappingValBtnRef.current.style.display = e.target.value ? 'inline-flex' : 'none';
    }
  };

  const onInstructionInput = (e) => {
    if (clearInstructionBtnRef.current) {
      clearInstructionBtnRef.current.style.display = e.target.value ? 'inline-flex' : 'none';
    }
  };

  return (
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
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Typography variant="h6" sx={{ fontSize: { xs: '0.95rem', sm: '1.05rem' }, fontWeight: 600, mb: 0.5 }}>
          Supervisor Directives & Report Templates SSOT
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: { xs: '0.8rem', sm: '0.875rem' }, mb: { xs: 2, sm: 3 } }}>
          Configure negative vocabulary, phrase mappings, persistent rules, and corporate report templates strictly adhered to by your Personal AI Agent.
        </Typography>

        <Stack spacing={{ xs: 2.5, sm: 3.5 }}>
          {/* Section 1: Negative Vocabulary */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <BlockIcon fontSize="small" color="error" />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Negative Vocabulary (Forbidden Words)
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
              Terms strictly forbidden from appearing in generated inspection reports and conversational responses.
            </Typography>

            {/* Scrollable Container with Max Height */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                p: 1.5,
                borderRadius: '8px',
                bgcolor: 'action.hover',
                border: 1,
                borderColor: 'divider',
                maxHeight: 180,
                overflowY: 'auto',
                alignItems: 'center',
                mb: 1.5,
              }}
            >
              {negativeVocabulary.length === 0 ? (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  No forbidden words registered. Type a word below and click Add.
                </Typography>
              ) : (
                negativeVocabulary.map((word) => (
                  <Chip
                    key={word}
                    label={word}
                    size="small"
                    color="error"
                    variant="outlined"
                    onDelete={() => handleRemoveNegativeWord(word)}
                    sx={{ fontWeight: 500 }}
                  />
                ))
              )}
            </Box>

            {/* Pixel-Perfect Aligned Input Row with Clear End-Adornment */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <MuiTextField
                inputRef={newWordInputRef}
                placeholder="Type forbidden word (e.g. ችግር, ስህተት)..."
                size="small"
                fullWidth
                helperText={null}
                onInput={onWordInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNegativeWord();
                  }
                }}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      ref={clearWordBtnRef}
                      size="small"
                      onClick={handleClearNegativeWord}
                      edge="end"
                      aria-label="Clear word input"
                      sx={{ display: 'none' }}
                    >
                      <ClearIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </InputAdornment>
                }
              />
              <MuiButton
                variant="outlined"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleAddNegativeWord}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Add Word
              </MuiButton>
              <Tooltip title="Add Word">
                <IconButton
                  color="primary"
                  onClick={handleAddNegativeWord}
                  sx={{
                    display: { xs: 'inline-flex', sm: 'none' },
                    border: 1,
                    borderColor: 'divider',
                    flexShrink: 0,
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Divider />

          {/* Section 2: Phrase Mappings */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <SpellcheckIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Phrase Mappings & Operational Shorthand Expansion
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
              Map informal shorthand or jargon into authoritative corporate terminology.
            </Typography>

            {/* Scrollable Mappings Table Container with Max Height */}
            {Object.keys(phraseMappings).length > 0 ? (
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{
                  mb: 1.5,
                  borderRadius: '8px',
                  maxHeight: 240,
                  overflowY: 'auto',
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', bgcolor: 'action.hover' }}>
                        Shorthand Input
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', bgcolor: 'action.hover' }}>
                        Corporate Replacement
                      </TableCell>
                      <TableCell align="right" sx={{ width: 60, bgcolor: 'action.hover' }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(phraseMappings).map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{k}</TableCell>
                        <TableCell sx={{ fontSize: '0.8125rem' }}>{v}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Remove Mapping">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemovePhraseMapping(k)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box
                sx={{
                  p: 1.5,
                  mb: 1.5,
                  borderRadius: '8px',
                  bgcolor: 'action.hover',
                  border: 1,
                  borderColor: 'divider',
                  textAlign: 'center',
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  No phrase mappings defined. Add one below (e.g. &quot;ማታ&quot; ➔ &quot;የማታ ፈረቃ&quot;).
                </Typography>
              </Box>
            )}

            {/* Pixel-Perfect Aligned Add Mapping Row with Clear Adornments */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1,
                alignItems: { xs: 'stretch', sm: 'flex-start' },
              }}
            >
              <MuiTextField
                inputRef={mappingKeyInputRef}
                placeholder="Shorthand Key (e.g. ፖስ)"
                size="small"
                helperText={null}
                onInput={onMappingKeyInput}
                sx={{ flex: { sm: 1 }, width: { xs: '100%', sm: 'auto' } }}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      ref={clearMappingKeyBtnRef}
                      size="small"
                      onClick={handleClearMappingKey}
                      edge="end"
                      aria-label="Clear key"
                      sx={{ display: 'none' }}
                    >
                      <ClearIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </InputAdornment>
                }
              />
              <MuiTextField
                inputRef={mappingValInputRef}
                placeholder="Replacement (e.g. የሽያጭ ማሽን)"
                size="small"
                helperText={null}
                onInput={onMappingValInput}
                sx={{ flex: { sm: 1.5 }, width: { xs: '100%', sm: 'auto' } }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPhraseMapping();
                  }
                }}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      ref={clearMappingValBtnRef}
                      size="small"
                      onClick={handleClearMappingVal}
                      edge="end"
                      aria-label="Clear value"
                      sx={{ display: 'none' }}
                    >
                      <ClearIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </InputAdornment>
                }
              />
              <MuiButton
                variant="outlined"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleAddPhraseMapping}
                sx={{
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  width: { xs: '100%', sm: 'auto' },
                }}
              >
                Add Mapping
              </MuiButton>
            </Box>
          </Box>

          <Divider />

          {/* Section 3: Custom Instructions with Edit and Delete + Clear Adornment */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <RuleIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Persistent Custom Rules & Guidelines
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
              Discrete rules dynamically observed across all chats and report generation pipelines.
            </Typography>

            {/* Scrollable Rules Container with Max Height */}
            {customInstructions.length > 0 ? (
              <Stack spacing={1} sx={{ mb: 1.5, maxHeight: 280, overflowY: 'auto', pr: 0.5 }}>
                {customInstructions.map((instruction, idx) => {
                  const isEditing = editingRuleIndex === idx;

                  if (isEditing) {
                    return (
                      <Box
                        key={idx}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1,
                          borderRadius: '8px',
                          bgcolor: 'action.selected',
                          border: 1,
                          borderColor: 'primary.main',
                        }}
                      >
                        <MuiTextField
                          inputRef={editRuleInputRef}
                          defaultValue={instruction}
                          size="small"
                          fullWidth
                          autoFocus
                          helperText={null}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEditRule(idx);
                            } else if (e.key === 'Escape') {
                              handleCancelEditRule();
                            }
                          }}
                        />
                        <Tooltip title="Save Edit">
                          <IconButton size="small" color="primary" onClick={() => handleSaveEditRule(idx)}>
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancel">
                          <IconButton size="small" onClick={handleCancelEditRule}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    );
                  }

                  return (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.25,
                        borderRadius: '8px',
                        bgcolor: 'action.hover',
                        border: 1,
                        borderColor: 'divider',
                        gap: 1,
                      }}
                    >
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', flex: 1, wordBreak: 'break-word' }}>
                        • {instruction}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        <Tooltip title="Edit Rule">
                          <IconButton
                            size="small"
                            color="inherit"
                            onClick={() => handleStartEditRule(idx)}
                            sx={{ color: 'text.secondary' }}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Rule">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveInstruction(idx)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <Box
                sx={{
                  p: 1.5,
                  mb: 1.5,
                  borderRadius: '8px',
                  bgcolor: 'action.hover',
                  border: 1,
                  borderColor: 'divider',
                  textAlign: 'center',
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  No custom instructions registered.
                </Typography>
              </Box>
            )}

            {/* Pixel-Perfect Aligned Add Rule Row with Clear End-Adornment */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <MuiTextField
                inputRef={newInstructionInputRef}
                placeholder="Type persistent rule (e.g. Always format dates in Ethiopian calendar)..."
                size="small"
                fullWidth
                helperText={null}
                onInput={onInstructionInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddInstruction();
                  }
                }}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      ref={clearInstructionBtnRef}
                      size="small"
                      onClick={handleClearInstruction}
                      edge="end"
                      aria-label="Clear rule input"
                      sx={{ display: 'none' }}
                    >
                      <ClearIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </InputAdornment>
                }
              />
              <MuiButton
                variant="outlined"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleAddInstruction}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Add Rule
              </MuiButton>
              <Tooltip title="Add Rule">
                <IconButton
                  color="primary"
                  onClick={handleAddInstruction}
                  sx={{
                    display: { xs: 'inline-flex', sm: 'none' },
                    border: 1,
                    borderColor: 'divider',
                    flexShrink: 0,
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Divider />

          {/* Section 4: Report Templates SSOT (Memoized Zero-Lag Subcomponent) */}
          <ProfileReportTemplatesSection
            initialSingle={initialTemplates.singleBranch || ''}
            initialMulti={initialTemplates.multiBranch || ''}
            onSingleChange={handleSingleChange}
            onMultiChange={handleMultiChange}
            onReset={handleResetTemplates}
            resetCounter={resetCounter}
          />

          {/* Save Action Deck */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              pt: 1,
            }}
          >
            <MuiButton
              variant="contained"
              color="primary"
              disabled={isSaving}
              onClick={handleSaveAll}
              startIcon={
                isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon fontSize="small" />
              }
              sx={{
                width: { xs: '100%', sm: 'auto' },
                py: { xs: 0.85, sm: 0.75 },
                fontWeight: 600,
              }}
            >
              {isSaving ? 'Saving Directives...' : 'Save Directives & Templates'}
            </MuiButton>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

ProfileDirectivesTab.propTypes = {
  user: PropTypes.shape({
    settings: PropTypes.shape({
      directives: PropTypes.shape({
        negativeVocabulary: PropTypes.arrayOf(PropTypes.string),
        phraseMappings: PropTypes.oneOfType([PropTypes.object, PropTypes.instanceOf(Map)]),
        customInstructions: PropTypes.arrayOf(PropTypes.string),
      }),
      reportTemplates: PropTypes.shape({
        singleBranch: PropTypes.string,
        multiBranch: PropTypes.string,
      }),
    }),
  }),
};

export default ProfileDirectivesTab;
