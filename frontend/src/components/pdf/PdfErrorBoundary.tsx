import { Component, type ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: string | null; }

export class PdfErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.error('[PdfErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2, p: 4, bgcolor: 'background.default' }}>
        <Typography variant="h6" color="error">Rendering error</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, textAlign: 'center' }}>
          {this.state.error || 'An unexpected error occurred in the PDF viewer.'}
        </Typography>
        <Button variant="outlined" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
          Reload
        </Button>
      </Box>
    );
  }
}
