import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';
import type {
  ActualizarEquipoInput,
  CrearEquipoInput,
  DeteccionImportacion,
  Equipo,
  FiltrosEquipos,
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
