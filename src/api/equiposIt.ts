import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';
import type {
  ActualizarEquipoInput,
  ActualizarTipoEquipoInput,
  AsignacionEquipo,
  AsignarEquipoInput,
  CrearEquipoInput,
  EquipoIt,
  EstadoEquipoIt,
  FilaImportacion,
  ResultadoImportacion,
  ResumenEquipos,
  CrearTipoEquipoInput,
  TipoEquipo,
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
  tipoId?: string;
  estado?: EstadoEquipoIt | '';
}

export function useEquipos(pagina = 1, limite = 20, filtros: FiltrosEquipos = {}) {
  const normalizados = {
    buscar: filtros.buscar ?? '',
    tipoId: filtros.tipoId ?? '',
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
          tipoId: normalizados.tipoId || undefined,
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

// ─────────────── Catálogo de tipos de equipo ───────────────

export const clavesTipos = ['tipos-equipo'] as const;

/** Catálogo de tipos. `soloActivos` para el formulario de alta. */
export function useTiposEquipo(soloActivos = false) {
  return useQuery({
    queryKey: [...clavesTipos, soloActivos],
    queryFn: () =>
      apiRequest<TipoEquipo[]>('/tipos-equipo', {
        query: soloActivos ? { soloActivos: 'true' } : undefined,
      }),
    staleTime: 60_000,
  });
}

export function useCrearTipoEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearTipoEquipoInput) =>
      apiRequest<TipoEquipo>('/tipos-equipo', { method: 'POST', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clavesTipos });
      // El nombre del tipo se muestra en el listado de equipos.
      qc.invalidateQueries({ queryKey: clavesEquipos.base });
    },
  });
}

export function useActualizarTipoEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...datos }: { id: string } & ActualizarTipoEquipoInput) =>
      apiRequest<TipoEquipo>(`/tipos-equipo/${id}`, { method: 'PATCH', body: datos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clavesTipos });
      qc.invalidateQueries({ queryKey: clavesEquipos.base });
    },
  });
}

export function useEliminarTipoEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/tipos-equipo/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesTipos }),
  });
}
