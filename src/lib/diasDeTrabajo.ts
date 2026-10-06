/**
 * Los días de la semana como los guarda el sistema: 0 domingo … 6 sábado.
 * Se muestran empezando por el lunes, como se piensa la semana en la planta.
 */
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0] as const;
export const LUNES_A_VIERNES: readonly number[] = [1, 2, 3, 4, 5];
export const TODOS_LOS_DIAS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

const CORTO: Record<number, string> = {
  1: 'lun',
  2: 'mar',
  3: 'mié',
  4: 'jue',
  5: 'vie',
  6: 'sáb',
  0: 'dom',
};

/** «De lunes a viernes», «Todos los días», «lun, mié, vie». */
export function describirDias(dias: readonly number[] | null | undefined): string {
  const lista = dias ?? LUNES_A_VIERNES;
  const tiene = (d: number) => lista.includes(d);
  if (TODOS_LOS_DIAS.every(tiene)) return 'Todos los días';
  if (lista.length === 5 && LUNES_A_VIERNES.every(tiene)) return 'De lunes a viernes';
  if (lista.length === 6 && [1, 2, 3, 4, 5, 6].every(tiene)) return 'De lunes a sábado';
  return ORDEN_SEMANA.filter(tiene)
    .map((d) => CORTO[d])
    .join(', ');
}
