import { memo, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Button,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  useTheme,
  alpha,
  Drawer,
  useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import type { SpellError } from '../../lib/spellCheck';

interface SpellCheckPanelProps {
  open: boolean;
  onClose: () => void;
  errors: SpellError[];
  scope: 'page' | 'document';
  onScopeChange: (scope: 'page' | 'document') => void;
  onJumpToError: (error: SpellError) => void;
  onFixWord: (error: SpellError, replacement: string) => void;
  onIgnoreWord: (word: string) => void;
  isChecking: boolean;
  currentPage: number;
  totalPages: number;
  language?: string;
  onLanguageChange?: (lang: string) => void;
}

const FIELD_COLORS: Record<string, string> = {
  text: '#2196f3',
  subject: '#ff9800',
  comment: '#9c27b0',
};

const SpellCheckPanel = memo(function SpellCheckPanel({
  open,
  onClose,
  errors,
  scope,
  onScopeChange,
  onJumpToError,
  onFixWord,
  onIgnoreWord,
  isChecking,
  currentPage,
  totalPages,
  language,
  onLanguageChange,
}: SpellCheckPanelProps) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const isMobile = useMediaQuery('(max-width:700px)');

  const uniqueMarkupCount = useMemo(() => {
    const ids = new Set(errors.map(e => e.pageNumber));
    return ids.size;
  }, [errors]);

  const content = (
    <Box sx={{ width: isMobile ? '100%' : 320, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.5,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Spell Check</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={scope}
            onChange={(_, v) => { if (v) onScopeChange(v); }}
            sx={{
              height: 28,
              '& .MuiToggleButton-root': {
                fontSize: '0.7rem', fontWeight: 600, px: 1, py: 0,
                textTransform: 'none',
                borderColor: theme.palette.divider,
                '&.Mui-selected': {
                  bgcolor: alpha(gold, 0.15),
                  color: gold,
                  borderColor: alpha(gold, 0.4),
                },
              },
            }}
          >
            <ToggleButton value="page">Page</ToggleButton>
            <ToggleButton value="document">All</ToggleButton>
          </ToggleButtonGroup>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Summary */}
      {!isChecking && (
        <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
          {errors.length > 0 ? (
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
              Found <strong style={{ color: theme.palette.error.main }}>{errors.length}</strong> error{errors.length !== 1 ? 's' : ''} in <strong>{uniqueMarkupCount}</strong> markup{uniqueMarkupCount !== 1 ? 's' : ''}
              {scope === 'page' ? ` (page ${currentPage})` : ` (${totalPages} pages)`}
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 18, color: '#4caf50' }} />
              <Typography sx={{ fontSize: '0.8rem', color: '#4caf50', fontWeight: 600 }}>
                All clear! No spelling errors found.
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1 }}>
        {isChecking ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pt: 6 }}>
            <CircularProgress size={32} sx={{ color: gold }} />
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
              {scope === 'document'
                ? `Checking ${totalPages} page${totalPages !== 1 ? 's' : ''}...`
                : `Checking page ${currentPage}...`}
            </Typography>
          </Box>
        ) : errors.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, pt: 6 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 48, color: alpha('#4caf50', 0.5) }} />
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', textAlign: 'center' }}>
              No spelling errors detected in {scope === 'page' ? `page ${currentPage}` : 'the document'}.
            </Typography>
          </Box>
        ) : (
          errors.map((err, idx) => (
            <Box
              key={`${err.pageNumber}-${"text"}-${0}-${idx}`}
              onClick={() => onJumpToError(err)}
              sx={{
                mb: 1,
                p: 1.5,
                borderRadius: '8px',
                border: `1px solid ${theme.palette.divider}`,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background-color 0.15s',
                '&:hover': {
                  borderColor: alpha(gold, 0.5),
                  bgcolor: alpha(gold, 0.04),
                },
              }}
            >
              {/* Error word + suggestions */}
              <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: theme.palette.error.main,
                    textDecoration: 'wavy underline',
                    textDecorationColor: theme.palette.error.main,
                  }}
                >
                  {err.word}
                </Typography>
                {err.suggestions.length > 0 && (
                  <>
                    <Typography component="span" sx={{ fontSize: '0.78rem', color: 'text.secondary', mx: 0.5 }}>
                      &rarr;
                    </Typography>
                    {err.suggestions.slice(0, 3).map(s => (
                      <Chip
                        key={s}
                        label={s}
                        size="small"
                        clickable
                        onClick={(e) => {
                          e.stopPropagation();
                          onFixWord(err, s);
                        }}
                        sx={{
                          height: 22,
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          bgcolor: alpha('#4caf50', 0.1),
                          color: '#4caf50',
                          border: `1px solid ${alpha('#4caf50', 0.3)}`,
                          '&:hover': { bgcolor: alpha('#4caf50', 0.2) },
                        }}
                      />
                    ))}
                  </>
                )}
              </Box>

              {/* Context */}
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4, mb: 0.75, fontFamily: 'monospace' }}>
                {err.context}
              </Typography>

              {/* Meta row */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Chip
                    label={"text"}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      bgcolor: alpha(FIELD_COLORS["text"] || '#888', 0.12),
                      color: FIELD_COLORS["text"] || '#888',
                    }}
                  />
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                    Page {err.pageNumber + 1}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onIgnoreWord(err.word);
                  }}
                  sx={{
                    minWidth: 0,
                    px: 1,
                    py: 0,
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    color: 'text.secondary',
                    '&:hover': { bgcolor: alpha(theme.palette.text.secondary, 0.08) },
                  }}
                >
                  Ignore
                </Button>
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            maxHeight: '75vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        zIndex: 20,
        borderLeft: `1px solid ${theme.palette.divider}`,
        boxShadow: '-4px 0 16px rgba(0,0,0,0.08)',
      }}
    >
      {content}
    </Box>
  );
});

export default SpellCheckPanel;
