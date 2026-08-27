import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';
import type { RolUsuario, Usuario } from '@/tipos/usuario';

/** Usuario autenticado actual (o null si no hay sesión). Sirve para saber qué puede editar. */
export function useUsuarioActual() {
  return useQuery({
    queryKey: ['usuario-actual'],
    queryFn: () => apiRequest<Usuario | null>('/usuarios/me'),
    staleTime: 5 * 60_000,
  });
}

/** Padrón de usuarios: se usa para asignar equipos IT. */
export function useUsuarios(pagina = 1, limite = 100) {
  return useQuery({
    queryKey: ['usuarios', 'lista', pagina, limite],
    queryFn: () =>
      apiRequest<RespuestaPaginada<Usuario>>('/usuarios', { query: { pagina, limite } }),
    staleTime: 5 * 60_000,
  });
}

/** Cambia el rol (u otros datos) de un usuario. Solo para administradores. */
export function useActualizarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...datos }: { id: string; rol?: RolUsuario; nombre?: string }) =>
      apiRequest<Usuario>(`/usuarios/${id}`, { method: 'PATCH', body: datos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      // El propio rol puede haber cambiado: refrescar quién soy.
      qc.invalidateQueries({ queryKey: ['usuario-actual'] });
    },
  });
}
