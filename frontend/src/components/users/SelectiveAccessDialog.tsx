import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import { useTranslation } from 'react-i18next';
import { useFolderTree } from '../../hooks/useFolderTree';

interface SelectiveAccessDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  projectId: string;
  projectName: string;
  folderPermissions: any[];
  onToggleFolder: (folderId: string, currentPerm: any | null) => void;
}

function checkHasSelectedDescendant(folder: any, folderPermissions: any[]): boolean {
  if (!folder.children || folder.children.length === 0) return false;
  for (const child of folder.children) {
    if (folderPermissions.some((fp: any) => fp.folderId === child.id)) return true;
    if (checkHasSelectedDescendant(child, folderPermissions)) return true;
  }
  return false;
}

function FolderNode({ 
  folder, 
  level, 
  userId,
  folderPermissions, 
  onToggleFolder
}: any) {
  const [open, setOpen] = useState(false);
  
  const currentFolderPerm = folderPermissions.find((fp: any) => fp.folderId === folder.id);
  const hasAccess = !!currentFolderPerm;
  const isIndeterminate = !hasAccess && checkHasSelectedDescendant(folder, folderPermissions);

  const hasChildren = (folder.children?.length ?? 0) > 0;

  return (
    <Box sx={{ pl: level * 2 }}>
      <ListItem dense disableGutters>
        <ListItemIcon sx={{ minWidth: 32 }}>
          {hasChildren ? (
            <IconButton size="small" onClick={() => setOpen(!open)}>
              {open ? <ExpandMoreIcon fontSize="inherit" /> : <ChevronRightIcon fontSize="inherit" />}
            </IconButton>
          ) : <Box sx={{ width: 24 }} />}
        </ListItemIcon>
        <Checkbox 
          size="small" 
          checked={hasAccess || isIndeterminate} 
          indeterminate={isIndeterminate}
          onChange={() => onToggleFolder(folder.id, currentFolderPerm)} 
        />
        <FolderIcon sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
        <ListItemText primary={folder.name} primaryTypographyProps={{ fontSize: '0.85rem' }} />
      </ListItem>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <List dense disablePadding>
          {folder.children?.map((child: any) => (
            <FolderNode 
              key={child.id} 
              folder={child} 
              level={level + 1} 
              userId={userId}
              folderPermissions={folderPermissions}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </List>
      </Collapse>
    </Box>
  );
}

export default function SelectiveAccessDialog({
  open,
  onClose,
  userId,
  projectId,
  projectName,
  folderPermissions,
  onToggleFolder,
}: SelectiveAccessDialogProps) {
  const { t } = useTranslation();
  const { data: tree = [] } = useFolderTree(projectId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('selectiveAccessTitle', 'Selective Access')}: {projectName}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="primary" sx={{ display: 'block', mb: 2, fontWeight: 500, bgcolor: 'primary.main', color: 'primary.contrastText', p: 1.5, borderRadius: 1 }}>
          {t('selectiveHintFoldersOnly', 'Select folders this user should access. Granting access to a folder automatically grants access to all files within it.')}
        </Typography>
        
        <List dense>
          {tree.map((folder: any) => (
            <FolderNode 
              key={folder.id} 
              folder={folder} 
              level={0} 
              userId={userId}
              folderPermissions={folderPermissions}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">{t('done', 'Done')}</Button>
      </DialogActions>
    </Dialog>
  );
}