import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';
import type {
  ActualizarEquipoInput,
  AsignacionEquipo,
  AsignarEquipoInput,
  CrearEquipoInput,
  EquipoIt,
  EstadoEquipoIt,
  FilaImportacion,
  ResultadoImportacion,
  ResumenEquipos,
  TipoEquipoIt,
} from '@/tipos/equipoIt';

export const clavesEquipos = {
  base: ['equipos-it'] as const,
  lista: (pagina: number, limite: number, filtros: Record<string, string>) =>
    ['equipos-it', 'lista', pagina, limite, filtros] as const,
  detalle: (id: string) => ['equipos-it', 'detalle', id] as const,
  asignaciones: (id: string) => ['equipos-it', 'asignaciones', id] as const,
  resumen: ['equipos-it', 'resumen'] as const,
};

interface FiltrosEquipos {
  buscar?: string;
  tipo?: TipoEquipoIt | '';
  estado?: EstadoEquipoIt | '';
}

export function useEquipos(pagina = 1, limite = 20, filtros: FiltrosEquipos = {}) {
  const normalizados = {
    buscar: filtros.buscar ?? '',
    tipo: filtros.tipo ?? '',
    estado: filtros.estado ?? '',
  };
  return useQuery({
    queryKey: clavesEquipos.lista(pagina, limite, normalizados),
    queryFn: () =>
      apiRequest<RespuestaPaginada<EquipoIt>>('/equipos-it', {
        query: {
          pagina,
          limite,
          buscar: normalizados.buscar || undefined,
          tipo: normalizados.tipo || undefined,
          estado: normalizados.estado || undefined,
        },
      }),
  });
}

export function useEquipo(id: string) {
  return useQuery({
    queryKey: clavesEquipos.detalle(id),
    queryFn: () => apiRequest<EquipoIt>(`/equipos-it/${id}`),
    enabled: !!id,
  });
}

export function useAsignacionesEquipo(id: string) {
  return useQuery({
    queryKey: clavesEquipos.asignaciones(id),
    queryFn: () => apiRequest<AsignacionEquipo[]>(`/equipos-it/${id}/asignaciones`),
    enabled: !!id,
  });
}

/** Ubicaciones ya usadas, para sugerirlas en el formulario. */
export function useUbicaciones() {
  return useQuery({
    queryKey: ['equipos-it', 'ubicaciones'],
    queryFn: () => apiRequest<string[]>('/equipos-it/ubicaciones'),
    staleTime: 60_000,
  });
}

export function useResumenEquipos() {
  return useQuery({
    queryKey: clavesEquipos.resumen,
    queryFn: () => apiRequest<ResumenEquipos>('/equipos-it/resumen'),
  });
}

export function useCrearEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearEquipoInput) =>
      apiRequest<EquipoIt>('/equipos-it', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesEquipos.base }),
  });
}

export function useActualizarEquipo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActualizarEquipoInput) =>
      apiRequest<EquipoIt>(`/equipos-it/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesEquipos.base }),
  });
}

export function useAsignarEquipo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AsignarEquipoInput) =>
      apiRequest<EquipoIt>(`/equipos-it/${id}/asignar`, { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesEquipos.base }),
  });
}

export function useEliminarEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/equipos-it/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesEquipos.base }),
  });
}

/** Importación masiva del inventario desde una planilla. */
export function useImportarEquipos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { filas: FilaImportacion[] }) =>
      apiRequest<ResultadoImportacion>('/equipos-it/importar', { method: 'POST', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clavesEquipos.base });
      // La importación puede dar de alta personas nuevas.
      qc.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}
