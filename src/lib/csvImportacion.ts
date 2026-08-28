/**
 * Lectura de un CSV exportado desde Notion/Excel.
 *
 * Se implementa a mano en vez de sumar una dependencia porque el caso es
 * acotado, pero contempla lo que realmente rompe un parser ingenuo:
 * comillas, comas dentro de un campo entrecomillado, comillas escapadas ("")
 * y saltos de línea dentro de una celda.
 */

/** Parte el contenido en filas de celdas, respetando los campos entrecomillados. */
export function parsearCsv(contenido: string): string[][] {
  // El BOM que agrega Excel se colaría dentro del primer encabezado y haría
  // que "Nombre del Equipo" no coincida con nada.
  const texto = contenido.charCodeAt(0) === 0xfeff ? contenido.slice(1) : contenido;

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (entreComillas) {
      if (c === '"') {
        // Dos comillas seguidas dentro de un campo son una comilla literal.
        if (texto[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        celda += c;
      }
      continue;
    }

    if (c === '"') {
      entreComillas = true;
    } else if (c === ',' || c === ';') {
      fila.push(celda);
      celda = '';
    } else if (c === '\n') {
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else if (c !== '\r') {
      celda += c;
    }
  }

  // La última celda no termina con separador ni salto de línea.
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }

  // Descarta las filas totalmente vacías (Excel suele dejar una al final).
  return filas.filter((f) => f.some((c) => c.trim() !== ''));
}

/** Fila del inventario, ya mapeada a los campos que espera la API. */
export interface FilaInventario {
  nombreEquipo?: string;
  tipo?: string;
  modelo?: string;
  estado?: string;
  ubicacion?: string;
  asignadoA?: string;
  accesoRemotoId?: string;
}

/**
 * Encabezados que se reconocen para cada campo. Se comparan normalizados, así
 * que da igual el acento, la mayúscula o el espacio de más.
 *
 * Las contraseñas NO están: aunque la planilla las traiga, no se importan.
 */
const ENCABEZADOS: Record<keyof FilaInventario, string[]> = {
  nombreEquipo: ['nombre del equipo', 'nombre', 'equipo', 'codigo', 'codigo interno'],
  tipo: ['tipo de equipo', 'tipo'],
  modelo: ['modelo', 'marca y modelo', 'marca'],
  estado: ['estado'],
  ubicacion: ['ubicacion', 'lugar'],
  asignadoA: ['usuario asignado', 'usuario', 'asignado a', 'responsable'],
  accesoRemotoId: ['any desk', 'anydesk', 'id anydesk', 'acceso remoto'],
};

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export interface ResultadoLectura {
  filas: FilaInventario[];
  /** Encabezados del archivo que no se usan (incluye los de contraseñas). */
  columnasIgnoradas: string[];
  /** Campos que no se encontraron en el archivo. */
  columnasFaltantes: string[];
}

/**
 * Interpreta el CSV: encuentra a qué campo corresponde cada columna por su
 * encabezado, así el orden de las columnas no importa.
 */
export function leerInventario(contenido: string): ResultadoLectura {
  const filas = parsearCsv(contenido);
  if (filas.length < 2) {
    return { filas: [], columnasIgnoradas: [], columnasFaltantes: [] };
  }

  const encabezado = filas[0].map(normalizar);

  // Índice de cada campo dentro de la fila.
  const indices = {} as Record<keyof FilaInventario, number>;
  const usados = new Set<number>();

  for (const [campo, alias] of Object.entries(ENCABEZADOS) as [
    keyof FilaInventario,
    string[],
  ][]) {
    const i = encabezado.findIndex((h) => alias.includes(h));
    indices[campo] = i;
    if (i >= 0) usados.add(i);
  }

  const columnasIgnoradas = filas[0]
    .map((h, i) => (usados.has(i) || h.trim() === '' ? null : h.trim()))
    .filter((h): h is string => h !== null);

  const columnasFaltantes = (Object.keys(indices) as (keyof FilaInventario)[])
    .filter((campo) => indices[campo] < 0)
    .map((campo) => ENCABEZADOS[campo][0]);

  const datos = filas.slice(1).map((celdas) => {
    const fila: FilaInventario = {};
    for (const campo of Object.keys(indices) as (keyof FilaInventario)[]) {
      const i = indices[campo];
      const valor = i >= 0 ? (celdas[i] ?? '').trim() : '';
      if (valor) fila[campo] = valor;
    }
    return fila;
  });

  // Filas sin ningún dato reconocible no aportan nada.
  return {
    filas: datos.filter((f) => Object.keys(f).length > 0),
    columnasIgnoradas,
    columnasFaltantes,
  };
}
