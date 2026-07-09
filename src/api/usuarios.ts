import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { Usuario } from '@/tipos/usuario';

/** Usuario autenticado actual (o null si no hay sesión). Sirve para saber qué puede editar. */
export function useUsuarioActual() {
  return useQuery({
    queryKey: ['usuario-actual'],
    queryFn: () => apiRequest<Usuario | null>('/usuarios/me'),
    staleTime: 5 * 60_000,
  });
}
