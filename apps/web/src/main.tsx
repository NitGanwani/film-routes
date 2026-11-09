import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ApiError } from './api/client.js';
import { App } from './App.js';
import { initI18n } from './i18n/index.js';
import { SessionProvider } from './session/SessionProvider.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying only helps when the server or network hiccuped; a 4xx will
      // answer the same way again.
      retry: (failures, error) =>
        failures < 2 &&
        (!(error instanceof ApiError) ||
          error.status === 0 ||
          error.status >= 500),
    },
  },
});

void initI18n().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SessionProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
});
