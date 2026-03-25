import { useState } from 'react';
import { Card, CardActionArea, CardContent, Typography, Box, IconButton, Menu, MenuItem, Checkbox } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material';

interface FolderCardProps {
  folder: { id: string; name: string; projectId: string };
  canEdit?: boolean;
  canDelete?: boolean;
  canManage?: boolean;
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDropFiles?: (id: string, files: FileList) => void;
  // Selection
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  selectionMode?: boolean;
  isDropTarget?: boolean;
}

export default function FolderCard({
  folder,
  canEdit = false,
  canDelete = false,
  canManage = false,
  onRename,
  onDelete,
  onShare,
  onDropFiles,
  isSelected = false,
  onSelect,
  selectionMode = false,
  isDropTarget = false,
}: FolderCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDraggingOver(true);
    }
  };

  const onDragLeave = () => {
    setIsDraggingOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      onDropFiles?.(folder.id, e.dataTransfer.files);
    }
  };

  const activeDrop = isDraggingOver || isDropTarget;

  return (
    <Card
      variant="outlined"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      sx={{
        height: '100%',
        position: 'relative',
        borderColor: activeDrop ? 'primary.main' : isSelected ? 'primary.main' : 'divider',
        borderWidth: activeDrop || isSelected ? 2 : 1,
        bgcolor: activeDrop ? 'action.selected' : 'background.paper',
        boxShadow: activeDrop ? `0 0 15px ${theme.palette.primary.main}40` : 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: activeDrop ? 'scale(1.05)' : 'scale(1)',
        zIndex: activeDrop ? 10 : 1,
        '&:hover': {
          borderColor: 'primary.light',
          bgcolor: 'action.hover'
        }
      }}
    >
      {(selectionMode || isSelected) && (
        <Checkbox
          size="small"
          checked={isSelected}
          onChange={() => onSelect?.(folder.id)}
          sx={{ position: 'absolute', top: 4, left: 4, zIndex: 11 }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      <CardActionArea
        onClick={() => selectionMode ? onSelect?.(folder.id) : navigate(`/projects/${folder.projectId}/folders/${folder.id}`)}
        sx={{ height: '100%' }}
      >
        <CardContent sx={{ pb: '12px !important', pt: 1.5, pr: 4.5, pl: (selectionMode || isSelected) ? 4.5 : 1.5 }}>
          <FolderIcon color="primary" sx={{ fontSize: 36 }} />
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="body1" fontWeight={600} noWrap>
              {folder.name}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>

      {!selectionMode && (
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {canEdit && onRename && (
          <MenuItem onClick={() => { handleMenuClose(); onRename(folder.id, folder.name); }}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            {t('rename')}
          </MenuItem>
        )}
        {canManage && onShare && (
          <MenuItem onClick={() => { handleMenuClose(); onShare(folder.id); }}>
            <ShareIcon fontSize="small" sx={{ mr: 1 }} />
            {t('share')}
          </MenuItem>
        )}
        {canDelete && onDelete && (
          <MenuItem onClick={() => { handleMenuClose(); onDelete(folder.id); }} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            {t('delete')}
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
}
