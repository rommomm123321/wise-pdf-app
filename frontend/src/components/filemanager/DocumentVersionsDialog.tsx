import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, List, 
  ListItem, ListItemButton, ListItemText, Typography, CircularProgress, Box, Chip, IconButton 
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDocumentVersions } from '../../hooks/useFolderContents';
import dayjs from 'dayjs';
import DownloadIcon from '@mui/icons-material/Download';
import { apiFetch } from '../../lib/api';

interface DocumentVersionsDialogProps {
  open: boolean;
  onClose: () => void;
  documentId: string | null;
  documentName: string;
  canDownload?: boolean;
  onSelectVersion?: (versionId: string) => void;
}

export default function DocumentVersionsDialog({ open, onClose, documentId, documentName, canDownload = false, onSelectVersion }: DocumentVersionsDialogProps) {
  const { t } = useTranslation();
  const { data: versions, isLoading } = useDocumentVersions(documentId || undefined);

  const handleDownload = async (docObj: any) => {
    try {
      const res = await apiFetch<{ url: string }>(`/api/documents/${docObj.id}/download`);
      if (res.url) {
        window.open(res.url, '_blank');
      }
    } catch (e) {
      console.error(e);
      alert(t('errorDownload', 'Failed to download document'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('documentVersions', 'Versions History')}: {documentName}</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
        ) : versions && versions.length > 0 ? (
          <List disablePadding>
            {versions.map((v) => (
              <ListItem 
                key={v.id}
                disablePadding 
                secondaryAction={
                  canDownload ? (
                    <IconButton edge="end" onClick={() => handleDownload(v)} title={t('download')}>
                      <DownloadIcon />
                    </IconButton>
                  ) : null
                }
                sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <ListItemButton 
                  onClick={() => {
                    if (onSelectVersion) {
                      onSelectVersion(v.id);
                      onClose();
                    }
                  }}
                  sx={{ px: 3, py: 1.5, pr: canDownload ? 8 : 3 }}
                >
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Typography variant="body1" fontWeight={600}>Version {v.version}</Typography>
                        {v.isLatest && <Chip label={t('latest', 'Latest')} size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />}
                      </Box>
                    }
                    secondary={`${dayjs(v.createdAt).format('DD MMM YYYY, HH:mm')}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary" textAlign="center" py={4}>
            {t('noVersionsFound', 'No versions found')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">{t('close', 'Close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
