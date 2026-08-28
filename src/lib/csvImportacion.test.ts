import { describe, expect, it } from 'vitest';
import { leerInventario, parsearCsv } from './csvImportacion';

describe('parsearCsv', () => {
  it('parte filas y celdas', () => {
    expect(parsearCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('acepta punto y coma como separador (Excel en es-AR)', () => {
    expect(parsearCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('REGRESION: una coma dentro de comillas no parte la celda', () => {
    expect(parsearCsv('nombre,ubicacion\nPC1,"Oficina 1, planta alta"')).toEqual([
      ['nombre', 'ubicacion'],
      ['PC1', 'Oficina 1, planta alta'],
    ]);
  });

  it('las comillas escapadas quedan como una sola', () => {
    expect(parsearCsv('a\n"dice ""hola"""')).toEqual([['a'], ['dice "hola"']]);
  });

  it('soporta saltos de línea dentro de una celda', () => {
    expect(parsearCsv('a,b\n"linea1\nlinea2",x')).toEqual([
      ['a', 'b'],
      ['linea1\nlinea2', 'x'],
    ]);
  });

  it('saca el BOM que agrega Excel', () => {
    expect(parsearCsv('﻿nombre,tipo\nPC1,PC')[0][0]).toBe('nombre');
  });

  it('ignora las filas vacías del final', () => {
    expect(parsearCsv('a,b\n1,2\n\n')).toHaveLength(2);
  });

  it('soporta finales de línea de Windows', () => {
    expect(parsearCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

/** Encabezado tal cual lo exporta Notion. */
const ENCABEZADO_NOTION =
  'Nombre del Equipo,Tipo de Equipo,Modelo,Estado,Ubicación,Usuario Asignado,Any desk,Contraseñas Any desk,Contraseñas Grabadoras';

describe('leerInventario', () => {
  it('mapea las columnas de la planilla de Notion', () => {
    const csv = `${ENCABEZADO_NOTION}\nPC1,PC Escritorio,INTEL,En uso,Contaduria,Luis Rodriguez,737 214 468,eeuu122*,`;
    const { filas } = leerInventario(csv);

    expect(filas).toHaveLength(1);
    expect(filas[0]).toEqual({
      nombreEquipo: 'PC1',
      tipo: 'PC Escritorio',
      modelo: 'INTEL',
      estado: 'En uso',
      ubicacion: 'Contaduria',
      asignadoA: 'Luis Rodriguez',
      accesoRemotoId: '737 214 468',
    });
  });

  it('REGRESION: las contraseñas NO se leen del archivo', () => {
    const csv = `${ENCABEZADO_NOTION}\nPC1,PC Escritorio,INTEL,En uso,Contaduria,Luis,737 214 468,eeuu122*,Lacteos315`;
    const { filas, columnasIgnoradas } = leerInventario(csv);

    // Ni siquiera llegan al objeto que se manda al backend.
    expect(JSON.stringify(filas)).not.toContain('eeuu122');
    expect(JSON.stringify(filas)).not.toContain('Lacteos315');
    // Y se informa que esas columnas se dejaron afuera.
    expect(columnasIgnoradas).toContain('Contraseñas Any desk');
    expect(columnasIgnoradas).toContain('Contraseñas Grabadoras');
  });

  it('el orden de las columnas no importa', () => {
    const csv = 'Estado,Nombre del Equipo,Tipo de Equipo\nEn uso,PC9,Notebook';
    const { filas } = leerInventario(csv);
    expect(filas[0]).toEqual({ nombreEquipo: 'PC9', tipo: 'Notebook', estado: 'En uso' });
  });

  it('reconoce los encabezados sin acentos ni mayúsculas', () => {
    const csv = 'NOMBRE DEL EQUIPO,tipo de equipo,ubicacion\nPC1,PC,Taller';
    const { filas } = leerInventario(csv);
    expect(filas[0].nombreEquipo).toBe('PC1');
    expect(filas[0].ubicacion).toBe('Taller');
  });

  it('informa qué campos no encontró', () => {
    const csv = 'Nombre del Equipo,Tipo de Equipo\nPC1,PC';
    const { columnasFaltantes } = leerInventario(csv);
    expect(columnasFaltantes).toContain('estado');
    expect(columnasFaltantes).toContain('ubicacion');
  });

  it('las celdas vacías no generan campos vacíos', () => {
    const csv = 'Nombre del Equipo,Tipo de Equipo,Ubicación\nPC1,PC,';
    const { filas } = leerInventario(csv);
    expect(filas[0]).not.toHaveProperty('ubicacion');
  });

  it('descarta filas sin ningún dato', () => {
    const csv = 'Nombre del Equipo,Tipo de Equipo\nPC1,PC\n,';
    expect(leerInventario(csv).filas).toHaveLength(1);
  });

  it('un archivo sin filas de datos devuelve vacío sin romper', () => {
    expect(leerInventario('Nombre del Equipo,Tipo\n').filas).toEqual([]);
    expect(leerInventario('').filas).toEqual([]);
  });

  it('lee varias filas del inventario real', () => {
    const csv = [
      ENCABEZADO_NOTION,
      'PC1,PC Escritorio,INTEL,En uso,Contaduria,Luis Rodriguez,737 214 468,eeuu122*,',
      'GRABADORA 1,Cámara de Seguridad,DS-7616NI-E2 / 16P,En uso,Entretecho,Maximo Bertaina,,,Lacteos315',
      'TELEFONO 1,Teléfonos,Galaxy A03 Core,Activo,Taller,Jose Ignacio Carrillo,,,',
    ].join('\n');

    const { filas } = leerInventario(csv);
    expect(filas).toHaveLength(3);
    expect(filas[1].modelo).toBe('DS-7616NI-E2 / 16P');
    expect(filas[2].tipo).toBe('Teléfonos');
  });
});
