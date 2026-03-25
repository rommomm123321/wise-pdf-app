import { Paper, Box, Typography, Button, IconButton, Slide } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

interface BulkAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: 'inherit' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}

interface BulkActionsToolbarProps {
  selectedCount: number;
  onClear: () => void;
  actions: BulkAction[];
}

export default function BulkActionsToolbar({ selectedCount, onClear, actions }: BulkActionsToolbarProps) {
  const { t } = useTranslation();

  return (
    <Slide direction="up" in={selectedCount > 0} unmountOnExit>
      <Paper
        elevation={6}
        sx={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%) !important',
          zIndex: 1200,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          px: 3,
          py: 1.5,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          minWidth: 300,
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            {selectedCount} {t('selected', 'Selected')}
          </Typography>
          <IconButton size="small" color="inherit" onClick={onClear}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
          {actions.map((action, idx) => (
            <Button
              key={idx}
              variant="contained"
              size="small"
              color={action.color || 'inherit'}
              startIcon={action.icon}
              onClick={action.onClick}
              sx={{ 
                bgcolor: action.color ? undefined : 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: action.color ? undefined : 'rgba(255,255,255,0.2)' }
              }}
            >
              {action.label}
            </Button>
          ))}
        </Box>
      </Paper>
    </Slide>
  );
}
