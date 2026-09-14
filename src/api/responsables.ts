import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';

/**
 * Quién tiene a cargo cada equipo de informática.
 *
 * No son usuarios del sistema. Antes sí lo eran, y por eso quedaron 31 usuarios
 * con un correo inventado y un rol que nunca usaron. Varios ni siquiera son
 * personas: "Operarios de expedición", "Queco y German".
 */
export interface Responsable {
  id: string;
  nombre: string;
  sector: string | null;
  notas: string | null;
  activo: boolean;
  /** Cuántos equipos tiene AHORA. Si es > 0 no se puede borrar. */
  equipos: number;
  /** Cuántas veces figura en el historial, incluso por equipos que devolvió. */
  asignaciones: number;
}

export const clavesResponsables = {
  base: ['responsables'] as const,
  lista: (soloActivos: boolean) => ['responsables', soloActivos] as const,
};

export function useResponsables(soloActivos = false) {
  return useQuery({
    queryKey: clavesResponsables.lista(soloActivos),
    queryFn: () =>
      apiRequest<Responsable[]>('/responsables', {
        query: { soloActivos: soloActivos ? 'true' : undefined },
      }),
    staleTime: 60_000,
  });
}

export function useCrearResponsable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: { nombre: string; sector?: string; notas?: string }) =>
      apiRequest<Responsable>('/responsables', { method: 'POST', body: datos }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesResponsables.base }),
  });
}

export function useActualizarResponsable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...datos }: { id: string } & Record<string, unknown>) =>
      apiRequest<Responsable>(`/responsables/${id}`, { method: 'PATCH', body: datos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clavesResponsables.base });
      // El nombre del responsable se muestra en el listado de equipos.
      qc.invalidateQueries({ queryKey: ['equipos-it'] });
    },
  });
}

/**
 * Junta dos fichas que son la misma persona.
 *
 * Existe porque la carga original dejó a varios dos veces con nombres
 * distintos: "Julieta" y "Julieta Redolfi", "Romi Ubino" y "Romina Ubino".
 * Ninguna regla automática puede distinguirlos de dos personas de verdad
 * distintas, como "Jose ignacio Carassai" y "José Luis Carassai". Quien lo sabe
 * es quien usa el sistema.
 */
export function useUnificarResponsables() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ queda, seAbsorbe }: { queda: string; seAbsorbe: string }) =>
      apiRequest<Responsable>(`/responsables/${queda}/unificar/${seAbsorbe}`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clavesResponsables.base });
      qc.invalidateQueries({ queryKey: ['equipos-it'] });
    },
  });
}

export function useEliminarResponsable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/responsables/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesResponsables.base }),
  });
}
