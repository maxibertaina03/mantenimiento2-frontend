import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-react';
import { App } from './App';
import { PantallaLogin } from './componentes/PantallaLogin';
import { ProveedorToken } from './componentes/ProveedorToken';
import { queryClient } from './lib/queryClient';
import './index.css';

// Publishable key de Clerk. Si NO está configurada, la app corre SIN auth
// (modo desarrollo): útil mientras no tengas la cuenta de Clerk lista.
// Debe combinarse con AUTH_DISABLED="true" en el backend.
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/** App envuelta en los providers comunes (React Query + Router). */
function ProvidersComunes({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

/** Punto de entrada: decide si montar con o sin autenticación. */
function Raiz() {
  // Sin Clerk configurado -> app abierta (dev). El backend debe tener AUTH_DISABLED=true.
  if (!clerkKey) {
    return (
      <ProvidersComunes>
        <App />
      </ProvidersComunes>
    );
  }

  // Con Clerk -> toda la app queda detrás del login.
  return (
    <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
      <SignedOut>
        <PantallaLogin />
      </SignedOut>
      <SignedIn>
        <ProveedorToken>
          <ProvidersComunes>
            <App />
          </ProvidersComunes>
        </ProveedorToken>
      </SignedIn>
    </ClerkProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Raiz />
  </React.StrictMode>,
);
