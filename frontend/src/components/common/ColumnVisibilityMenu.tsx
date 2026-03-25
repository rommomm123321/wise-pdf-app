import { useState } from 'react';
import { 
  IconButton, 
  Popover, 
  Box, 
  Typography, 
  Switch,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import { useTranslation } from 'react-i18next';

export interface Column {
  key: string;
  label: string;
  required?: boolean;
}

interface ColumnVisibilityMenuProps {
  columns: Column[];
  visible: string[];
  onChange: (visible: string[]) => void;
}

export default function ColumnVisibilityMenu({ columns, visible, onChange }: ColumnVisibilityMenuProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleToggle = (key: string, required?: boolean) => {
    if (required) return;
    if (visible.includes(key)) {
      onChange(visible.filter((v) => v !== key));
    } else {
      onChange([...visible, key]);
    }
  };

  const visibleCount = visible.length;
  const totalCount = columns.length;

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          px: 1.5,
          gap: 0.5,
          fontSize: '0.8rem',
          color: 'text.secondary',
          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
        }}
      >
        <ViewColumnIcon fontSize="small" />
        <Typography variant="caption" fontWeight={600}>
          {visibleCount}/{totalCount}
        </Typography>
      </IconButton>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              minWidth: 240,
              overflow: 'hidden',
            },
          },
        }}
      >
        {/* Header */}
        <Box sx={{ 
          px: 2, py: 1.5, 
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.primary.main, 0.02)})`,
          borderBottom: 1,
          borderColor: 'divider',
        }}>
          <Box display="flex" alignItems="center" gap={1}>
            <ViewColumnIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2" fontWeight={700} color="primary">
              {t('toggleColumns', 'Toggle columns')}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {visibleCount} of {totalCount} visible
          </Typography>
        </Box>

        {/* Column list */}
        <Box sx={{ py: 0.5 }}>
          {columns.map((col, index) => {
            const isVisible = visible.includes(col.key);
            const isRequired = !!col.required;
            return (
              <Box key={col.key}>
                <Box
                  onClick={() => !isRequired && handleToggle(col.key, col.required)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 0.75,
                    cursor: isRequired ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': !isRequired ? {
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                    } : {},
                    opacity: 1,
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1.5}>
                    {isRequired ? (
                      <LockIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    ) : isVisible ? (
                      <VisibilityIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    ) : (
                      <VisibilityOffIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                    )}
                    <Typography 
                      variant="body2" 
                      fontWeight={isVisible ? 600 : 400}
                      color={isVisible ? 'text.primary' : 'text.secondary'}
                    >
                      {col.label}
                    </Typography>
                  </Box>
                  {!isRequired ? (
                    <Switch
                      size="small"
                      checked={isVisible}
                      onChange={() => handleToggle(col.key, col.required)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: theme.palette.primary.main,
                        },
                      }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {t('required', 'Required')}
                    </Typography>
                  )}
                </Box>
                {index < columns.length - 1 && <Divider sx={{ mx: 2 }} />}
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}
