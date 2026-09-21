import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import { clavesMateriales } from './materiales';
import type { RespuestaPaginada } from '@/tipos/comunes';
import type {
  UsuarioAsignable,
  CrearOrdenTrabajoInput,
  FiltrosOrdenesTrabajo,
  OrdenTrabajo,
  OrdenTrabajoConResumen,
} from '@/tipos/ordenTrabajo';

export const clavesTrabajos = {
  base: ['ordenes-trabajo'] as const,
  lista: (pagina: number, limite: number, filtros: FiltrosOrdenesTrabajo) =>
    ['ordenes-trabajo', 'lista', pagina, limite, filtros] as const,
  detalle: (id: string) => ['ordenes-trabajo', 'detalle', id] as const,
};

/**
 * Cargar o quitar un material mueve el stock de verdad, así que después de cada
 * una hay que invalidar también los materiales y su historial. Si no, el pañol
 * se sigue mostrando como estaba y alguien compra algo que ya tiene.
 */
function invalidarTodo(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: clavesTrabajos.base });
  void qc.invalidateQueries({ queryKey: clavesMateriales.base });
}

/**
 * `habilitado` existe porque un hook no se puede llamar condicionalmente: sin
 * esto, una pantalla que no tiene permiso para ver trabajos igual saldría a
 * pedirlos y se comería un 403 que se muestra como un error rojo.
 */
export function useOrdenesTrabajo(
  pagina = 1,
  limite = 20,
  filtros: FiltrosOrdenesTrabajo = {},
  habilitado = true,
) {
  return useQuery({
    enabled: habilitado,
    queryKey: clavesTrabajos.lista(pagina, limite, filtros),
    queryFn: () =>
      apiRequest<RespuestaPaginada<OrdenTrabajo>>('/ordenes-trabajo', {
        query: {
          pagina,
          limite,
          buscar: filtros.buscar || undefined,
          estado: filtros.estado || undefined,
          tipo: filtros.tipo || undefined,
          equipoId: filtros.equipoId || undefined,
          asignadoAId: filtros.asignadoAId || undefined,
        },
      }),
  });
}

/**
 * Quiénes pueden hacerse cargo de una orden.
 *
 * Sale del módulo de trabajos y no del padón de usuarios porque mantenimiento
 * no tiene permiso para listar usuarios, y sin embargo tiene que poder elegir a
 * quién le pasa un trabajo.
 */
export function useAsignables(habilitado = true) {
  return useQuery({
    enabled: habilitado,
    queryKey: ['ordenes-trabajo', 'asignables'],
    queryFn: () => apiRequest<UsuarioAsignable[]>('/ordenes-trabajo/asignables'),
    staleTime: 5 * 60_000,
  });
}

export function useReasignarOrdenTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, asignadoAId }: { id: string; asignadoAId: string }) =>
      apiRequest<OrdenTrabajo>(`/ordenes-trabajo/${id}/reasignar`, {
        method: 'POST',
        body: { asignadoAId },
      }),
    onSuccess: () => invalidarTodo(qc),
  });
}

export function useOrdenTrabajo(id: string) {
  return useQuery({
    queryKey: clavesTrabajos.detalle(id),
    queryFn: () => apiRequest<OrdenTrabajoConResumen>(`/ordenes-trabajo/${id}`),
    enabled: !!id,
  });
}

export function useCrearOrdenTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearOrdenTrabajoInput) =>
      apiRequest<OrdenTrabajo>('/ordenes-trabajo', { method: 'POST', body: input }),
    onSuccess: () => invalidarTodo(qc),
  });
}

export function useEditarOrdenTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...cambios }: { id: string } & Partial<CrearOrdenTrabajoInput>) =>
      apiRequest<OrdenTrabajo>(`/ordenes-trabajo/${id}`, { method: 'PATCH', body: cambios }),
    onSuccess: () => invalidarTodo(qc),
  });
}

export function useUsarMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      ordenId,
      ...datos
    }: {
      ordenId: string;
      materialId: string;
      cantidad: number;
      notas?: string | null;
    }) =>
      apiRequest(`/ordenes-trabajo/${ordenId}/materiales`, { method: 'POST', body: datos }),
    onSuccess: () => invalidarTodo(qc),
  });
}

export function useQuitarMaterialUsado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (materialUsadoId: string) =>
      apiRequest(`/ordenes-trabajo/materiales/${materialUsadoId}`, { method: 'DELETE' }),
    onSuccess: () => invalidarTodo(qc),
  });
}

export function useCerrarOrdenTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolucion }: { id: string; resolucion: string }) =>
      apiRequest<OrdenTrabajo>(`/ordenes-trabajo/${id}/cerrar`, {
        method: 'POST',
        body: { resolucion },
      }),
    onSuccess: () => invalidarTodo(qc),
  });
}

export function useReabrirOrdenTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<OrdenTrabajo>(`/ordenes-trabajo/${id}/reabrir`, { method: 'POST' }),
    onSuccess: () => invalidarTodo(qc),
  });
}

/**
 * Borra la orden del sistema. Solo anda sobre una anulada que nunca movió
 * stock; el backend rechaza el resto, que es donde vive esa regla.
 */
export function useEliminarOrdenTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/ordenes-trabajo/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidarTodo(qc),
  });
}

export function useAnularOrdenTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      apiRequest<OrdenTrabajo>(`/ordenes-trabajo/${id}/anular`, {
        method: 'POST',
        body: { motivo },
      }),
    onSuccess: () => invalidarTodo(qc),
  });
}
