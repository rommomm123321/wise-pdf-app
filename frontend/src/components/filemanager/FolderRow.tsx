import React, { useState, forwardRef } from 'react';
import { TableRow, TableCell, Typography, Box, IconButton, Menu, MenuItem, Checkbox } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

interface FolderRowProps {
  folder: { id: string; name: string; projectId: string; createdAt: string };
  canEdit?: boolean;
  canDelete?: boolean;
  canManage?: boolean;
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDropFiles?: (id: string, files: FileList) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  selectionMode?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  dragProps?: any;
  dragHandleProps?: any;
  showCol: (key: string) => boolean;
}

const FolderRow = forwardRef<HTMLTableRowElement, FolderRowProps>(({
  folder, canEdit, canDelete, canManage, onRename, onDelete, onShare, onDropFiles,
  isSelected = false, onSelect, selectionMode = false,
  isDragging = false, isDropTarget = false, dragProps, dragHandleProps, showCol
}, ref) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || selectionMode) {
      onSelect?.(folder.id);
    } else {
      navigate(`/projects/${folder.projectId}/folders/${folder.id}`);
    }
  };

  const hasActions = canEdit || canDelete || canManage;
  const activeDrop = isDraggingOver || isDropTarget;

  return (
    <>
      <TableRow
        ref={ref}
        {...dragProps}
        {...dragHandleProps}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        hover
        onClick={handleClick}
        sx={{
          cursor: 'pointer',
          opacity: isDragging ? 0.8 : 1,
          bgcolor: activeDrop ? 'action.selected' : isSelected ? 'action.selected' : 'inherit',
          transition: 'background-color 0.2s',
          '& td': { 
            borderBottom: '1px solid', 
            borderColor: activeDrop ? 'primary.main' : 'divider',
            borderTop: activeDrop ? '1px solid' : 'none',
            borderTopColor: 'primary.main',
            transition: 'border-color 0.2s',
          },
          '&:hover': {
            bgcolor: activeDrop ? 'action.selected' : 'action.hover',
          }
        }}
      >
        <TableCell padding="checkbox" sx={{ width: 44, pl: 2 }}>
          <Checkbox
            size="small"
            checked={isSelected}
            onClick={(e) => { e.stopPropagation(); onSelect?.(folder.id); }}
          />
        </TableCell>
        {showCol('name') && (
          <TableCell sx={{ pl: 0.5 }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <FolderIcon color="primary" />
              <Typography variant="body2" fontWeight={600} noWrap>{folder.name}</Typography>
            </Box>
          </TableCell>
        )}
        {showCol('type') && (
          <TableCell sx={{ color: 'text.secondary' }}>
            <Typography variant="caption" color="inherit">{t('folder', 'Folder')}</Typography>
          </TableCell>
        )}
        {showCol('date') && (
          <TableCell sx={{ color: 'text.secondary' }}>
            <Typography variant="caption" color="inherit">
              {dayjs(folder.createdAt).format('DD MMM YYYY, HH:mm')}
            </Typography>
          </TableCell>
        )}
        {showCol('version') && (
          <TableCell sx={{ color: 'text.secondary' }}>
            <Typography variant="caption" color="inherit">—</Typography>
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
    </>
  );
});

export default FolderRow;
