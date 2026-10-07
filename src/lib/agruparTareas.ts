import type { Tarea } from '@/tipos/tarea';

/**
 * Las tareas de un día, juntas por título, en el orden en que aparecen.
 *
 * Los días cargados son casi siempre la misma tarea en muchas máquinas: ocho
 * «Purga». En el papel van una vez, con un renglón corto por máquina, y entran
 * en la hoja en vez de pasar a otra.
 */
export function agruparPorTitulo(tareas: Tarea[]): { titulo: string; tareas: Tarea[] }[] {
  const grupos = new Map<string, Tarea[]>();
  for (const t of tareas) grupos.set(t.titulo, [...(grupos.get(t.titulo) ?? []), t]);
  return [...grupos].map(([titulo, delGrupo]) => ({ titulo, tareas: delGrupo }));
}
