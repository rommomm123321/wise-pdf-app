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
  const { notifications, unreadCount, markRead, markAllRead, deleteOne, deleteAll } = useNotifications();

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  const handleClick = useCallback((n: AppNotification) => {
    if (!n.read) markRead(n.id);
    handleClose();
    navigate(`/projects/${n.projectId}/documents/${n.documentId}?markupId=${n.markupId}`);
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
                      <Typography fontSize="0.75rem" lineHeight={1.45} color="text.primary">
                        <Box component="span" fontWeight={700} color={color}>{actor}</Box>
                        <Box component="span" color="text.primary" sx={{ opacity: 0.75 }}> mentioned you in </Box>
                        <Box component="span" fontWeight={600} sx={{ color: gold }}>{n.documentName || 'a document'}</Box>
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontSize="0.62rem" display="block" mt={0.3}>
                        {timeAgo}
                      </Typography>
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
