import React, { useState, forwardRef } from 'react';
import { TableRow, TableCell, Typography, Box, IconButton, Menu, MenuItem, Checkbox, Chip } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import LayersIcon from '@mui/icons-material/Layers';
import Divider from '@mui/material/Divider';
import ShareIcon from '@mui/icons-material/Share';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import dayjs from 'dayjs';

interface DocumentRowProps {
  document: { id: string; name: string; version: number; createdAt: string; storageUrl: string };
  projectId?: string;
  onDelete?: (id: string) => void;
  onReplace?: (id: string) => void;
  onShare?: (id: string, name: string) => void;
  onExportWithMarkups?: (id: string, name: string) => void;
  canDownload?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  canManage?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  selectionMode?: boolean;
  isDragging?: boolean;
  dragProps?: any;
  dragHandleProps?: any;
  showCol: (key: string) => boolean;
  onShowVersions?: (id: string, name: string) => void;
}

const DocumentRow = forwardRef<HTMLTableRowElement, DocumentRowProps>(({
  document: docItem, projectId, canDownload, canDelete, canEdit, canManage,
  onDelete, onReplace, onShare, onExportWithMarkups,
  isSelected = false, onSelect, selectionMode = false,
  isDragging = false, dragProps, dragHandleProps, showCol, onShowVersions
}, ref) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || selectionMode) {
      onSelect?.(docItem.id);
    } else {
      if (projectId) {
        navigate(`/projects/${projectId}/documents/${docItem.id}`);
      }
    }
  };

  const hasActions = canDownload || canDelete || canEdit || canManage;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleMenuClose();
    if (!canDownload) return;
    fetch(`/api/documents/${docItem.id}/proxy`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url; a.download = docItem.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      });
  };

  return (
    <>
      <TableRow
        ref={ref}
        {...dragProps}
        {...dragHandleProps}
        hover
        onClick={handleClick}
        sx={{
          cursor: 'pointer',
          opacity: isDragging ? 0.8 : 1,
          bgcolor: isSelected ? 'action.selected' : 'inherit',
          '& td': { borderBottom: '1px solid', borderColor: 'divider' },
        }}
      >
        <TableCell padding="checkbox" sx={{ width: 44, pl: 2 }}>
          <Checkbox
            size="small"
            checked={isSelected}
            onClick={(e) => { e.stopPropagation(); onSelect?.(docItem.id); }}
          />
        </TableCell>
        {showCol('name') && (
          <TableCell sx={{ pl: 0.5 }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <PictureAsPdfIcon color="error" />
              <Typography variant="body2" fontWeight={600} noWrap>{docItem.name}</Typography>
            </Box>
          </TableCell>
        )}
        {showCol('type') && (
          <TableCell sx={{ color: 'text.secondary' }}>
            <Typography variant="caption" color="inherit">PDF</Typography>
          </TableCell>
        )}
        {showCol('date') && (
          <TableCell sx={{ color: 'text.secondary' }}>
            <Typography variant="caption" color="inherit">
              {dayjs(docItem.createdAt).format('DD MMM YYYY, HH:mm')}
            </Typography>
          </TableCell>
        )}
        {showCol('version') && (
          <TableCell sx={{ color: 'text.secondary' }}>
            <Chip label={`v${docItem.version}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
          </TableCell>
        )}
        {showCol('actions') && (
          <TableCell align="right" padding="none" sx={{ pr: 2 }}>
            {hasActions && (
              <IconButton size="small" onClick={handleMenuOpen} sx={{ mr: 1 }}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
          </TableCell>
        )}
      </TableRow>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {canDownload && (
          <MenuItem onClick={handleDownload}>
            <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
            {t('downloadClean', 'Download (clean PDF)')}
          </MenuItem>
        )}
        {canDownload && onExportWithMarkups && (
          <MenuItem onClick={() => { handleMenuClose(); onExportWithMarkups(docItem.id, docItem.name); }}>
            <LayersIcon fontSize="small" sx={{ mr: 1 }} />
            {t('downloadWithMarkups', 'Download with markups')}
          </MenuItem>
        )}
        {canDownload && <Divider />}
        {canEdit && onReplace && (
          <MenuItem onClick={() => { handleMenuClose(); onReplace(docItem.id); }}>
            <UpgradeIcon fontSize="small" sx={{ mr: 1 }} />
            {t('uploadNewVersion')}
          </MenuItem>
        )}
        <MenuItem onClick={() => { handleMenuClose(); onShowVersions?.(docItem.id, docItem.name); }}>
          <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
          {t('versions', 'Versions History')}
        </MenuItem>
        {canManage && onShare && (
          <MenuItem onClick={() => { handleMenuClose(); onShare(docItem.id, docItem.name); }}>
            <ShareIcon fontSize="small" sx={{ mr: 1 }} />
            {t('share')}
          </MenuItem>
        )}
        {canDelete && onDelete && (
          <MenuItem onClick={() => { handleMenuClose(); onDelete(docItem.id); }} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            {t('delete')}
          </MenuItem>
        )}
      </Menu>
    </>
  );
});

export default DocumentRow;
