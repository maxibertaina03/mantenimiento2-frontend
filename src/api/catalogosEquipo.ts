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
type Catalogo = 'ubicaciones-equipo' | 'tipos-equipo-planta' | 'marcas-equipo';

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
    marcas: useCatalogo('marcas-equipo'),
  };
}

/** Un modelo, que siempre pertenece a una marca. */
export interface ModeloEquipo extends ItemCatalogoEquipo {
  marcaId: string;
  marcaNombre: string | null;
}

/**
 * Los modelos de una marca.
 *
 * Sin marca elegida no pide nada: la lista completa de modelos de todas las
 * marcas no le sirve a nadie, porque un modelo fuera de su marca no significa
 * nada.
 */
export function useModelosDeMarca(marcaId: string | null | undefined) {
  return useQuery({
    queryKey: ['modelos-equipo', marcaId ?? 'ninguna'] as const,
    queryFn: () => apiRequest<ModeloEquipo[]>('/modelos-equipo', { query: { marcaId } }),
    enabled: Boolean(marcaId),
    staleTime: 60_000,
  });
}

/** Todos los modelos, con su marca. Para la pantalla de catálogos. */
export function useTodosLosModelos() {
  return useQuery({
    queryKey: ['modelos-equipo', 'todos'] as const,
    queryFn: () => apiRequest<ModeloEquipo[]>('/modelos-equipo'),
    staleTime: 60_000,
  });
}

export function useCrearModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: { marcaId: string; nombre: string }) =>
      apiRequest<ModeloEquipo>('/modelos-equipo', { method: 'POST', body: datos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modelos-equipo'] });
      // El conteo de modelos por marca cambia.
      qc.invalidateQueries({ queryKey: ['marcas-equipo'] });
    },
  });
}

export function useActualizarModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...datos }: { id: string; nombre?: string; activo?: boolean }) =>
      apiRequest<ModeloEquipo>(`/modelos-equipo/${id}`, { method: 'PATCH', body: datos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modelos-equipo'] });
      qc.invalidateQueries({ queryKey: ['equipos'] });
    },
  });
}

export function useEliminarModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/modelos-equipo/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modelos-equipo'] }),
  });
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
