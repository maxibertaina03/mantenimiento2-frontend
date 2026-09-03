import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';
import type {
  ActualizarEquipoInput,
  CrearEquipoInput,
  DeteccionImportacion,
  Equipo,
  CrearPlanInput,
  HistorialEquipo,
  PlanMantenimiento,
  PlanQueVence,
  FiltrosEquipos,
  RegistrarIntervencionInput,
  ResultadoImportacionEquipos,
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

/**
 * Le pregunta al servidor qué equipos saldrían de una carpeta, sin crear nada.
 *
 * Solo viajan los NOMBRES de los archivos, no los archivos. La regla de qué es
 * un equipo vive en el dominio del backend, así existe una sola copia: si la
 * pantalla la repitiera, en algún momento las dos versiones diferirían y
 * mostraría algo distinto de lo que después importa.
 */
export function useDetectarImportacion() {
  return useMutation({
    mutationFn: (datos: { rutas: string[]; carpetasExcluidas?: string[] }) =>
      apiRequest<DeteccionImportacion>('/equipos/detectar-importacion', {
        method: 'POST',
        body: datos,
      }),
  });
}

export function useImportarEquiposPlanta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: { filas: { nombre: string; ubicacion: string }[] }) =>
      apiRequest<ResultadoImportacionEquipos>('/equipos/importar', {
        method: 'POST',
        body: datos,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clavesEquipos.base });
      // La importación crea ubicaciones nuevas.
      qc.invalidateQueries({ queryKey: ['ubicaciones-equipo'] });
    },
  });
}

/** Si el servidor tiene almacén de fotos configurado. */
export function useAlmacenDisponible() {
  return useQuery({
    queryKey: ['equipos', 'almacen'],
    queryFn: () => apiRequest<{ disponible: boolean }>('/equipos/almacen/estado'),
    staleTime: 5 * 60_000,
  });
}

export function useCambiarFotoEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      imagenBase64,
      nombreArchivo,
    }: {
      id: string;
      imagenBase64: string;
      nombreArchivo: string;
    }) =>
      apiRequest<Equipo>(`/equipos/${id}/foto`, {
        method: 'POST',
        body: { imagenBase64, nombreArchivo },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesEquipos.base }),
  });
}

export function useHistorialEquipo(equipoId: string) {
  return useQuery({
    queryKey: ['equipos', 'historial', equipoId],
    queryFn: () => apiRequest<HistorialEquipo>(`/equipos/${equipoId}/historial`),
    enabled: equipoId !== '',
  });
}

export function useRegistrarIntervencion(equipoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: RegistrarIntervencionInput) =>
      apiRequest(`/equipos/${equipoId}/intervenciones`, { method: 'POST', body: datos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipos', 'historial', equipoId] });
      // El resumen de la ficha cambia con cada intervención.
      qc.invalidateQueries({ queryKey: clavesEquipos.base });
    },
  });
}

export function usePlanesDeEquipo(equipoId: string) {
  return useQuery({
    queryKey: ['equipos', 'planes', equipoId],
    queryFn: () => apiRequest<PlanMantenimiento[]>(`/equipos/${equipoId}/planes`),
    enabled: equipoId !== '',
  });
}

/** Lo que vence, de lo más urgente a lo menos. Es la pantalla del día a día. */
/**
 * Los servicios que vencen.
 *
 * `habilitado` existe porque el endpoint es solo para admins: pedirlo desde una
 * pantalla que ve todo el mundo le daría 403 a los operarios, y el error
 * aparecería en la consola de cada uno sin que nada esté mal.
 */
export function usePlanesQueVencen(dias = 7, habilitado = true) {
  return useQuery({
    queryKey: ['equipos', 'planes', 'vencen', dias],
    queryFn: () => apiRequest<PlanQueVence[]>('/equipos/planes/vencen', { query: { dias } }),
    enabled: habilitado,
  });
}

/** Invalida todo lo que un cambio de plan puede haber movido. */
function invalidarPlanes(qc: ReturnType<typeof useQueryClient>, equipoId: string) {
  qc.invalidateQueries({ queryKey: ['equipos', 'planes', equipoId] });
  qc.invalidateQueries({ queryKey: ['equipos', 'planes', 'vencen'] });
}

export function useCrearPlan(equipoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: CrearPlanInput) =>
      apiRequest<PlanMantenimiento>(`/equipos/${equipoId}/planes`, { method: 'POST', body: datos }),
    onSuccess: () => invalidarPlanes(qc, equipoId),
  });
}

export function useActualizarPlan(equipoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, ...datos }: { planId: string } & Partial<CrearPlanInput> & { activo?: boolean }) =>
      apiRequest<PlanMantenimiento>(`/equipos/planes/${planId}`, { method: 'PATCH', body: datos }),
    onSuccess: () => invalidarPlanes(qc, equipoId),
  });
}

export function useEliminarPlan(equipoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      apiRequest<void>(`/equipos/planes/${planId}`, { method: 'DELETE' }),
    onSuccess: () => invalidarPlanes(qc, equipoId),
  });
}
