import React, { memo, useEffect, useRef } from 'react';
import { Box, Typography, Tooltip, useTheme, alpha, IconButton } from '@mui/material';
import RectangleIcon from '@mui/icons-material/Rectangle';
import TimelineIcon from '@mui/icons-material/Timeline';
import TextFormatIcon from '@mui/icons-material/TextFormat';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CloudIcon from '@mui/icons-material/Cloud';
import CreateIcon from '@mui/icons-material/Create';
import HighlightIcon from '@mui/icons-material/Highlight';
import EastIcon from '@mui/icons-material/East';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import LockIcon from '@mui/icons-material/Lock';
import DeleteIcon from '@mui/icons-material/Delete';

const typeIcons: Record<string, React.ReactNode> = {
  rect: <RectangleIcon fontSize="small" />,
  line: <TimelineIcon fontSize="small" />,
  arrow: <EastIcon fontSize="small" />,
  text: <TextFormatIcon fontSize="small" />,
  circle: <RadioButtonUncheckedIcon fontSize="small" />,
  cloud: <CloudIcon fontSize="small" />,
  pen: <CreateIcon fontSize="small" />,
  highlighter: <HighlightIcon fontSize="small" />,
  callout: <ChatBubbleOutlineIcon fontSize="small" />,
};

const typeLabels: Record<string, string> = {
  rect: 'Rectangle', line: 'Line', arrow: 'Arrow', text: 'Text',
  cloud: 'Cloud', pen: 'Pen', highlighter: 'Highlight', callout: 'Callout',
};

interface MarkupListItemProps {
  markup: any;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete?: () => void;
}

const MarkupListItem = memo(function MarkupListItem({ markup, selected, onSelect, onDelete }: MarkupListItemProps) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selected]);

  const color = markup.properties?.stroke || gold;
  const locked = markup.properties?.locked;

  return (
    <Tooltip title={`${typeLabels[markup.type] || markup.type} · Page ${(markup.pageNumber || 0) + 1}`} placement="right" enterDelay={400}>
      <Box
        ref={ref}
        onClick={() => onSelect(markup.id)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.6,
          cursor: 'pointer',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: selected ? alpha(gold, 0.08) : 'transparent',
          transition: 'all 0.1s ease',
          '&:hover': {
            bgcolor: selected ? alpha(gold, 0.12) : alpha(theme.palette.text.primary, 0.03),
            '& .delete-btn': { opacity: 0.6 }
          },
        }}
      >
        <Box sx={{ color, display: 'flex', alignItems: 'center', flexShrink: 0, fontSize: 16 }}>
          {typeIcons[markup.type] || <RectangleIcon fontSize="small" />}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={600} noWrap sx={{ fontSize: '0.73rem', lineHeight: 1.3, color: selected ? gold : 'text.primary' }}>
            {markup.properties?.subject || typeLabels[markup.type] || markup.type}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.62rem', lineHeight: 1.2 }}>
            Page {(markup.pageNumber || 0) + 1}
            {markup.author?.name && ` · ${markup.author.name}`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {locked && <LockIcon sx={{ fontSize: 12, opacity: 0.35 }} />}
          {!locked && onDelete && (
            <IconButton 
              className="delete-btn"
              size="small" 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              sx={{ p: 0.2, opacity: 0, '&:hover': { opacity: '1 !important', color: 'error.main' } }}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>
      </Box>
    </Tooltip>
  );
});

export default MarkupListItem;
