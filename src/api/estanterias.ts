import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import { clavesMateriales } from './materiales';

/** Una estantería del depósito, con cuántos materiales guarda. */
export interface Estanteria {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  /** Si es > 0 no se puede borrar: se desactiva. */
  materiales: number;
}

const CLAVE = ['estanterias-material'] as const;

export function useEstanterias(soloActivas = false) {
  return useQuery({
    queryKey: [...CLAVE, soloActivas] as const,
    queryFn: () =>
      apiRequest<Estanteria[]>('/estanterias-material', {
        query: { soloActivas: soloActivas ? 'true' : undefined },
      }),
    staleTime: 60_000,
  });
}

export function useCrearEstanteria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: { nombre: string; orden?: number }) =>
      apiRequest<Estanteria>('/estanterias-material', { method: 'POST', body: datos }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE }),
  });
}

export function useActualizarEstanteria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...datos }: { id: string; nombre?: string; activo?: boolean }) =>
      apiRequest<Estanteria>(`/estanterias-material/${id}`, { method: 'PATCH', body: datos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLAVE });
      // El nombre de la estantería se muestra en el listado de materiales.
      qc.invalidateQueries({ queryKey: clavesMateriales.base });
    },
  });
}

export function useEliminarEstanteria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/estanterias-material/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE }),
  });
}
