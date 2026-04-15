import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, useTheme } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { apiFetch } from '../lib/api';

/**
 * /review-action?assignmentId=xxx&action=approved|has_markups
 * Auto-executes review response when opened from Teams notification.
 * Shows result and redirects to document.
 */
export default function ReviewActionPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const gold = theme.palette.primary.main;

  const assignmentId = params.get('assignmentId');
  const action = params.get('action');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [docUrl, setDocUrl] = useState('');

  useEffect(() => {
    if (!assignmentId || !action) {
      setStatus('error');
      setMessage('Missing assignmentId or action parameter.');
      return;
    }
    if (!['approved', 'has_markups'].includes(action)) {
      setStatus('error');
      setMessage('Invalid action. Must be "approved" or "has_markups".');
      return;
    }

    (async () => {
      try {
        const res = await apiFetch(`/api/review-assignments/${assignmentId}/respond`, {
          method: 'PATCH',
          body: JSON.stringify({ action }),
        });

        const label = action === 'approved' ? 'Approved — ready to print' : 'Sent back for corrections';
        setStatus('success');
        setMessage(label);

        // Try to get document URL for redirect
        if (res?.documentId) {
          try {
            const docInfo = await apiFetch(`/api/documents/${res.documentId}/info`);
            const projectId = docInfo?.folder?.projectId;
            if (projectId) {
              setDocUrl(`/projects/${projectId}/documents/${res.documentId}`);
              // Auto-redirect after 2 seconds
              setTimeout(() => navigate(`/projects/${projectId}/documents/${res.documentId}`), 2000);
            }
          } catch { /* no redirect */ }
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message || 'Failed to respond. You may have already responded.');
      }
    })();
  }, [assignmentId, action, navigate]);

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: theme.palette.background.default,
    }}>
      <Box sx={{
        textAlign: 'center', p: 4, borderRadius: '16px',
        bgcolor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        maxWidth: 400,
      }}>
        {status === 'loading' && (
          <>
            <CircularProgress size={48} sx={{ color: gold, mb: 2 }} />
            <Typography variant="h6" fontWeight={600}>Processing...</Typography>
            <Typography color="text.secondary" fontSize="0.85rem" mt={1}>
              {action === 'approved' ? 'Approving document...' : 'Sending feedback...'}
            </Typography>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircleIcon sx={{ fontSize: 56, color: action === 'approved' ? '#4caf50' : '#ff9800', mb: 2 }} />
            <Typography variant="h6" fontWeight={600}>{message}</Typography>
            <Typography color="text.secondary" fontSize="0.85rem" mt={1}>
              The requester has been notified.
            </Typography>
            {docUrl && (
              <Typography fontSize="0.78rem" color={gold} mt={2} sx={{ cursor: 'pointer' }}
                onClick={() => navigate(docUrl)}>
                Redirecting to document...
              </Typography>
            )}
          </>
        )}
        {status === 'error' && (
          <>
            <ErrorIcon sx={{ fontSize: 56, color: '#f44336', mb: 2 }} />
            <Typography variant="h6" fontWeight={600}>Error</Typography>
            <Typography color="text.secondary" fontSize="0.85rem" mt={1}>{message}</Typography>
          </>
        )}
      </Box>
    </Box>
  );
}
