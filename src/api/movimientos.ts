import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';
import { clavesMateriales } from './materiales';
import type {
  CrearMovimientoInput,
  FiltrosMovimientos,
  Movimiento,
} from '@/tipos/movimiento';

const claves = {
  base: ['movimientos'] as const,
  lista: (filtros: FiltrosMovimientos) => ['movimientos', 'lista', filtros] as const,
};

export function useMovimientos(filtros: FiltrosMovimientos = {}) {
  return useQuery({
    queryKey: claves.lista(filtros),
    queryFn: () =>
      apiRequest<RespuestaPaginada<Movimiento>>('/movimientos', {
        query: {
          materialId: filtros.materialId,
          tipo: filtros.tipo,
          motivo: filtros.motivo,
          fechaDesde: filtros.fechaDesde,
          fechaHasta: filtros.fechaHasta,
          pagina: filtros.pagina,
          limite: filtros.limite,
        },
      }),
  });
}

export function useCrearMovimiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearMovimientoInput) =>
      apiRequest<Movimiento>('/movimientos', { method: 'POST', body: input }),
    onSuccess: () => {
      // El movimiento cambia el stock: refrescamos materiales y movimientos.
      qc.invalidateQueries({ queryKey: claves.base });
      qc.invalidateQueries({ queryKey: clavesMateriales.base });
    },
  });
}
