import type { Agrupar, PeriodoInforme } from '@/tipos/informe';

/** Los períodos que se ofrecen de un toque. */
export type AtajoPeriodo = 'semana' | 'mes' | 'mesPasado' | 'tresMeses' | 'anio' | 'elegir';

export const ATAJOS: { id: AtajoPeriodo; texto: string }[] = [
  { id: 'semana', texto: 'Esta semana' },
  { id: 'mes', texto: 'Este mes' },
  { id: 'mesPasado', texto: 'El mes pasado' },
  { id: 'tresMeses', texto: 'Últimos 3 meses' },
  { id: 'anio', texto: 'Este año' },
  { id: 'elegir', texto: 'Elegir fechas' },
];

export const AGRUPACIONES: { id: Agrupar; texto: string }[] = [
  { id: 'dia', texto: 'Por día' },
  { id: 'semana', texto: 'Por semana' },
  { id: 'mes', texto: 'Por mes' },
];

/** «2026-10-05», con la fecha de este navegador (no la de UTC). */
export function textoFecha(d: Date): string {
  const dd = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
}

/**
 * El período de un atajo, y de a cuánto conviene agruparlo: una semana día por
 * día, tres meses por semana, un año por mes. Siempre termina hoy (o a fin del
 * mes pasado), nunca en el futuro.
 */
export function periodoDeAtajo(atajo: Exclude<AtajoPeriodo, 'elegir'>, hoy = new Date()) {
  const d = (anio: number, mes: number, dia: number) => new Date(anio, mes, dia);
  const a = hoy.getFullYear();
  const m = hoy.getMonth();
  const desdeLunes = (hoy.getDay() + 6) % 7;
  const rangos: Record<typeof atajo, [Date, Date, Agrupar]> = {
    semana: [d(a, m, hoy.getDate() - desdeLunes), hoy, 'dia'],
    mes: [d(a, m, 1), hoy, 'dia'],
    mesPasado: [d(a, m - 1, 1), d(a, m, 0), 'semana'],
    tresMeses: [d(a, m, hoy.getDate() - 90), hoy, 'semana'],
    anio: [d(a, 0, 1), hoy, 'mes'],
  };
  const [desde, hasta, agrupar] = rangos[atajo];
  return { desde: textoFecha(desde), hasta: textoFecha(hasta), agrupar } satisfies PeriodoInforme;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Cómo se lee un tramo en el eje: «5/10», «sem 5/10» u «oct 26». */
export function etiquetaTramo(tramo: string, agrupar: Agrupar): string {
  const [anio, mes, dia] = tramo.split('-').map(Number);
  if (agrupar === 'mes') return `${MESES[mes - 1]} ${String(anio).slice(2)}`;
  const corto = `${dia}/${mes}`;
  return agrupar === 'semana' ? `sem ${corto}` : corto;
}

/** «del 1/10/2026 al 31/10/2026», para el encabezado del informe impreso. */
export function textoPeriodo({ desde, hasta }: PeriodoInforme): string {
  const f = (t: string) => t.split('-').reverse().join('/');
  return desde === hasta ? `el ${f(desde)}` : `del ${f(desde)} al ${f(hasta)}`;
}
