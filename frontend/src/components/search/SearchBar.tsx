import { useState, useRef, useEffect } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Paper,
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popper,
  ClickAwayListener,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Chip,
  Avatar,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import WorkIcon from '@mui/icons-material/Work';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSearch } from '../../hooks/useSearch';
import UserDetailDialog from '../users/UserDetailDialog';

export default function SearchBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const { data, isLoading } = useSearch(query);
  
  const projects = data?.projects ?? [];
  const folders = data?.folders ?? [];
  const documents = data?.documents ?? [];
  const users = data?.users ?? [];
  
  const hasResults = projects.length > 0 || folders.length > 0 || documents.length > 0 || users.length > 0;
  const showDropdown = query.length >= 2 && expanded;

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  const handleSelect = (type: string, id: string, projectId?: string) => {
    setQuery('');
    setExpanded(false);
    if (type === 'project') navigate(`/projects/${id}`);
    else if (type === 'folder') navigate(`/projects/${projectId}/folders/${id}`);
    else if (type === 'document') navigate(`/projects/${projectId}/documents/${id}`);
    else if (type === 'user') setDetailUserId(id);
  };

  if (isMobile && !expanded) {
    return (
      <IconButton color="inherit" onClick={() => setExpanded(true)}>
        <SearchIcon />
      </IconButton>
    );
  }

  return (
    <ClickAwayListener onClickAway={() => setExpanded(false)}>
      <Box 
        ref={anchorRef} 
        sx={{ 
          position: isMobile && expanded ? 'fixed' : 'relative',
          top: isMobile && expanded ? 0 : 'auto',
          left: isMobile && expanded ? 0 : 'auto',
          right: isMobile && expanded ? 0 : 'auto',
          width: isMobile && expanded ? '100vw' : isMobile ? 'auto' : 360,
          height: isMobile && expanded ? 'auto' : 'auto',
          bgcolor: isMobile && expanded ? 'background.paper' : 'transparent',
          zIndex: isMobile && expanded ? 1300 : 'auto',
          p: isMobile && expanded ? 1 : 0,
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.2s ease-in-out',
        }}
      >
        <TextField
          inputRef={inputRef}
          size="small"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setExpanded(true);
          }}
          onFocus={() => setExpanded(true)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {isLoading && <CircularProgress size={16} sx={{ mr: 1 }} />}
                {query ? (
                  <IconButton size="small" onClick={() => { setQuery(''); setExpanded(false); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                ) : isMobile && expanded ? (
                  <IconButton size="small" onClick={() => setExpanded(false)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: isMobile && expanded ? 0 : 2,
              bgcolor: isMobile && expanded ? 'background.paper' : 'action.hover',
              fontSize: '0.875rem',
            },
          }}
        />

        <Popper
          open={showDropdown}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          style={{ width: anchorRef.current?.offsetWidth, zIndex: 1300 }}
        >
          <Paper sx={{ mt: 0.5, maxHeight: 500, overflow: 'auto', p: 1, boxShadow: 6 }}>
            {isLoading && (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress size={20} />
              </Box>
            )}

            {!isLoading && !hasResults && query.length >= 2 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                {t('searchNoResults')}
              </Typography>
            )}

            {/* Users Results */}
            {users?.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ px: 1, fontWeight: 600 }}>
                  {t('users', 'Users')}
                </Typography>
                <List dense disablePadding sx={{ mb: 1 }}>
                  {users.map((u: any) => (
                    <ListItemButton key={u.id} onClick={() => handleSelect('user', u.id)} sx={{ borderRadius: 1 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Avatar sx={{ 
                          width: 28, height: 28, fontSize: '0.7rem', 
                          bgcolor: u.role?.color || '#9E9E9E',
                          color: theme.palette.getContrastText(u.role?.color || '#9E9E9E')
                        }}>
                          {((u.name || u.email) as string).split(' ').map((w: string) => w[0]?.toUpperCase()).slice(0, 2).join('')}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText 
                        primary={u.name || u.email} 
                        secondary={
                          <Box component="span" sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>{u.name ? u.email : ''}</span>
                            {u.company && (
                              <Chip label={u.company.name} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.55rem' }} />
                            )}
                          </Box>
                        }
                        primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                        secondaryTypographyProps={{ fontSize: '0.75rem', component: 'div' }}
                      />
                      {u.role && (
                        <Chip 
                          label={u.role.name} 
                          size="small" 
                          sx={{ 
                            height: 18, fontSize: '0.6rem', 
                            bgcolor: u.role.color, 
                            color: theme.palette.getContrastText(u.role.color) 
                          }} 
                        />
                      )}
                    </ListItemButton>
                  ))}
                </List>
              </>
            )}

            {/* Projects Results */}
            {projects?.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ px: 1, fontWeight: 600 }}>
                  {t('projects')}
                </Typography>
                <List dense disablePadding sx={{ mb: 1 }}>
                  {projects.map((p: any) => (
                    <ListItemButton key={p.id} onClick={() => handleSelect('project', p.id)} sx={{ borderRadius: 1 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}><WorkIcon fontSize="small" /></ListItemIcon>
                      <ListItemText primary={p.name} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                    </ListItemButton>
                  ))}
                </List>
              </>
            )}

            {/* Folders Results */}
            {folders?.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ px: 1, fontWeight: 600 }}>
                  {t('folders')}
                </Typography>
                <List dense disablePadding sx={{ mb: 1 }}>
                  {folders.map((f: any) => (
                    <ListItemButton
                      key={f.id}
                      onClick={() => handleSelect('folder', f.id, f.projectId)}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}><FolderIcon fontSize="small" /></ListItemIcon>
                      <ListItemText primary={f.name} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                    </ListItemButton>
                  ))}
                </List>
              </>
            )}

            {/* Documents Results */}
            {documents?.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ px: 1, fontWeight: 600 }}>
                  {t('documents')}
                </Typography>
                <List dense disablePadding>
                  {documents.map((d: any) => (
                    <ListItemButton
                      key={d.id}
                      onClick={() => handleSelect('document', d.id, d.projectId)}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}><DescriptionIcon fontSize="small" /></ListItemIcon>
                      <ListItemText primary={d.name} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                    </ListItemButton>
                  ))}
                </List>
              </>
            )}
          </Paper>
        </Popper>

        {detailUserId && (
          <UserDetailDialog 
            userId={detailUserId} 
            open={!!detailUserId} 
            onClose={() => setDetailUserId(null)} 
          />
        )}
      </Box>
    </ClickAwayListener>
  );
}
