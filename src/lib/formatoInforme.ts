/** Colores y formatos de los informes, compartidos por pantallas y gráficos. */

/**
 * Los colores de los gráficos: los mismos de index.css (`--primario`,
 * `--exito`, …), escritos acá porque recharts pinta SVG con atributos y no lee
 * variables de CSS en todos los navegadores. Si cambia la paleta, cambia acá.
 */
export const COLOR = {
  azul: '#2563eb',
  verde: '#15803d',
  rojo: '#b91c1c',
  ambar: '#b45309',
  violeta: '#4338ca',
  gris: '#94a3b8',
} as const;

export type Tono = keyof typeof COLOR;

/** El tono de un porcentaje de cumplimiento: verde, ámbar o rojo. */
export function tonoCumplimiento(p: number | null): Tono {
  if (p === null) return 'gris';
  if (p >= 90) return 'verde';
  if (p >= 70) return 'ambar';
  return 'rojo';
}

/** «12 h» o «3,5 días», según cuánto sea. */
export function textoHoras(horas: number | null): string {
  if (horas === null) return '—';
  if (horas < 48) return `${horas.toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`;
  return `${(horas / 24).toLocaleString('es-AR', { maximumFractionDigits: 1 })} días`;
}

/** «75 %», o una raya si no hay con qué calcularlo. */
export const textoPorcentaje = (p: number | null) => (p === null ? '—' : `${p} %`);

/** «$ 1,2 M»: la plata en el eje, sin que ocupe media pantalla. */
export function montoCorto(v: number): string {
  if (Math.abs(v) >= 1_000_000)
    return `$ ${(v / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  if (Math.abs(v) >= 1_000)
    return `$ ${(v / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })} mil`;
  return `$ ${v.toLocaleString('es-AR')}`;
}

/** «$ 4.327.680»: la plata de una tarjeta, sin centavos para que entre. */
export function montoEntero(v: number): string {
  return `$ ${Math.round(v).toLocaleString('es-AR')}`;
}
