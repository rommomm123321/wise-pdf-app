import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface RenameDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (newName: string) => void;
  initialValue: string;
  title: string;
  placeholder?: string;
}

export default function RenameDialog({ open, onClose, onSubmit, initialValue, title, placeholder }: RenameDialogProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
    }
  }, [open, initialValue]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(t('errorNameRequired', 'Name is required'));
      return;
    }
    if (trimmed.length > 100) {
      setError(t('errorNameTooLong', 'Name is too long (max 100 chars)'));
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          fullWidth
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          error={!!error}
          helperText={error}
          placeholder={placeholder}
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
