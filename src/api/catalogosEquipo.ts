import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';

/** Un ítem de cualquiera de los dos catálogos del módulo. */
export interface ItemCatalogoEquipo {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  /** Cuántos equipos lo usan: si es > 0 no se puede borrar. */
  equipos: number;
}

/**
 * Los dos catálogos son idénticos en forma, así que comparten los hooks.
 * Duplicarlos garantizaría que en algún momento se arregle algo en uno y no en
 * el otro.
 */
type Catalogo = 'ubicaciones-equipo' | 'tipos-equipo-planta';

function useCatalogo(catalogo: Catalogo) {
  return useQuery({
    queryKey: [catalogo],
    queryFn: () => apiRequest<ItemCatalogoEquipo[]>(`/${catalogo}`),
    staleTime: 60_000,
  });
}

export function useCatalogoEquipos() {
  return {
    ubicaciones: useCatalogo('ubicaciones-equipo'),
    tipos: useCatalogo('tipos-equipo-planta'),
  };
}

export function useCrearItemCatalogo(catalogo: Catalogo) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: { nombre: string; orden?: number }) =>
      apiRequest<ItemCatalogoEquipo>(`/${catalogo}`, { method: 'POST', body: datos }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [catalogo] }),
  });
}

export function useActualizarItemCatalogo(catalogo: Catalogo) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...datos }: { id: string; nombre?: string; orden?: number; activo?: boolean }) =>
      apiRequest<ItemCatalogoEquipo>(`/${catalogo}/${id}`, { method: 'PATCH', body: datos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [catalogo] });
      // El nombre de la ubicación se muestra en el listado de equipos.
      qc.invalidateQueries({ queryKey: ['equipos'] });
    },
  });
}

export function useEliminarItemCatalogo(catalogo: Catalogo) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/${catalogo}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [catalogo] }),
  });
}
