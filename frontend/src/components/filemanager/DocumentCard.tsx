import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  CardActionArea,
  Checkbox,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import LayersIcon from '@mui/icons-material/Layers';
import Divider from '@mui/material/Divider';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ShareIcon from '@mui/icons-material/Share';
import HistoryIcon from '@mui/icons-material/History';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface DocumentCardProps {
  document: {
    id: string;
    name: string;
    version: number;
    createdAt: string;
    storageUrl: string;
  };
  projectId?: string;
  onDelete?: (id: string) => void;
  onReplace?: (id: string) => void;
  onShare?: (id: string, name: string) => void;
  onExportWithMarkups?: (id: string, name: string) => void;
  canDownload?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  canManage?: boolean;
  // Selection
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  selectionMode?: boolean;
  onShowVersions?: (id: string, name: string) => void;
}

export default function DocumentCard({
  document,
  projectId,
  onDelete,
  onReplace,
  onShare,
  onExportWithMarkups,
  canDownload = true,
  canDelete = false,
  canEdit = false,
  canManage = false,
  isSelected = false,
  onSelect,
  selectionMode = false,
  onShowVersions,
}: DocumentCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const date = new Date(document.createdAt).toLocaleDateString();
  const handleOpen = () => {
    if (projectId) {
      navigate(`/projects/${projectId}/documents/${document.id}`);
    } else {
      navigate(`/documents/${document.id}`);
    }
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setAnchorEl(e.currentTarget);
  };

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        height: '100%', 
        position: 'relative',
        borderColor: isSelected ? 'primary.main' : 'divider',
        borderWidth: isSelected ? 2 : 1,
        transition: 'all 0.2s'
      }}
    >
      {(selectionMode || isSelected) && (
        <Checkbox
          size="small"
          checked={isSelected}
          onChange={() => onSelect?.(document.id)}
          sx={{ position: 'absolute', top: 4, left: 4, zIndex: 11 }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      <CardActionArea 
        onClick={() => selectionMode ? onSelect?.(document.id) : handleOpen()} 
        sx={{ height: '100%' }}
      >
        <CardContent sx={{ pb: '12px !important', pt: 1.5, pr: 4.5, pl: (selectionMode || isSelected) ? 4.5 : 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <PictureAsPdfIcon color="error" sx={{ fontSize: 40, mt: 0.5, flexShrink: 0 }} />
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <Typography variant="body2" fontWeight={600} noWrap title={document.name}>
                {document.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Chip label={`v${document.version}`} size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                <Typography variant="caption" color="text.secondary">
                  {date}
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>

      {!selectionMode && (
        <IconButton 
          size="small" 
          onClick={handleMenuOpen}
          sx={{ position: 'absolute', right: 8, top: 12, zIndex: 2 }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { setAnchorEl(null); handleOpen(); }}>
          <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
          {t('open')}
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onShowVersions?.(document.id, document.name); }}>
          <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
          {t('versions', 'Versions History')}
        </MenuItem>
        {canDownload && (
          <MenuItem onClick={() => {
            setAnchorEl(null);
            fetch(`/api/documents/${document.id}/proxy`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.blob())
              .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = window.document.createElement('a');
                a.href = url; a.download = document.name; a.click();
                setTimeout(() => URL.revokeObjectURL(url), 10_000);
              });
          }}>
            <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
            {t('downloadClean', 'Download (clean PDF)')}
          </MenuItem>
        )}
        {canDownload && onExportWithMarkups && (
          <MenuItem onClick={() => { setAnchorEl(null); onExportWithMarkups(document.id, document.name); }}>
            <LayersIcon fontSize="small" sx={{ mr: 1 }} />
            {t('downloadWithMarkups', 'Download with markups')}
          </MenuItem>
        )}
        {canDownload && <Divider />}
        {canEdit && onReplace && (
          <MenuItem onClick={() => { setAnchorEl(null); onReplace(document.id); }}>
            <UpgradeIcon fontSize="small" sx={{ mr: 1 }} />
            {t('uploadNewVersion')}
          </MenuItem>
        )}
        {canManage && onShare && (
          <MenuItem onClick={() => { setAnchorEl(null); onShare(document.id, document.name); }}>
            <ShareIcon fontSize="small" sx={{ mr: 1 }} />
            {t('share')}
          </MenuItem>
        )}
        {canDelete && onDelete && (
          <MenuItem onClick={() => { setAnchorEl(null); onDelete(document.id); }} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            {t('delete')}
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
}
