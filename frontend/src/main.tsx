import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeContextProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { queryClient } from './lib/queryClient';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './i18n';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeContextProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: '1px solid #F3C24B',
                borderRadius: '10px',
                fontSize: '0.8rem',
                padding: '10px 14px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                maxWidth: '360px',
              },
              success: {
                iconTheme: { primary: '#F3C24B', secondary: '#1A1A1A' },
                duration: 6000,
              },
            }}
          />
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeContextProvider>
  </StrictMode>
);
