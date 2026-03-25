import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const { t } = useTranslation();

  return (
    <MuiBreadcrumbs sx={{ mb: 2 }}>
      <Link
        component={RouterLink}
        to="/projects"
        color="text.secondary"
        underline="hover"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem' }}
      >
        <HomeIcon sx={{ fontSize: 18 }} />
        {t('breadcrumbHome')}
      </Link>
      {(items || []).map((item, i) =>
        i < (items || []).length - 1 && item.href ? (
          <Link
            key={i}
            component={RouterLink}
            to={item.href}
            color="text.secondary"
            underline="hover"
            sx={{ fontSize: '0.875rem' }}
          >
            {item.label}
          </Link>
        ) : (
          <Typography key={i} color="text.primary" sx={{ fontSize: '0.875rem' }}>
            {item.label}
          </Typography>
        )
      )}
    </MuiBreadcrumbs>
  );
}
