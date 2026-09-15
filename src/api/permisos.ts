import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';

export type Rol = 'ADMIN' | 'GERENCIA' | 'ADMINISTRATIVO' | 'MANTENIMIENTO';

/** Cómo se llama cada rol en la pantalla, y qué es en una línea. */
export const ROLES: { rol: Rol; etiqueta: string; descripcion: string }[] = [
  { rol: 'ADMIN', etiqueta: 'Administrador', descripcion: 'Puede todo. No se le puede quitar la llave.' },
  { rol: 'GERENCIA', etiqueta: 'Gerencia', descripcion: 'Mira el sistema entero y no toca nada.' },
  {
    rol: 'ADMINISTRATIVO',
    etiqueta: 'Administrativo',
    descripcion: 'Administración de la empresa: las órdenes de compra.',
  },
  {
    rol: 'MANTENIMIENTO',
    etiqueta: 'Mantenimiento',
    descripcion: 'El depósito: stock, movimientos y el circuito de compras.',
  },
];

export interface ItemPermiso {
  permiso: string;
  grupo: string;
  etiqueta: string;
}

/**
 * Lo que puede hacer quien está mirando.
 *
 * Lo pide la aplicación entera para no ofrecer botones que van a terminar en un
 * error. Ojo con lo que esto NO es: esconder un botón no es un permiso. Quien
 * decide es el servidor, y este dato solo evita que la pantalla prometa algo
 * que después se rechaza.
 */
export interface MisPermisos {
  rol: Rol | null;
  permisos: string[];
}

export const clavesPermisos = {
  mios: ['permisos', 'mios'] as const,
  porRol: ['permisos', 'por-rol'] as const,
  catalogo: ['permisos', 'catalogo'] as const,
};

export function useMisPermisos() {
  return useQuery({
    queryKey: clavesPermisos.mios,
    queryFn: () => apiRequest<MisPermisos>('/permisos/mios'),
    // Cambian poco y se piden en cada pantalla. Al guardar se invalidan.
    staleTime: 5 * 60_000,
  });
}

export function useCatalogoPermisos() {
  return useQuery({
    queryKey: clavesPermisos.catalogo,
    queryFn: () => apiRequest<ItemPermiso[]>('/permisos/catalogo'),
    staleTime: 60 * 60_000,
  });
}

export function usePermisosPorRol() {
  return useQuery({
    queryKey: clavesPermisos.porRol,
    queryFn: () => apiRequest<Record<Rol, string[]>>('/permisos'),
  });
}

export function useGuardarPermisos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rol, permisos }: { rol: Rol; permisos: string[] }) =>
      apiRequest<string[]>(`/permisos/${rol}`, { method: 'PUT', body: { permisos } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permisos'] });
      // Si el administrador se cambió los permisos a sí mismo, el menú y los
      // botones tienen que reflejarlo sin recargar la página.
      qc.invalidateQueries({ queryKey: clavesPermisos.mios });
    },
  });
}
