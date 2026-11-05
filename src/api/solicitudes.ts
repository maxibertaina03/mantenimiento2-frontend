import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type {
  FiltrosSolicitudes,
  NuevaSolicitudInput,
  OpcionesSolicitud,
  Solicitud,
} from '@/tipos/solicitud';

export const clavesSolicitudes = {
  base: ['solicitudes'] as const,
  lista: (filtros: FiltrosSolicitudes) => ['solicitudes', 'lista', filtros] as const,
  detalle: (id: string) => ['solicitudes', 'detalle', id] as const,
  opciones: ['solicitudes', 'opciones'] as const,
  contador: ['solicitudes', 'contador'] as const,
};

/** Generar la orden o rechazar cambia la lista, el contador y las órdenes de trabajo. */
function invalidar(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: clavesSolicitudes.base });
  void qc.invalidateQueries({ queryKey: ['ordenes-trabajo'] });
}

export function useSolicitudes(filtros: FiltrosSolicitudes, habilitado = true) {
  return useQuery({
    enabled: habilitado,
    queryKey: clavesSolicitudes.lista(filtros),
    queryFn: () =>
      apiRequest<Solicitud[]>('/solicitudes', {
        query: {
          estado: filtros.estado || undefined,
          sectorId: filtros.sectorId || undefined,
          urgencia: filtros.urgencia || undefined,
        },
      }),
    // Lo que se carga en un sector aparece en mantenimiento sin recargar.
    refetchInterval: 30_000,
  });
}

export function useSolicitud(id: string | null) {
  return useQuery({
    enabled: !!id,
    queryKey: clavesSolicitudes.detalle(id ?? ''),
    queryFn: () => apiRequest<Solicitud>(`/solicitudes/${id}`),
  });
}

export function useOpcionesSolicitud(habilitado = true) {
  return useQuery({
    enabled: habilitado,
    queryKey: clavesSolicitudes.opciones,
    queryFn: () => apiRequest<OpcionesSolicitud>('/solicitudes/opciones'),
    staleTime: 5 * 60_000,
  });
}

/** Cuántas hay sin revisar: el número al lado de «Solicitudes» en el menú. */
export function useContadorSolicitudes(habilitado = true) {
  return useQuery({
    enabled: habilitado,
    queryKey: clavesSolicitudes.contador,
    queryFn: () => apiRequest<{ nuevas: number; urgentes: number }>('/solicitudes/contador'),
    refetchInterval: 30_000,
  });
}

export function useCrearSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NuevaSolicitudInput) =>
      apiRequest<Solicitud>('/solicitudes', { method: 'POST', body: input }),
    onSuccess: () => invalidar(qc),
  });
}

export function useGenerarOrdenDeSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...datos
    }: {
      id: string;
      titulo: string;
      descripcion?: string;
      asignadoAId: string;
    }) =>
      apiRequest<Solicitud>(`/solicitudes/${id}/orden-trabajo`, { method: 'POST', body: datos }),
    onSuccess: () => invalidar(qc),
  });
}

export function useRechazarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, texto }: { id: string; texto: string }) =>
      apiRequest<Solicitud>(`/solicitudes/${id}/rechazar`, { method: 'POST', body: { texto } }),
    onSuccess: () => invalidar(qc),
  });
}

export function useResolverSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, texto }: { id: string; texto: string }) =>
      apiRequest<Solicitud>(`/solicitudes/${id}/resolver`, { method: 'POST', body: { texto } }),
    onSuccess: () => invalidar(qc),
  });
}

/** El enlace firmado de una foto: vence a los cinco minutos, así que se pide al abrirla. */
export function pedirFotoSolicitud(id: string, fotoId: string): Promise<{ url: string }> {
  return apiRequest<{ url: string }>(`/solicitudes/${id}/fotos/${fotoId}`);
}
