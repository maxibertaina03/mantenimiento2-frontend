import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { queryClient } from './lib/queryClient';
import './index.css';

// ───────── Clerk (preparado, DESACTIVADO en esta etapa) ─────────
// Cuando se active la autenticación:
//   1. npm install @clerk/clerk-react
//   2. Completar VITE_CLERK_PUBLISHABLE_KEY en el .env
//   3. Descomentar el import y envolver <App /> con <ClerkProvider>
//
// import { ClerkProvider } from '@clerk/clerk-react';
// const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* <ClerkProvider publishableKey={clerkKey}> */}
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
    {/* </ClerkProvider> */}
  </React.StrictMode>,
);
