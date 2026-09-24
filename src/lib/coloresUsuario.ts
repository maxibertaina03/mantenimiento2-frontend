/**
 * Un color por persona, para reconocer de un vistazo de quién es cada tarea.
 *
 * En un calendario cargado, leer el nombre en cada tarjeta es lento: lo que se
 * quiere saber parado frente a la hoja es "cuáles son mías", y eso se ve por
 * color mucho antes que leyendo.
 *
 * ## Las dos cosas que tiene que cumplir, y por qué hacen falta las dos
 *
 * - **Estable**: el color de alguien no puede cambiar de un mes a otro. Si
 *   cambia, la gente que ya se fio del color se confunde, y eso es peor que no
 *   haber puesto colores.
 * - **Sin repeticiones**: si dos personas comparten color, el color deja de
 *   responder "de quién es".
 *
 * Repartir por posición en una lista da lo segundo pero no lo primero, porque
 * si la lista cambia se corren todos los colores. Un hash del id da lo primero
 * pero no lo segundo: con ocho colores y cinco personas, lo más probable es
 * que dos caigan en el mismo (y así pasó: tres quedaron en rosas parecidos).
 *
 * Por eso hay dos caminos. Cuando se conoce el padrón de usuarios —que cambia
 * cuando entra alguien, no cada mes— se reparte por posición y no se repite
 * ninguno. Cuando no se lo puede consultar, se cae al hash: puede repetir, pero
 * nunca cambia.
 *
 * En los dos casos **el color no es lo único que distingue**: el nombre sigue
 * escrito en cada tarjeta.
 */

/**
 * Colores para las personas.
 *
 * Separados en el tono a propósito: dos rosas distintos no sirven de nada en
 * una hoja impresa, que es donde esto se usa. Cada uno tiene que poder
 * nombrarse con una palabra distinta.
 */
export const COLORES_PERSONA = [
  '#2563eb', // azul
  '#ea580c', // naranja
  '#db2777', // rosa
  '#7c3aed', // violeta
  '#0891b2', // cian
  '#a16207', // oro
  '#475569', // pizarra
  '#15803d', // verde
] as const;

/** Lo que se usa cuando la tarea no tiene dueño. */
export const COLOR_SIN_ASIGNAR = '#9a3412';

/**
 * Un número estable a partir del id.
 *
 * FNV-1a: corto, sin dependencias y reparte bien los uuid, que comparten casi
 * todos los caracteres. Sumar los códigos sin más agrupaba a mucha gente en el
 * mismo color.
 */
function numeroDe(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * El color de alguien cuando no se conoce el padrón.
 *
 * Siempre el mismo para el mismo id. Puede repetirse con otra persona; el
 * nombre en la tarjeta es lo que desempata.
 */
export function colorDePersona(usuarioId: string): string {
  return COLORES_PERSONA[numeroDe(usuarioId) % COLORES_PERSONA.length];
}

/**
 * Reparte los colores entre el padrón, sin repetir.
 *
 * Se ordena por id antes de repartir para que el color de alguien no dependa
 * del orden en que el servidor haya devuelto la lista.
 */
export function coloresPorPersona(gente: { id: string }[]): Map<string, string> {
  const colores = new Map<string, string>();
  [...gente]
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((persona, i) => {
      colores.set(persona.id, COLORES_PERSONA[i % COLORES_PERSONA.length]);
    });
  return colores;
}

/**
 * El color de una tarea según quién la tenga.
 *
 * `colores` es el reparto del padrón, cuando se lo pudo consultar. Un id que no
 * esté ahí —alguien dado de baja con tareas viejas— cae al hash en vez de
 * quedarse sin color.
 *
 * `null` es "sin repartir", y se devuelve marcado para que la pantalla pueda
 * dibujarla distinto: impresa en blanco y negro el color se pierde, y estas son
 * justo las que hay que poder ver.
 */
export function colorDeTarea(
  asignadoAId: string | null,
  colores?: Map<string, string>,
): { color: string; sinAsignar: boolean } {
  if (!asignadoAId) return { color: COLOR_SIN_ASIGNAR, sinAsignar: true };
  return { color: colores?.get(asignadoAId) ?? colorDePersona(asignadoAId), sinAsignar: false };
}
