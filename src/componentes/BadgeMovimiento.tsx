import type { TipoMovimiento } from '@/tipos/movimiento';

const clasePorTipo: Record<TipoMovimiento, string> = {
  ENTRADA: 'badge badge-entrada',
  SALIDA: 'badge badge-salida',
  AJUSTE: 'badge badge-ajuste',
};

/** Badge de color según el tipo de movimiento. */
export function BadgeMovimiento({ tipo }: { tipo: TipoMovimiento }) {
  return <span className={clasePorTipo[tipo]}>{tipo}</span>;
}
