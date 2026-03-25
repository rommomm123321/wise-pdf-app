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
          <Toaster position="bottom-right" />
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeContextProvider>
  </StrictMode>
);
