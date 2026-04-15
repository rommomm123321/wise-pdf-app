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

  const handleDownload = async (e: React.MouseEvent, docObj: any) => {
    e.stopPropagation();
    try {
      const res = await apiFetch<{ url: string }>(`/api/documents/${docObj.id}/download`);
      if (res.url) {
        window.open(res.url, '_blank');
      }
    } catch (err) {
      console.error(err);
      alert(t('errorDownload', 'Failed to download document'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, pb: 1 }}>
        {t('documentVersions', 'Version History')}
      </DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 1.5 }} noWrap>
        {documentName}
      </Typography>
      <DialogContent dividers sx={{ p: 0 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress size={28} /></Box>
        ) : versions && versions.length > 0 ? (
          <List disablePadding>
            {versions.map((v, idx) => (
              <ListItem
                key={v.id}
                disablePadding
                sx={{
                  borderBottom: idx < versions.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                <ListItemButton
                  onClick={() => {
                    if (onSelectVersion) {
                      onSelectVersion(v.id);
                      onClose();
                    }
                  }}
                  sx={{ px: 2, py: 1, minHeight: 48 }}
                >
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={0.75}>
                        <Typography variant="body2" fontWeight={600}>
                          v{v.version}
                        </Typography>
                        {v.isLatest && (
                          <Chip
                            label="Latest"
                            size="small"
                            color="primary"
                            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
                          />
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                          {dayjs(v.createdAt).format('DD MMM YYYY, HH:mm')}
                        </Typography>
                      </Box>
                    }
                  />
                  {canDownload && (
                    <IconButton
                      size="small"
                      onClick={(e) => handleDownload(e, v)}
                      title={t('download', 'Download')}
                      sx={{ ml: 0.5, flexShrink: 0 }}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  )}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary" textAlign="center" py={4} variant="body2">
            {t('noVersionsFound', 'No versions found')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1 }}>
        <Button onClick={onClose} color="inherit" size="small">{t('close', 'Close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
