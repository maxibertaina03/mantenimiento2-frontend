/**
 * Las fechas de las tareas son días, no momentos: se guardan como la
 * medianoche UTC de ese día. Compararlas contra un `Date` local las corre: en
 * Argentina la medianoche UTC del 2/10 son las 21 hs del 1/10, y una tarea de
 * hoy contaba como vencida. Acá se compara día contra día.
 */

/** El día de hoy en la computadora de quien mira, como AAAA-MM-DD. */
export function hoyLocal(ahora: Date = new Date()): string {
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${m}-${d}`;
}

/** Si una tarea con esa fecha ya pasó: es de un día anterior a hoy. */
export function vencio(fechaIso: string, ahora: Date = new Date()): boolean {
  return fechaIso.slice(0, 10) < hoyLocal(ahora);
}
