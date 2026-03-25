import { useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import { useTranslation } from 'react-i18next';

interface ReplaceDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  onReplace: (file: File) => void;
  isReplacing?: boolean;
}

export default function ReplaceDocumentDialog({ open, onClose, onReplace, isReplacing }: ReplaceDocumentDialogProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onReplace(file);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('replaceDocument')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {t('replaceHint')}
        </Typography>
        <Box
          sx={{
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': { borderColor: 'secondary.main', bgcolor: 'action.hover' },
          }}
          onClick={() => inputRef.current?.click()}
        >
          <UpgradeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {t('uploadHint')}
          </Typography>
          <input ref={inputRef} type="file" accept=".pdf" hidden onChange={handleFileSelect} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={isReplacing}>{t('cancelBtn')}</Button>
      </DialogActions>
    </Dialog>
  );
}
