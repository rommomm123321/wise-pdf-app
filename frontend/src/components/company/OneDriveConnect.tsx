import { useState, useEffect } from 'react';
import { Box, Button, Typography, CircularProgress, Chip, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItemButton, ListItemIcon, ListItemText, Alert } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LinkIcon from '@mui/icons-material/Link';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { apiFetch } from '../../lib/api';

interface OneDriveConnectProps {
  companyId: string;
  onConnected?: () => void;
}

export default function OneDriveConnect({ companyId, onConnected }: OneDriveConnectProps) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
    // Check if returning from OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get('onedrive') === 'connected' && params.get('companyId') === companyId) {
      // Successfully connected and folder created automatically
      window.history.replaceState({}, '', window.location.pathname);
      onConnected?.();
    } else if (params.get('onedrive') === 'authed' && params.get('companyId') === companyId) {
      setPickerOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('onedrive') === 'error') {
      setError(params.get('message') || 'Authentication failed');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [companyId]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/onedrive/status?companyId=${companyId}`);
      setStatus(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async (folderId: string = 'root') => {
    try {
      setLoadingFolders(true);
      const res = await apiFetch('/api/onedrive/browse', { method: 'POST', body: JSON.stringify({ folderId, companyId }) });
      setFolders(res.folders || []);
      setCurrentFolderId(folderId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const res = await apiFetch(`/api/onedrive/auth/url?companyId=${companyId}`);
      window.location.href = res.url;
    } catch (e: any) {
      setError(e.message);
      setConnecting(false);
    }
  };

  const handleOpenPicker = async () => {
    setPickerOpen(true);
    setFolderPath([]);
    await loadFolders('root');
  };

  const handleFolderClick = async (folder: { id: string; name: string }) => {
    setFolderPath(p => [...p, { id: currentFolderId, name: folders.find(f => f.id === currentFolderId)?.name || 'Root' }]);
    await loadFolders(folder.id);
  };

  const handleConfirm = async () => {
    if (!selectedFolder) return;
    try {
      await apiFetch('/api/onedrive/connect', { method: 'POST', body: JSON.stringify({ rootItemId: selectedFolder.id, companyId }) });
      setPickerOpen(false);
      await loadStatus();
      onConnected?.();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await apiFetch('/api/onedrive/disconnect', { method: 'POST', body: JSON.stringify({ companyId }) });
      await loadStatus();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <CircularProgress size={20} />;

  return (
    <Box>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>{error}</Alert>}

      {status?.oneDriveConnected ? (
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          <Chip icon={<CheckCircleIcon />} label="OneDrive Connected" color="success" size="small" />
          <Typography variant="caption" color="text.secondary">{status.oneDriveOwnerEmail}</Typography>
          <Chip icon={<AutorenewIcon sx={{ fontSize: '14px !important' }} />} label="Auto-sync" size="small" variant="outlined" color="info" />
          {status.oneDriveLastSync && (
            <Typography variant="caption" color="text.secondary">
              Last sync: {new Date(status.oneDriveLastSync).toLocaleTimeString()}
            </Typography>
          )}
          <Button size="small" color="error" onClick={handleDisconnect}>Disconnect</Button>
        </Box>
      ) : (
        <Button
          variant="outlined"
          startIcon={connecting ? <CircularProgress size={16} /> : <LinkIcon />}
          onClick={handleConnect}
          disabled={connecting}
          size="small"
        >
          {connecting ? 'Redirecting...' : 'Connect OneDrive'}
        </Button>
      )}

      {/* Folder Picker Dialog */}
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Select Root Folder</DialogTitle>
        <DialogContent>
          <Box display="flex" alignItems="center" gap={0.5} mb={1} flexWrap="wrap">
            <Button size="small" onClick={() => { setFolderPath([]); loadFolders('root'); }}>My OneDrive</Button>
            {folderPath.map((p, i) => (
              <Button key={p.id} size="small" onClick={() => {
                const newPath = folderPath.slice(0, i);
                setFolderPath(newPath);
                loadFolders(p.id);
              }}>/ {p.name}</Button>
            ))}
          </Box>
          {loadingFolders ? (
            <Box display="flex" justifyContent="center" py={2}><CircularProgress size={24} /></Box>
          ) : folders.length === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>No subfolders found</Typography>
          ) : (
            <List dense>
              {folders.map(f => (
                <ListItemButton
                  key={f.id}
                  selected={selectedFolder?.id === f.id}
                  onClick={() => setSelectedFolder(f)}
                  onDoubleClick={() => handleFolderClick(f)}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}><FolderIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary={f.name} />
                </ListItemButton>
              ))}
            </List>
          )}
          {selectedFolder && (
            <Typography variant="caption" color="primary" mt={1} display="block">
              Selected: {selectedFolder.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickerOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!selectedFolder} onClick={handleConfirm}>Confirm</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
