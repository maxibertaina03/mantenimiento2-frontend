/**
 * Formatea una fecha ISO a «16/10/2026 10:26», en hora local y 24 horas.
 *
 * Antes salía «16/10/2026, 10:26 a. m.»: más largo, y en las tablas se partía
 * en dos renglones.
 */
export function formatearFecha(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
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
