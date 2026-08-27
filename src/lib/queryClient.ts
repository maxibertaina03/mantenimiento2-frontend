import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './apiClient';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s: evita refetches inmediatos al navegar
      // El apiClient ya reintenta por su cuenta el arranque en frio del server.
      // Aca solo evitamos insistir con errores que no se van a arreglar solos
      // (404, 400, 401...): reintentarlos solo demora el mensaje al usuario.
      retry: (contador, error) => {
        if (error instanceof ApiError && error.statusCode < 500) return false;
        return contador < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});
