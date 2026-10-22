import type { Tarea } from '@/tipos/tarea';

/**
 * Qué se lee primero de una tarea.
 *
 * Si es sobre un equipo, el equipo: en el calendario se repiten mucho los
 * mismos trabajos («Purga», «Purga», «Purga»…) y lo que distingue una de otra
 * es la máquina. Arriba «Compresor 1», abajo «Purga». Si no es sobre un
 * equipo, el título y nada más.
 */
export function encabezadoTarea(t: Pick<Tarea, 'titulo' | 'equipoNombre' | 'equipoItNombre'>): {
  principal: string;
  secundario: string | null;
} {
  const equipo = t.equipoNombre ?? t.equipoItNombre;
  return equipo
    ? { principal: equipo, secundario: t.titulo }
    : { principal: t.titulo, secundario: null };
}

/**
 * Lo que se repite todos los días va aparte, para no tapar lo importante.
 *
 * Se mira la frecuencia y no si viene de una rutina: en la planta, las tareas
 * diarias («Purga», todos los días, en cada compresor) son planes de
 * mantenimiento de «cada 1 día», no rutinas.
 */
export function esDeTodosLosDias(t: Pick<Tarea, 'cadaDias'>): boolean {
  return t.cadaDias === 1;
}
