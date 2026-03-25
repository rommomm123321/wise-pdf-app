import { useRef, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useTranslation } from 'react-i18next';

interface UploadDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => void;
  isUploading?: boolean;
}

export default function UploadDocumentDialog({ open, onClose, onUpload, isUploading }: UploadDocumentDialogProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('uploadDocument')}</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'divider',
            bgcolor: isDragActive ? 'action.hover' : 'transparent',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
          }}
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <UploadFileIcon sx={{ fontSize: 48, color: isDragActive ? 'primary.main' : 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color={isDragActive ? 'primary' : 'text.secondary'}>
            {isDragActive ? t('dropFilesHere', 'Drop files here') : t('uploadHint')}
          </Typography>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            multiple
            hidden
            onChange={handleFileSelect}
          />
        </Box>
        {isUploading && (
          <Typography variant="body2" color="primary" sx={{ mt: 2, textAlign: 'center' }}>
            {t('uploading')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={isUploading}>{t('cancelBtn')}</Button>
      </DialogActions>
    </Dialog>
  );
}
