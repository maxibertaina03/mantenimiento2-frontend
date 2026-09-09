import { describe, expect, it } from 'vitest';
import { claveDeNombre, emparejarFotos, sectorDelArchivo } from './emparejarFotos';
import type { Equipo } from '@/tipos/equipo';

/**
 * El cruce entre los archivos de la carpeta y los equipos cargados.
 *
 * Es lo unico de la carga masiva que puede salir mal en silencio: una foto
 * asignada al equipo equivocado no se descubre hasta que alguien la mira abajo,
 * en la planta.
 */
const equipo = (nombre: string, sector: string | null, over: Partial<Equipo> = {}): Equipo =>
  ({
    id: `${sector}-${nombre}`,
    nombre,
    ubicacionNombre: sector,
    fotoUrl: null,
    ...over,
  }) as Equipo;

/** Un archivo con su ruta dentro de la carpeta elegida. */
const archivo = (ruta: string): File => {
  const f = new File(['x'], ruta.split('/').pop()!, { type: 'image/jpeg' });
  Object.defineProperty(f, 'webkitRelativePath', { value: ruta });
  return f;
};

describe('claveDeNombre', () => {
  it('ignora extension, mayusculas, acentos y espacios de mas', () => {
    expect(claveDeNombre('  Válvula   DE Descarga .JPG')).toBe('valvula de descarga');
  });

  it('un nombre con punto en el medio no pierde el pedazo', () => {
    // "BU.DA.VI.jpg" tiene que quedar "bu.da.vi", no "bu".
    expect(claveDeNombre('BU.DA.VI.jpg')).toBe('bu.da.vi');
  });
});

describe('sectorDelArchivo', () => {
  it('el sector es la carpeta que contiene al archivo', () => {
    expect(sectorDelArchivo('FOTOS LLT/Caldera/Compresor 1.jpg')).toBe('Caldera');
  });

  it('un archivo suelto en la raiz no tiene sector', () => {
    expect(sectorDelArchivo('FOTOS LLT/suelta.jpg')).toBeNull();
  });
});

describe('emparejarFotos', () => {
  it('empareja por nombre dentro del sector', () => {
    const equipos = [equipo('Compresor 1', 'Caldera')];
    const r = emparejarFotos([archivo('FOTOS/Caldera/Compresor 1.jpg')], equipos);

    expect(r.emparejadas).toHaveLength(1);
    expect(r.emparejadas[0].equipo.nombre).toBe('Compresor 1');
    expect(r.sinEquipo).toHaveLength(0);
  });

  it('REGRESION: con el mismo nombre en dos sectores, elige el del sector correcto', () => {
    // Elegir cualquiera le pone la foto al equipo equivocado, y eso no se
    // descubre hasta que alguien lo mira abajo.
    const equipos = [equipo('Tablero 1', 'Caldera'), equipo('Tablero 1', 'Tinas')];
    const r = emparejarFotos([archivo('FOTOS/Tinas/Tablero 1.jpg')], equipos);

    expect(r.emparejadas).toHaveLength(1);
    expect(r.emparejadas[0].equipo.ubicacionNombre).toBe('Tinas');
  });

  it('REGRESION: nombre repetido y sector que no coincide, no adivina', () => {
    // Antes que ponerle la foto a uno de los dos al azar.
    const equipos = [equipo('Tablero 1', 'Caldera'), equipo('Tablero 1', 'Tinas')];
    const r = emparejarFotos([archivo('FOTOS/Envase/Tablero 1.jpg')], equipos);

    expect(r.emparejadas).toHaveLength(0);
    expect(r.sinEquipo[0].nombre).toBe('Tablero 1.jpg');
  });

  it('si el nombre es unico, el sector que no coincide no lo frena', () => {
    // La maquina se movio de sector despues de sacar la foto: el nombre unico
    // alcanza para saber cual es.
    const equipos = [equipo('Drenoprensa 2', 'Ricotta')];
    const r = emparejarFotos([archivo('FOTOS/Drenoprensa/Drenoprensa 2.jpg')], equipos);

    expect(r.emparejadas).toHaveLength(1);
  });

  it('REGRESION: saltea las carpetas Taller y manuales', () => {
    // No son sectores de la planta: son fotos de herramientas y de PDFs.
    const equipos = [equipo('Amoladora', 'Caldera')];
    const r = emparejarFotos(
      [archivo('FOTOS/Taller/Amoladora.jpg'), archivo('FOTOS/manuales/Amoladora.jpg')],
      equipos,
    );

    expect(r.emparejadas).toHaveLength(0);
    expect(r.sinEquipo).toHaveLength(0);
  });

  it('los archivos que no son imagenes se ignoran', () => {
    const r = emparejarFotos([archivo('FOTOS/Caldera/lista.pdf')], [equipo('lista', 'Caldera')]);
    expect(r.emparejadas).toHaveLength(0);
    expect(r.sinEquipo).toHaveLength(0);
  });

  it('marca las que ya tenian foto, para poder saltearlas', () => {
    const equipos = [equipo('Compresor 1', 'Caldera', { fotoUrl: 'https://x/foto.jpg' })];
    const r = emparejarFotos([archivo('FOTOS/Caldera/Compresor 1.jpg')], equipos);

    expect(r.emparejadas[0].yaTeniaFoto).toBe(true);
  });

  it('REGRESION: dos archivos para el mismo equipo, se usa uno solo', () => {
    // La segunda pisaria a la primera sin avisar.
    const equipos = [equipo('Compresor 1', 'Caldera')];
    const r = emparejarFotos(
      [archivo('FOTOS/Caldera/Compresor 1.jpg'), archivo('FOTOS/Caldera/compresor 1.JPG')],
      equipos,
    );

    expect(r.emparejadas).toHaveLength(1);
  });

  it('lista los archivos que no son de ningun equipo', () => {
    // Las fotos con nombre automatico del celular caen todas acá.
    const r = emparejarFotos([archivo('FOTOS/Caldera/IMG-20251212-WA0031.jpg')], []);
    expect(r.sinEquipo[0].nombre).toBe('IMG-20251212-WA0031.jpg');
    expect(r.sinEquipo[0].sector).toBe('Caldera');
  });

  it('lista los equipos sin foto para los que no aparecio archivo', () => {
    // Es lo que dice cuanto falta sacar con la camara.
    const equipos = [equipo('Compresor 1', 'Caldera'), equipo('Bomba 9', 'Caldera')];
    const r = emparejarFotos([archivo('FOTOS/Caldera/Compresor 1.jpg')], equipos);

    expect(r.equiposSinArchivo.map((e) => e.nombre)).toEqual(['Bomba 9']);
  });

  it('un equipo que ya tiene foto no cuenta como faltante', () => {
    const equipos = [equipo('Bomba 9', 'Caldera', { fotoUrl: 'https://x/f.jpg' })];
    expect(emparejarFotos([], equipos).equiposSinArchivo).toHaveLength(0);
  });
});
