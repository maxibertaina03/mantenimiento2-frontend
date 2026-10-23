import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';

/**
 * La versión del servidor. Cambia solo cuando se publica, así que se pide una
 * vez y no se insiste si falla: es un dato de pie de página, no tiene que
 * mostrar errores.
 */
export function useVersionServidor() {
  return useQuery({
    queryKey: ['sistema', 'version'],
    queryFn: () => apiRequest<{ version: string; commit: string }>('/version'),
    staleTime: 30 * 60_000,
    retry: false,
  });
}
