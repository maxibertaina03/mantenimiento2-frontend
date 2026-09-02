import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';
import type {
  ActualizarEquipoInput,
  CrearEquipoInput,
  Equipo,
  FiltrosEquipos,
} from '@/tipos/equipo';

export const clavesEquipos = {
  base: ['equipos'] as const,
  lista: (pagina: number, limite: number, filtros: FiltrosEquipos) =>
    ['equipos', 'lista', pagina, limite, filtros] as const,
  detalle: (id: string) => ['equipos', 'detalle', id] as const,
};

export function useEquipos(pagina = 1, limite = 20, filtros: FiltrosEquipos = {}) {
  return useQuery({
    queryKey: clavesEquipos.lista(pagina, limite, filtros),
    queryFn: () =>
      apiRequest<RespuestaPaginada<Equipo>>('/equipos', {
        query: {
          pagina,
          limite,
          buscar: filtros.buscar || undefined,
          ubicacionId: filtros.ubicacionId || undefined,
          tipoId: filtros.tipoId || undefined,
          estado: filtros.estado || undefined,
          criticidad: filtros.criticidad || undefined,
          garantiaVencida: filtros.garantiaVencida ? 'true' : undefined,
          ordenarPor: filtros.ordenarPor || undefined,
          direccion: filtros.direccion || undefined,
        },
      }),
  });
}

export function useEquipo(id: string) {
  return useQuery({
    queryKey: clavesEquipos.detalle(id),
    queryFn: () => apiRequest<Equipo>(`/equipos/${id}`),
    enabled: id !== '',
  });
}

export function useCrearEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: CrearEquipoInput) =>
      apiRequest<Equipo>('/equipos', { method: 'POST', body: datos }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesEquipos.base }),
  });
}

export function useActualizarEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...datos }: { id: string } & ActualizarEquipoInput) =>
      apiRequest<Equipo>(`/equipos/${id}`, { method: 'PATCH', body: datos }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesEquipos.base }),
  });
}

export function useEliminarEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/equipos/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesEquipos.base }),
  });
}
