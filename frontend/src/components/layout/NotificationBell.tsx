import { useState, useCallback } from 'react';
import {
  IconButton, Badge, Popover, Box, Typography, useTheme, alpha,
  Tooltip, Avatar, Divider, List, ListItem, ListItemText,
  Button, Chip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNotifications, type AppNotification } from '../../hooks/useNotifications';

dayjs.extend(relativeTime);

export default function NotificationBell() {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, deleteOne, deleteAll, respondToAssignment } = useNotifications();

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  const handleClick = useCallback(async (n: AppNotification) => {
    if (!n.read) markRead(n.id);
    if (n.documentId) {
      const params = n.markupId ? `?markupId=${n.markupId}` : '';
      let projectId = n.projectId;
      if (!projectId) {
        try {
          const res = await fetch(`/api/documents/${n.documentId}/info`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            projectId = data.folder?.projectId || data.projectId;
          }
        } catch { /* */ }
      }
      // Close popover AFTER we have the URL ready, then navigate
      handleClose();
      if (projectId) {
        navigate(`/projects/${projectId}/documents/${n.documentId}${params}`);
      } else {
        // Last resort: use window.location for hard navigation
        window.location.href = `/projects/_/documents/${n.documentId}${params}`;
      }
    } else {
      handleClose();
    }
  }, [navigate, markRead]);

  const actorLabel = (n: AppNotification) => n.actor?.name || n.actor?.email || 'Someone';

  const avatarColor = (name: string) => {
    const colors = ['#e53935', '#8e24aa', '#1e88e5', '#00897b', '#fb8c00', '#6d4c41'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

const open = Boolean(anchor);

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton 
          onClick={handleOpen} 
          color="inherit" 
          size="small" 
          sx={{ 
            position: 'relative',
            ...(unreadCount > 0 && {
              animation: 'ring 4s infinite ease-in-out',
              '@keyframes ring': {
                '0%, 100%': { transform: 'rotate(0deg)' },
                '5%': { transform: 'rotate(15deg)' },
                '10%': { transform: 'rotate(-10deg)' },
                '15%': { transform: 'rotate(5deg)' },
                '20%': { transform: 'rotate(-5deg)' },
                '25%': { transform: 'rotate(0deg)' },
              }
            })
          }}
        >
          <Badge
            badgeContent={unreadCount}
            max={99}
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: gold,
                color: theme.palette.getContrastText(gold),
                fontSize: '0.6rem',
                minWidth: 16,
                height: 16,
                padding: '0 4px',
              }
            }}
          >
            {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 380,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: 1, borderColor: 'divider',
          bgcolor: alpha(gold, 0.04),
        }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle2" fontWeight={700} fontSize="0.85rem">
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={unreadCount}
                size="small"
                sx={{ bgcolor: gold, color: theme.palette.getContrastText(gold), height: 18, fontSize: '0.6rem', fontWeight: 700 }}
              />
            )}
          </Box>
          <Box display="flex" gap={0.5}>
            {unreadCount > 0 && (
              <Tooltip title="Mark all read">
                <IconButton size="small" onClick={markAllRead} sx={{ p: 0.5 }}>
                  <DoneAllIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            {notifications.length > 0 && (
              <Tooltip title="Clear all">
                <IconButton size="small" onClick={deleteAll} sx={{ p: 0.5, color: 'text.secondary' }}>
                  <DeleteSweepIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* List */}
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {notifications.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <NotificationsNoneIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.disabled" fontSize="0.78rem">
                No notifications
              </Typography>
            </Box>
          ) : (
            <List disablePadding sx={{ py: 0 }}>
              {notifications.map((n, idx) => {
                const actor = actorLabel(n);
                const initials = actor.slice(0, 2).toUpperCase();
                const color = avatarColor(actor);
                const timeAgo = dayjs(n.createdAt).fromNow();

                return (
                  <ListItem
                    key={n.id}
                    disablePadding
                    sx={{
                      px: 2, py: 1.25,
                      cursor: 'pointer',
                      bgcolor: n.read ? 'transparent' : alpha(gold, 0.05),
                      borderLeft: n.read ? `3px solid transparent` : `3px solid ${gold}`,
                      borderBottom: idx < notifications.length - 1 ? `1px solid` : 'none',
                      borderBottomColor: 'divider',
                      transition: 'background 0.15s, border-color 0.15s',
                      '&:hover': {
                        bgcolor: n.read ? 'action.hover' : alpha(gold, 0.1),
                      },
                      alignItems: 'flex-start',
                      gap: 1.25,
                    }}
                    onClick={() => handleClick(n)}
                  >
                    {/* Colored dot for unread */}
                    <Avatar
                      sx={{
                        width: 34, height: 34,
                        bgcolor: color,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        flexShrink: 0,
                        mt: 0.25,
                        border: n.read ? 'none' : `2px solid ${gold}`,
                      }}
                    >
                      {initials}
                    </Avatar>

                    {/* Content */}
                    <Box flex={1} minWidth={0}>
                      {/* Message based on notification type */}
                      <Typography fontSize="0.75rem" lineHeight={1.45} color="text.primary">
                        <Box component="span" fontWeight={700} color={color}>{actor}</Box>
                        {(!n.type || n.type === 'mention') && (
                          <>
                            <Box component="span" sx={{ opacity: 0.75 }}> mentioned you in </Box>
                            <Box component="span" fontWeight={600} sx={{ color: gold }}>{n.documentName || 'a document'}</Box>
                          </>
                        )}
                        {n.type === 'review_request' && (
                          <>
                            <Box component="span" sx={{ opacity: 0.75 }}> assigned you to review </Box>
                            <Box component="span" fontWeight={600} sx={{ color: gold }}>{n.documentName || 'a document'}</Box>
                          </>
                        )}
                        {n.type === 'review_approved' && (
                          <>
                            <Box component="span" sx={{ color: '#4caf50' }}> approved </Box>
                            <Box component="span" fontWeight={600} sx={{ color: gold }}>{n.documentName || 'a document'}</Box>
                            <Box component="span" sx={{ opacity: 0.75 }}> — ready to print</Box>
                          </>
                        )}
                        {n.type === 'review_rejected' && (
                          <>
                            <Box component="span" sx={{ color: '#f44336' }}> found issues in </Box>
                            <Box component="span" fontWeight={600} sx={{ color: gold }}>{n.documentName || 'a document'}</Box>
                            <Box component="span" sx={{ opacity: 0.75 }}> — needs corrections</Box>
                          </>
                        )}
                      </Typography>
                      {n.message && n.type !== 'mention' && (
                        <Typography fontSize="0.68rem" color="text.secondary" sx={{ mt: 0.2, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          "{n.message}"
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" fontSize="0.62rem" display="block" mt={0.3}>
                        {timeAgo}
                      </Typography>
                      {/* Action buttons for review assignments — hidden after response or if already responded (persisted) */}
                      {n.type === 'review_request' && n.assignmentId && !respondedIds.has(n.assignmentId) && (!n.assignmentStatus || n.assignmentStatus === 'pending') && (
                        <Box display="flex" gap={0.75} mt={0.75}>
                          <Button
                            size="small" variant="outlined" color="error"
                            sx={{ fontSize: '0.65rem', py: 0.25, px: 1, textTransform: 'none', borderRadius: '6px' }}
                            onClick={(e) => { e.stopPropagation(); setRespondedIds(prev => new Set(prev).add(n.assignmentId!)); respondToAssignment(n.assignmentId!, 'has_markups'); markRead(n.id); }}
                          >
                            Has markups — fix
                          </Button>
                          <Button
                            size="small" variant="contained"
                            sx={{ fontSize: '0.65rem', py: 0.25, px: 1, textTransform: 'none', borderRadius: '6px', bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
                            onClick={(e) => { e.stopPropagation(); setRespondedIds(prev => new Set(prev).add(n.assignmentId!)); respondToAssignment(n.assignmentId!, 'approved'); markRead(n.id); }}
                          >
                            Approve
                          </Button>
                        </Box>
                      )}
                      {n.type === 'review_request' && n.assignmentId && (respondedIds.has(n.assignmentId) || (n.assignmentStatus && n.assignmentStatus !== 'pending')) && (
                        <Typography fontSize="0.65rem" color={n.assignmentStatus === 'approved' ? '#4caf50' : n.assignmentStatus === 'has_markups' ? '#f44336' : 'text.disabled'} mt={0.5} fontStyle="italic">
                          {n.assignmentStatus === 'approved' ? '✅ Approved' : n.assignmentStatus === 'has_markups' ? '❌ Has markups — needs fix' : 'Response sent'}
                        </Typography>
                      )}
                    </Box>

                    {/* Actions */}
                    <Box display="flex" flexShrink={0} flexDirection="column" gap={0.25} mt={0.125}>
                      {!n.read && (
                        <Tooltip title="Mark read" placement="left">
                          <IconButton
                            size="small"
                            sx={{ p: 0.5, width: 22, height: 22, bgcolor: alpha(gold, 0.1), '&:hover': { bgcolor: alpha(gold, 0.2), color: gold } }}
                            onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                          >
                            <CheckIcon sx={{ fontSize: 12 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete" placement="left">
                        <IconButton
                          size="small"
                          sx={{ p: 0.5, width: 22, height: 22, '&:hover': { color: 'error.main', bgcolor: alpha('#f44336', 0.08) } }}
                          onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>

        {/* Footer */}
        {notifications.length > 5 && (
          <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', bgcolor: alpha(gold, 0.02) }}>
            <Button
              size="small"
              fullWidth
              onClick={deleteAll}
              sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'none' }}
              startIcon={<DeleteSweepIcon sx={{ fontSize: 14 }} />}
            >
              Clear all notifications
            </Button>
          </Box>
        )}
      </Popover>
    </>
  );
}
