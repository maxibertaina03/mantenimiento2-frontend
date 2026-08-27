/** Formatea una fecha ISO a dd/mm/aaaa hh:mm (es-AR). */
export function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatea una fecha SIN hora (dd/mm/aaaa) leyendo los componentes en UTC.
 *
 * Los campos "solo fecha" (entrega estimada, compra, garantía) se guardan como
 * medianoche UTC. Leerlos en hora local (UTC-3) los corre un día para atrás:
 * 2026-09-01T00:00Z se mostraba como 31/08/2026.
 */
export function formatearFechaSola(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Formatea un número con separador de miles (es-AR). */
export function formatearNumero(n: number): string {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 3 });
}

/** Convierte una fecha ISO al formato que espera un input datetime-local (hora local). */
export function isoADatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
