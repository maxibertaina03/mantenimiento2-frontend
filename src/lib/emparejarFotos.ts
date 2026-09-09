import type { Equipo } from '@/tipos/equipo';

/**
 * Empareja los archivos de la carpeta de fotos con los equipos ya cargados.
 *
 * Es puro y sin React a propósito: la regla de cuándo dos nombres son el mismo
 * equipo es lo único que puede salir mal acá, y así se prueba sin navegador ni
 * carpeta de verdad.
 *
 * Los 326 equipos salieron de esta misma carpeta, así que los nombres coinciden
 * casi siempre. Casi: hay archivos con nombre automático del celular
 * («IMG-20251212-WA0031») que nunca fueron un equipo, y equipos cargados a mano
 * después de la importación que no tienen foto.
 */

/** Deja el nombre listo para comparar: sin extensión, acentos ni mayúsculas. */
export function claveDeNombre(texto: string): string {
  return texto
    .replace(/\.[^.]+$/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** El sector sale de la carpeta que contiene al archivo. */
export function sectorDelArchivo(rutaRelativa: string): string | null {
  const partes = rutaRelativa.split('/').filter((p) => p !== '');
  // La primera parte es la carpeta raíz que eligió la persona; la segunda, el
  // sector. Un archivo suelto en la raíz no tiene sector.
  return partes.length >= 3 ? partes[1] : null;
}

export interface FotoEmparejada {
  archivo: File;
  equipo: Equipo;
  /** El sector de la carpeta, para mostrarlo en la lista. */
  sector: string | null;
  /** El equipo ya tenía una foto cargada. */
  yaTeniaFoto: boolean;
}

export interface ResultadoEmparejado {
  emparejadas: FotoEmparejada[];
  /** Archivos que no corresponden a ningún equipo. */
  sinEquipo: { nombre: string; sector: string | null }[];
  /** Equipos sin foto para los que no apareció ningún archivo. */
  equiposSinArchivo: Equipo[];
}

/** Carpetas que no son sectores de la planta. */
export const CARPETAS_EXCLUIDAS = ['taller', 'manuales'];

const ES_IMAGEN = /\.(jpe?g|png|webp)$/i;

/**
 * Cruza archivos con equipos.
 *
 * El nombre solo no alcanza: hay «Tablero 1» en más de un sector. Se empareja
 * por nombre **dentro del sector**, y solo se cae al nombre suelto cuando ese
 * nombre es único en todo el padrón.
 */
export function emparejarFotos(
  archivos: File[],
  equipos: Equipo[],
  carpetasExcluidas: string[] = CARPETAS_EXCLUIDAS,
): ResultadoEmparejado {
  const excluidas = new Set(carpetasExcluidas.map((c) => claveDeNombre(c)));

  // Índice por sector + nombre, y otro por nombre suelto para el segundo intento.
  const porSectorYNombre = new Map<string, Equipo>();
  const porNombre = new Map<string, Equipo[]>();
  for (const e of equipos) {
    const nombre = claveDeNombre(e.nombre);
    if (e.ubicacionNombre) {
      porSectorYNombre.set(`${claveDeNombre(e.ubicacionNombre)}|${nombre}`, e);
    }
    porNombre.set(nombre, [...(porNombre.get(nombre) ?? []), e]);
  }

  const emparejadas: FotoEmparejada[] = [];
  const sinEquipo: { nombre: string; sector: string | null }[] = [];
  const usados = new Set<string>();

  for (const archivo of archivos) {
    const ruta = (archivo as File & { webkitRelativePath?: string }).webkitRelativePath ?? archivo.name;
    if (!ES_IMAGEN.test(archivo.name)) continue;

    const sector = sectorDelArchivo(ruta);
    if (sector && excluidas.has(claveDeNombre(sector))) continue;

    const nombre = claveDeNombre(archivo.name);
    let equipo = sector ? porSectorYNombre.get(`${claveDeNombre(sector)}|${nombre}`) : undefined;

    if (!equipo) {
      const candidatos = porNombre.get(nombre) ?? [];
      // Solo si el nombre es único en todo el padrón: con dos «Tablero 1» en
      // sectores distintos, elegir uno al azar le pone la foto al equipo
      // equivocado, y eso no se descubre hasta que alguien lo mira abajo.
      if (candidatos.length === 1) equipo = candidatos[0];
    }

    if (!equipo) {
      sinEquipo.push({ nombre: archivo.name, sector });
      continue;
    }
    // Un equipo se lleva una sola foto: si hay dos archivos que apuntan al
    // mismo, la segunda pisaría a la primera sin avisar.
    if (usados.has(equipo.id)) continue;
    usados.add(equipo.id);

    emparejadas.push({ archivo, equipo, sector, yaTeniaFoto: Boolean(equipo.fotoUrl) });
  }

  return {
    emparejadas,
    sinEquipo,
    equiposSinArchivo: equipos.filter((e) => !e.fotoUrl && !usados.has(e.id)),
  };
}
