import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import { clavesMateriales } from './materiales';
import type {
  DetalleToma,
  RenglonToma,
  ResultadoConfirmacion,
  TomaInventario,
} from '@/tipos/inventario';

export const clavesInventario = {
  base: ['inventario'] as const,
  lista: ['inventario', 'lista'] as const,
  detalle: (id: string) => ['inventario', 'detalle', id] as const,
};

export function useTomas() {
  return useQuery({
    queryKey: clavesInventario.lista,
    queryFn: () => apiRequest<TomaInventario[]>('/tomas-inventario'),
  });
}

export function useToma(id: string) {
  return useQuery({
    queryKey: clavesInventario.detalle(id),
    queryFn: () => apiRequest<DetalleToma>(`/tomas-inventario/${id}`),
    enabled: Boolean(id),
  });
}

export function useAbrirToma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: { categoriaId?: string; estanteriaId?: string; notas?: string }) =>
      apiRequest<TomaInventario>('/tomas-inventario', { method: 'POST', body: datos }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesInventario.base }),
  });
}

/**
 * Guarda lo contado de un material. Actualiza ese renglón en la caché sin
 * volver a pedir la toma entera: se cuenta uno tras otro, y recargar
 * cientos de renglones en cada uno sería lento en el celular.
 */
export function useContar(tomaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ renglonId, contado }: { renglonId: string; contado: number | null }) =>
      apiRequest<RenglonToma>(`/tomas-inventario/${tomaId}/renglones/${renglonId}`, {
        method: 'PATCH',
        body: { contado },
      }),
    onSuccess: (renglon) => {
      qc.setQueryData<DetalleToma>(clavesInventario.detalle(tomaId), (actual) => {
        if (!actual) return actual;
        const renglones = actual.renglones.map((r) => (r.id === renglon.id ? renglon : r));
        const contados = renglones.filter((r) => r.contado !== null).length;
        const conDiferencia = renglones.filter(
          (r) =>
            r.contado !== null &&
            r.stockAlContar !== null &&
            r.resultado !== 'AJUSTADO' &&
            r.resultado !== 'SIN_DIFERENCIA' &&
            Math.round(r.contado * 1000) !== Math.round(r.stockAlContar * 1000),
        ).length;
        return {
          ...actual,
          renglones,
          toma: { ...actual.toma, contados },
          resumen: {
            ...actual.resumen,
            contados,
            sinContar: renglones.length - contados,
            conDiferencia,
          },
        };
      });
    },
  });
}

/** Confirmar ajusta stock: se refresca también el pañol. */
export function useConfirmarToma(tomaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<ResultadoConfirmacion>(`/tomas-inventario/${tomaId}/confirmar`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesInventario.base });
      void qc.invalidateQueries({ queryKey: clavesMateriales.base });
      void qc.invalidateQueries({ queryKey: ['movimientos'] });
    },
  });
}

/** Dar por terminada la toma: lo que no se contó queda como estaba. */
export function useCerrarToma(tomaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<TomaInventario>(`/tomas-inventario/${tomaId}/cerrar`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesInventario.base }),
  });
}

export function useAnularToma(tomaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (motivo: string) =>
      apiRequest<TomaInventario>(`/tomas-inventario/${tomaId}/anular`, {
        method: 'POST',
        body: { motivo },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesInventario.base }),
  });
}
