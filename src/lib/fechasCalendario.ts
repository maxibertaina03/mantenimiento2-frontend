/**
 * Las fechas del calendario: las comparten la pantalla y la hoja impresa.
 */

export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS_LARGOS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];
export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** El día en ISO, sin hora y sin que el huso lo corra un día. */
export function aIso(fecha: Date): string {
  return new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()))
    .toISOString()
    .slice(0, 10);
}

/** Lunes = 0 … domingo = 6: acá la semana arranca el lunes. */
export const indiceEnLaSemana = (fecha: Date) => (fecha.getDay() + 6) % 7;

/**
 * Los días que se dibujan en la grilla de un mes.
 *
 * Siempre semanas completas de lunes a domingo, aunque el mes empiece un
 * jueves: una grilla con huecos al principio se lee mal y se imprime peor.
 */
export function diasDelMes(ancla: Date): Date[] {
  const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
  const inicio = new Date(primero);
  inicio.setDate(primero.getDate() - indiceEnLaSemana(primero));

  const dias: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    dias.push(d);
  }
  // Se recortan las semanas enteras que ya quedaron fuera del mes.
  while (dias.length > 35 && dias[35].getMonth() !== ancla.getMonth()) dias.length = 35;
  return dias;
}

/** Los días de la grilla, de a siete: cada semana, de lunes a domingo. */
export function semanasDe(dias: Date[]): Date[][] {
  const semanas: Date[][] = [];
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));
  return semanas;
}

/** La semana que tiene hoy; si hoy no está en el mes que se ve, la primera. */
export function semanaInicial(semanas: Date[][], hoy: Date): number {
  const iso = aIso(hoy);
  const i = semanas.findIndex((s) => s.some((d) => aIso(d) === iso));
  return i >= 0 ? i : 0;
}

/** «del 12 al 18 de octubre», o «del 28 de septiembre al 4 de octubre». */
export function textoSemana(semana: Date[]): string {
  const primero = semana[0];
  const ultimo = semana[semana.length - 1];
  if (primero.getMonth() === ultimo.getMonth()) {
    return `del ${primero.getDate()} al ${ultimo.getDate()} de ${MESES[ultimo.getMonth()]}`;
  }
  return (
    `del ${primero.getDate()} de ${MESES[primero.getMonth()]} ` +
    `al ${ultimo.getDate()} de ${MESES[ultimo.getMonth()]}`
  );
}

/** «Lunes 12 de octubre». */
export function textoDia(fecha: Date): string {
  return `${DIAS_LARGOS[indiceEnLaSemana(fecha)]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}
