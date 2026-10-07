import type { EstadoOrdenTrabajo } from '@/tipos/ordenTrabajo';

/** Lo que comparten la página de órdenes de trabajo y sus modales. */
export const CLASE_ESTADO: Record<EstadoOrdenTrabajo, string> = {
  ABIERTA: 'badge badge-aviso',
  CERRADA: 'badge badge-ok',
  ANULADA: 'badge badge-error',
};
