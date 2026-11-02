import { afterEach, describe, expect, it } from 'vitest';
import {
  armarTabla,
  guardarElegidas,
  leerElegidas,
  posicionDe,
  type ColumnaReporte,
} from './columnasReporte';

interface Fila {
  nombre: string;
  stock: number;
  notas: string;
}

const COLUMNAS: ColumnaReporte<Fila>[] = [
  { clave: 'nombre', titulo: 'Material', valor: (f) => f.nombre },
  { clave: 'stock', titulo: 'Stock', valor: (f) => f.stock },
  { clave: 'notas', titulo: 'Notas', valor: (f) => f.notas, porDefecto: false },
];

const FILAS: Fila[] = [
  { nombre: 'Rulemán', stock: 4, notas: 'caja azul' },
  { nombre: 'Correa', stock: 1, notas: '' },
];

afterEach(() => localStorage.clear());

describe('armarTabla', () => {
  it('lleva solo las columnas elegidas, en el orden del reporte', () => {
    const t = armarTabla(COLUMNAS, FILAS, ['notas', 'nombre']);
    expect(t.encabezados).toEqual(['Material', 'Notas']);
    expect(t.filas).toEqual([
      ['Rulemán', 'caja azul'],
      ['Correa', ''],
    ]);
    expect(t.claves).toEqual(['nombre', 'notas']);
  });

  it('dice dónde quedó una columna, o nada si no se eligió', () => {
    const { claves } = armarTabla(COLUMNAS, FILAS, ['stock', 'notas']);
    expect(posicionDe(claves, 'notas')).toBe(1);
    expect(posicionDe(claves, 'nombre')).toBeUndefined();
  });
});

describe('leerElegidas', () => {
  it('sin nada guardado, son las de siempre', () => {
    expect(leerElegidas('prueba', COLUMNAS)).toEqual(['nombre', 'stock']);
  });

  it('recuerda lo que se eligió la última vez', () => {
    guardarElegidas('prueba', ['notas']);
    expect(leerElegidas('prueba', COLUMNAS)).toEqual(['notas']);
  });

  it('ignora columnas que ya no existen, y si no queda ninguna vuelve a las de siempre', () => {
    guardarElegidas('prueba', ['vieja', 'stock']);
    expect(leerElegidas('prueba', COLUMNAS)).toEqual(['stock']);
    guardarElegidas('prueba', ['vieja']);
    expect(leerElegidas('prueba', COLUMNAS)).toEqual(['nombre', 'stock']);
  });

  it('si lo guardado está roto, las de siempre', () => {
    localStorage.setItem('columnas-reporte:prueba', '{no es json');
    expect(leerElegidas('prueba', COLUMNAS)).toEqual(['nombre', 'stock']);
  });
});
