import { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, RadioGroup, FormControlLabel, Radio, Divider, Chip,
} from '@mui/material';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import LayersIcon from '@mui/icons-material/Layers';
import LayersClearIcon from '@mui/icons-material/LayersClear';
import { useTranslation } from 'react-i18next';

interface ReplaceDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called when user confirms — includes the file and whether to transfer markups */
  onReplace: (file: File, transferMarkups: boolean) => void;
  isReplacing?: boolean;
  /** Number of markups on the current version (to show in the prompt) */
  markupCount?: number;
}

export default function ReplaceDocumentDialog({
  open, onClose, onReplace, isReplacing, markupCount = 0,
}: ReplaceDocumentDialogProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [transferMarkups, setTransferMarkups] = useState<'transfer' | 'discard'>('transfer');

  const handleClose = () => {
    if (isReplacing) return;
    setPendingFile(null);
    setTransferMarkups('transfer');
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (markupCount > 0) {
      // Show the markups-transfer step
      setPendingFile(file);
    } else {
      // No markups → upload directly
      onReplace(file, false);
    }
  };

  const handleConfirm = () => {
    if (!pendingFile) return;
    onReplace(pendingFile, transferMarkups === 'transfer');
    setPendingFile(null);
    setTransferMarkups('transfer');
  };

  // Step 2: user already selected a file, now choose what to do with markups
  if (pendingFile) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          {t('replaceDocument', 'Replace document')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <UpgradeIcon color="primary" />
            <Box>
              <Typography variant="body2" fontWeight={700}>{pendingFile.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {(pendingFile.size / 1024 / 1024).toFixed(1)} MB
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Typography variant="body2" fontWeight={600} mb={1.5}>
            {t('markupTransferQuestion', 'Transfer markups from all versions?')}
            {' '}
            <Chip label={`${markupCount} total`} size="small" color="primary" sx={{ fontWeight: 700, height: 20, fontSize: '0.7rem' }} />
          </Typography>

          <RadioGroup
            value={transferMarkups}
            onChange={(e) => setTransferMarkups(e.target.value as 'transfer' | 'discard')}
          >
            <FormControlLabel
              value="transfer"
              control={<Radio size="small" color="primary" />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LayersIcon fontSize="small" color="primary" />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {t('transferMarkups', 'Bring markups from all versions')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('transferMarkupsHint', 'All annotations from every previous version appear on the new version — fully editable, no duplicates')}
                    </Typography>
                  </Box>
                </Box>
              }
              sx={{ alignItems: 'flex-start', mb: 1.5, '& .MuiFormControlLabel-label': { mt: '2px' } }}
            />
            <FormControlLabel
              value="discard"
              control={<Radio size="small" />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LayersClearIcon fontSize="small" color="text.secondary" />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {t('discardMarkups', 'Start clean — no markups')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('discardMarkupsHint', 'Markups stay on their original versions; new version starts empty')}
                    </Typography>
                  </Box>
                </Box>
              }
              sx={{ alignItems: 'flex-start', '& .MuiFormControlLabel-label': { mt: '2px' } }}
            />
          </RadioGroup>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingFile(null)} color="inherit" disabled={isReplacing}>
            {t('back', 'Back')}
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={isReplacing}
            startIcon={<UpgradeIcon />}
          >
            {isReplacing
              ? t('uploading', 'Uploading…')
              : t('uploadVersion', 'Upload new version')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Step 1: pick a file
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('replaceDocument', 'Replace document')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {t('replaceHint', 'Select a PDF to replace this document with a new version.')}
        </Typography>
        <Box
          sx={{
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
          }}
          onClick={() => inputRef.current?.click()}
        >
          <UpgradeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {t('uploadHint', 'Click to select a PDF file')}
          </Typography>
          <input ref={inputRef} type="file" accept=".pdf" hidden onChange={handleFileSelect} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">{t('cancelBtn', 'Cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}
