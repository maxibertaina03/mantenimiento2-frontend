import type { EstadoOrdenCompra } from '@/tipos/ordenCompra';

/** Lo que comparten la página de órdenes de compra y sus modales. */
export const CLASE_ESTADO: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'badge',
  EMITIDA: 'badge badge-aviso',
  RECIBIDA: 'badge badge-ok',
  ANULADA: 'badge badge-error',
};

export function moneda(valor: number | null): string {
  if (valor === null) return '—';
  return `$ ${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
