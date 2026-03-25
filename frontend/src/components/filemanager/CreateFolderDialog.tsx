import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface CreateFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export default function CreateFolderDialog({ open, onClose, onSubmit }: CreateFolderDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('errorNameRequired', 'Name is required'));
      return;
    }
    if (trimmedName.length > 100) {
      setError(t('errorNameTooLong', 'Name is too long (max 100 chars)'));
      return;
    }
    onSubmit(trimmedName);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('createFolder')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label={t('nameLabel')}
          fullWidth
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          error={!!error}
          helperText={error}
          required
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">{t('cancelBtn')}</Button>
        <Button onClick={handleSubmit} variant="contained" sx={{ px: 3 }}>{t('submitBtn')}</Button>
      </DialogActions>
    </Dialog>
  );
}
