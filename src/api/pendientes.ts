import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { DatosPendiente, Pendiente } from '@/tipos/pendiente';

export const clavesPendientes = {
  base: ['pendientes'] as const,
  lista: (estado: 'abiertos' | 'hechos') => ['pendientes', estado] as const,
  personas: ['pendientes', 'personas'] as const,
};

/** Los abiertos llegan ordenados: urgentes primero, después los más viejos. */
export function usePendientes(estado: 'abiertos' | 'hechos' = 'abiertos', habilitado = true) {
  return useQuery({
    enabled: habilitado,
    queryKey: clavesPendientes.lista(estado),
    queryFn: () => apiRequest<Pendiente[]>('/pendientes', { query: { estado } }),
  });
}

/** A quién se le puede dar un pendiente (id y nombre). */
export function usePersonasDePendientes(habilitado = true) {
  return useQuery({
    enabled: habilitado,
    queryKey: clavesPendientes.personas,
    queryFn: () => apiRequest<{ id: string; nombre: string }[]>('/pendientes/personas'),
    staleTime: 5 * 60_000,
  });
}

function useCambio<T>(hacer: (datos: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hacer,
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesPendientes.base }),
  });
}

export const useAnotarPendiente = () =>
  useCambio((datos: DatosPendiente) =>
    apiRequest<Pendiente>('/pendientes', { method: 'POST', body: datos }),
  );

export const useEditarPendiente = () =>
  useCambio(({ id, ...datos }: Partial<DatosPendiente> & { id: string }) =>
    apiRequest<Pendiente>(`/pendientes/${id}`, { method: 'PATCH', body: datos }),
  );

export const useMarcarHecho = () =>
  useCambio((id: string) => apiRequest<Pendiente>(`/pendientes/${id}/hecho`, { method: 'POST' }));

export const useReabrirPendiente = () =>
  useCambio((id: string) => apiRequest<Pendiente>(`/pendientes/${id}/reabrir`, { method: 'POST' }));

export const useBorrarPendiente = () =>
  useCambio((id: string) => apiRequest<void>(`/pendientes/${id}`, { method: 'DELETE' }));
