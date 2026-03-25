import {
  Box,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Paper,
  InputAdornment,
  useMediaQuery,
} from '@mui/material';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import ColumnVisibilityMenu from '../common/ColumnVisibilityMenu';
import { MOBILE_BREAKPOINT_PX } from '../../constants';

export const FILE_MANAGER_COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'type', label: 'Type' },
  { key: 'date', label: 'Date' },
  { key: 'version', label: 'Version' },
  { key: 'actions', label: 'Actions' },
];

export type SortOption = 'manual' | 'name' | 'date' | 'version';
export type ViewMode = 'grid' | 'list';
export type GroupOption = 'none' | 'type' | 'date';

interface FileManagerToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
  groupBy: GroupOption;
  onGroupChange: (g: GroupOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  canEdit: boolean;
  fmCols: string[];
  onFmColsChange: (cols: string[]) => void;
}

export default function FileManagerToolbar({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  groupBy,
  onGroupChange,
  viewMode,
  onViewModeChange,
  fmCols,
  onFmColsChange,
}: FileManagerToolbarProps) {
  const { t } = useTranslation();
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT_PX})`);
  const isSmall = useMediaQuery('(max-width:600px)');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 1.5,
          p: 1,
          borderRadius: 2,
        }}
      >
        <Box 
          display="flex" 
          flexDirection="row" 
          flexWrap="wrap"
          alignItems="center" 
          justifyContent="space-between"
          gap={1.5}
          sx={{ width: '100%' }}
        >
          {/* Group 1: Filters (Search, Sort, Group) */}
          <Box 
            display="flex" 
            flexDirection={isSmall ? 'column' : 'row'} 
            alignItems={isSmall ? 'stretch' : 'center'} 
            gap={1.5} 
            sx={{ 
              flexGrow: 1, 
              minWidth: { xs: '100%', sm: 400, md: 'auto' },
              flexBasis: { xs: '100%', sm: 'auto' }
            }}
          >
            <TextField
              size="small"
              placeholder={t('searchFiles', 'Search files...')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Box display="flex" gap={1} sx={{ minWidth: { xs: '100%', sm: 'auto' } }}>
              <FormControl size="small" sx={{ minWidth: 100, flex: 1 }}>
                <InputLabel>{t('sortBy')}</InputLabel>
                <Select
                  value={sortBy}
                  label={t('sortBy')}
                  onChange={(e) => onSortChange(e.target.value as SortOption)}
                >
                  <MenuItem value="manual">{t('sortManual', 'Manual')}</MenuItem>
                  <MenuItem value="name">{t('sortByName')}</MenuItem>
                  <MenuItem value="date">{t('sortByDate')}</MenuItem>
                  <MenuItem value="version">{t('sortByVersion')}</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 100, flex: 1 }}>
                <InputLabel>{t('groupBy')}</InputLabel>
                <Select
                  value={groupBy}
                  label={t('groupBy')}
                  onChange={(e) => onGroupChange(e.target.value as GroupOption)}
                >
                  <MenuItem value="none">{t('groupNone', 'None')}</MenuItem>
                  <MenuItem value="type">{t('groupType', 'By Type')}</MenuItem>
                  <MenuItem value="date">{t('groupDate', 'By Date')}</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* Group 2: View Controls (Mobile unified) */}
          {!isMobile && (
            <Box 
              display="flex" 
              alignItems="center" 
              justifyContent="flex-end"
              gap={1}
              sx={{ 
                flexGrow: 0,
                width: 'auto',
                flexWrap: 'wrap',
                minWidth: 0
              }}
            >
              <Box display="flex" alignItems="center" gap={1} sx={{ flexShrink: 0, ml: 'auto' }}>
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, v) => v && onViewModeChange(v)}
                  size="small"
                >
                  <ToggleButton value="grid"><ViewModuleIcon fontSize="small" /></ToggleButton>
                  <ToggleButton value="list"><ViewListIcon fontSize="small" /></ToggleButton>
                </ToggleButtonGroup>

                {viewMode === 'list' && (
                  <ColumnVisibilityMenu 
                    columns={FILE_MANAGER_COLUMNS.map(c => ({ ...c, label: t(c.key) }))} 
                    visible={fmCols} 
                    onChange={onFmColsChange} 
                  />
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
