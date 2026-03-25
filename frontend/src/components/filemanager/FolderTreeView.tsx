import { List, ListItemButton, ListItemIcon, ListItemText, Collapse, Typography, Box } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFolderTree, type FolderNode } from '../../hooks/useFolderTree';

interface FolderTreeViewProps {
  projectId: string;
  onNavigate?: () => void;
}

export default function FolderTreeView({ projectId, onNavigate }: FolderTreeViewProps) {
  const { data: tree, isLoading } = useFolderTree(projectId);

  if (isLoading) return null;
  if (!tree?.length) return null;

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
        Project Explorer
      </Typography>
      <List dense disablePadding>
        {tree.map((node) => (
          <TreeNode key={node.id} node={node} projectId={projectId} depth={0} onNavigate={onNavigate} />
        ))}
      </List>
    </Box>
  );
}

function TreeNode({
  node,
  projectId,
  depth,
  onNavigate,
}: {
  node: FolderNode;
  projectId: string;
  depth: number;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const { folderId, documentId } = useParams<{ folderId?: string; documentId?: string }>();
  
  // Check if this node or any child (folder or file) is active
  const isCurrentFolder = folderId === node.id;
  const isParentOfActiveFolder = useMemo(() => {
    const checkFolders = (folders: FolderNode[]): boolean => {
      return folders.some(f => f.id === folderId || (f.children && checkFolders(f.children)));
    };
    return node.children && checkFolders(node.children);
  }, [node.children, folderId]);

  const isParentOfActiveDoc = useMemo(() => {
    const checkFiles = (n: FolderNode): boolean => {
      if (n.files?.some(f => f.id === documentId)) return true;
      return n.children?.some(child => checkFiles(child)) || false;
    };
    return checkFiles(node);
  }, [node, documentId]);

  const [open, setOpen] = useState(depth === 0 || isParentOfActiveFolder || isParentOfActiveDoc);

  // Sync open state when navigation happens
  useEffect(() => {
    if (isParentOfActiveFolder || isParentOfActiveDoc) {
      setOpen(true);
    }
  }, [isParentOfActiveFolder, isParentOfActiveDoc]);
  
  const hasChildren = (node.children && node.children.length > 0) || (node.files && node.files.length > 0);

  const handleFolderClick = () => {
    navigate(`/projects/${projectId}/folders/${node.id}`);
    onNavigate?.();
  };

  const handleFileClick = (docId: string) => {
    navigate(`/projects/${projectId}/documents/${docId}`);
    onNavigate?.();
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((o) => !o);
  };

  return (
    <>
      <ListItemButton
        selected={isCurrentFolder}
        onClick={handleFolderClick}
        sx={{ 
          borderRadius: 1, 
          pl: 1 + depth * 2, 
          py: 0.5,
          '&.Mui-selected': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': { bgcolor: 'primary.dark' },
            '& .MuiListItemIcon-root': { color: 'inherit' }
          }
        }}
      >
        {hasChildren ? (
          <ListItemIcon sx={{ minWidth: 24, cursor: 'pointer', color: 'inherit' }} onClick={handleToggle}>
            {open ? <ExpandMoreIcon sx={{ fontSize: 18 }} /> : <ChevronRightIcon sx={{ fontSize: 18 }} />}
          </ListItemIcon>
        ) : (
          <ListItemIcon sx={{ minWidth: 24 }}>
            <Box sx={{ width: 18 }} />
          </ListItemIcon>
        )}
        <ListItemIcon sx={{ minWidth: 28, color: 'inherit' }}>
          {isCurrentFolder || open ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />}
        </ListItemIcon>
        <ListItemText
          primary={node.name}
          primaryTypographyProps={{ fontSize: '0.8rem', noWrap: true, fontWeight: isCurrentFolder ? 700 : 400 }}
        />
      </ListItemButton>

      {hasChildren && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          {/* Subfolders */}
          {node.children && node.children.map((child) => (
            <TreeNode key={child.id} node={child} projectId={projectId} depth={depth + 1} onNavigate={onNavigate} />
          ))}
          
          {/* Files */}
          {node.files && node.files.map((file) => {
            const isFileActive = documentId === file.id;
            return (
              <ListItemButton
                key={file.id}
                selected={isFileActive}
                onClick={() => handleFileClick(file.id)}
                sx={{ 
                  borderRadius: 1, 
                  pl: 4 + depth * 2, 
                  py: 0.3,
                  '&.Mui-selected': {
                    bgcolor: 'error.main',
                    color: '#fff',
                    '&:hover': { bgcolor: 'error.dark' },
                    '& .MuiListItemIcon-root': { color: 'inherit' }
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 28, color: isFileActive ? 'inherit' : 'error.main' }}>
                  <PictureAsPdfIcon sx={{ fontSize: 16 }} />
                </ListItemIcon>
                <ListItemText
                  primary={file.name}
                  primaryTypographyProps={{ fontSize: '0.75rem', noWrap: true, color: 'inherit' }}
                />
              </ListItemButton>
            );
          })}
        </Collapse>
      )}
    </>
  );
}
