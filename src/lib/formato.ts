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
