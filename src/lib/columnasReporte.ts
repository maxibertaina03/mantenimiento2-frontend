/**
 * Las columnas de un reporte, para que cada uno elija cuáles imprimir.
 *
 * Antes cada reporte armaba sus encabezados y sus filas por separado, en dos
 * listas que tenían que coincidir posición por posición. Acá cada columna
 * lleva su título y cómo sacar su valor, así que sacar una no desarma nada.
 */
export interface ColumnaReporte<T> {
  /** Lo que la identifica, aunque cambie el título. Es lo que se recuerda. */
  clave: string;
  titulo: string;
  valor: (fila: T) => string | number;
  /** Si viene marcada la primera vez. Por defecto, sí. */
  porDefecto?: boolean;
}

/** Las que vienen marcadas cuando nadie eligió nada todavía. */
export function clavesPorDefecto<T>(columnas: ColumnaReporte<T>[]): string[] {
  return columnas.filter((c) => c.porDefecto !== false).map((c) => c.clave);
}

/**
 * Los encabezados y las filas con solo las columnas elegidas, en el orden del
 * reporte (no en el orden en que se tildaron).
 */
export function armarTabla<T>(
  columnas: ColumnaReporte<T>[],
  filas: T[],
  elegidas: string[],
): { encabezados: string[]; filas: (string | number)[][]; claves: string[] } {
  const usadas = columnas.filter((c) => elegidas.includes(c.clave));
  return {
    encabezados: usadas.map((c) => c.titulo),
    filas: filas.map((f) => usadas.map((c) => c.valor(f))),
    claves: usadas.map((c) => c.clave),
  };
}

/** En qué posición quedó una columna, o `undefined` si no se eligió. */
export function posicionDe(claves: string[], clave: string): number | undefined {
  const i = claves.indexOf(clave);
  return i === -1 ? undefined : i;
}

const prefijo = 'columnas-reporte:';

/**
 * Lo que eligió la última vez en este navegador. Si no hay nada guardado, o
 * lo guardado ya no sirve (se renombró una columna), las de siempre.
 *
 * El navegador puede no dejar guardar (ventana privada): entonces se usan las
 * de siempre y listo, no es algo de lo que dependa nada.
 */
export function leerElegidas<T>(reporte: string, columnas: ColumnaReporte<T>[]): string[] {
  try {
    const guardado = localStorage.getItem(prefijo + reporte);
    if (guardado) {
      const claves = (JSON.parse(guardado) as unknown[]).filter(
        (c): c is string => typeof c === 'string' && columnas.some((col) => col.clave === c),
      );
      if (claves.length > 0) return claves;
    }
  } catch {
    // Sin almacenamiento o con algo roto guardado: las de siempre.
  }
  return clavesPorDefecto(columnas);
}

export function guardarElegidas(reporte: string, claves: string[]): void {
  try {
    localStorage.setItem(prefijo + reporte, JSON.stringify(claves));
  } catch {
    // No se pudo recordar: la próxima vez vuelven las de siempre.
  }
}
