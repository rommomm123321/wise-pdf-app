import { useState } from 'react';
import { Box } from '@mui/material';
import UserInfoPopover from './UserInfoPopover';

interface ProjectUser {
  id: string;
  name: string;
  email: string;
}

interface MentionTextProps {
  text: string;
  projectUsers?: ProjectUser[];
  sx?: any;
}

/** Renders plain text with @Name segments highlighted as clickable mentions. */
export default function MentionText({ text, projectUsers = [], sx }: MentionTextProps) {
  const [popover, setPopover] = useState<{ id: string; el: HTMLElement } | null>(null);

  if (!text) return null;

  // Sort users by name length descending so longer names match first (e.g. "Alice Smith" before "Alice")
  const sorted = [...projectUsers].sort((a, b) => (b.name || b.email).length - (a.name || a.email).length);

  // Split text into segments: 'text' or 'mention'
  type Seg = { type: 'text'; content: string } | { type: 'mention'; content: string; userId: string };
  const segments: Seg[] = [];
  let rest = text;

  while (rest.length > 0) {
    const atIdx = rest.indexOf('@');
    if (atIdx === -1) {
      segments.push({ type: 'text', content: rest });
      break;
    }
    if (atIdx > 0) segments.push({ type: 'text', content: rest.substring(0, atIdx) });

    let matched = false;
    for (const u of sorted) {
      const name = u.name || u.email;
      if (rest.substring(atIdx + 1).toLowerCase().startsWith(name.toLowerCase())) {
        segments.push({ type: 'mention', content: `@${name}`, userId: u.id });
        rest = rest.substring(atIdx + 1 + name.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      segments.push({ type: 'text', content: '@' });
      rest = rest.substring(atIdx + 1);
    }
  }

  return (
    <Box component="span" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...sx }}>
      {segments.map((seg, i) =>
        seg.type === 'mention' ? (
          <Box
            key={i}
            component="span"
            onClick={(e) => { e.stopPropagation(); setPopover({ id: (seg as any).userId, el: e.currentTarget as HTMLElement }); }}
            sx={{
              color: 'primary.main', fontWeight: 700, cursor: 'pointer',
              borderRadius: '3px', px: 0.3,
              '&:hover': { textDecoration: 'underline', bgcolor: 'action.hover' },
              pointerEvents: 'auto',
            }}
          >
            {seg.content}
          </Box>
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
      <UserInfoPopover
        userId={popover?.id || null}
        anchorEl={popover?.el || null}
        onClose={() => setPopover(null)}
      />
    </Box>
  );
}
