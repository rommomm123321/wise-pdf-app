import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { useTranslation } from 'react-i18next';
import { useFolderTree, type FolderNode } from '../../hooks/useFolderTree';

interface MoveToFolderDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onSelect: (folderId: string) => void;
  excludeIds?: string[];
}

function filterTree(nodes: FolderNode[], excludeIds: string[]): FolderNode[] {
  return nodes
    .filter((n) => !excludeIds.includes(n.id))
    .map((n) => ({ ...n, children: filterTree(n.children || [], excludeIds) }));
}

function FolderTreeItem({ node, depth, selectedId, onSelect }: {
  node: FolderNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <ListItemButton
        selected={selectedId === node.id}
        onClick={() => onSelect(node.id)}
        sx={{ pl: 2 + depth * 2 }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <FolderIcon color="primary" fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={node.name} primaryTypographyProps={{ variant: 'body2' }} />
      </ListItemButton>
      {node.children?.map((child) => (
        <FolderTreeItem key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

export default function MoveToFolderDialog({ open, onClose, projectId, onSelect, excludeIds = [] }: MoveToFolderDialogProps) {
  const { t } = useTranslation();
  const { data: folderTree = [] } = useFolderTree(projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tree = useMemo(() => filterTree(folderTree, excludeIds), [folderTree, excludeIds]);

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('moveToFolder', 'Move to folder')}</DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {tree.length === 0 ? (
          <Box p={3} textAlign="center">
            <Typography variant="body2" color="text.secondary">{t('noFoldersAvailable', 'No folders available')}</Typography>
          </Box>
        ) : (
          <List dense>
            {tree.map((node) => (
              <FolderTreeItem key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={setSelectedId} />
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">{t('cancelBtn')}</Button>
        <Button onClick={handleConfirm} variant="contained" disabled={!selectedId}>{t('move', 'Move')}</Button>
      </DialogActions>
    </Dialog>
  );
}
