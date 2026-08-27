import { describe, expect, it } from 'vitest';
import { formatearFecha, formatearNumero, isoADatetimeLocal } from './formato';
import { generarCsv, sufijoFechaArchivo } from './csv';

describe('formatearNumero', () => {
  it('usa separador de miles es-AR', () => {
    expect(formatearNumero(1234567)).toBe('1.234.567');
  });

  it('conserva hasta 3 decimales (la escala de la DB)', () => {
    expect(formatearNumero(12.345)).toBe('12,345');
  });

  it('no muestra decimales de más', () => {
    expect(formatearNumero(10)).toBe('10');
  });

  it('maneja el 0', () => {
    expect(formatearNumero(0)).toBe('0');
  });

  it('maneja negativos (stock corregido)', () => {
    expect(formatearNumero(-5.5)).toBe('-5,5');
  });
});

describe('formatearFecha', () => {
  it('devuelve dd/mm/aaaa y la hora', () => {
    // es-AR con hour/minute '2-digit' rinde en 12h ("12:30 p. m.").
    // Si se quisiera 24h habria que pasar hour12: false.
    const salida = formatearFecha('2026-08-25T15:30:00.000Z');
    expect(salida).toMatch(/^\d{2}\/\d{2}\/\d{4},? \d{1,2}:\d{2}/);
  });

  it('la parte de fecha es estable sin importar el formato horario', () => {
    expect(formatearFecha('2026-08-25T15:30:00.000Z').slice(0, 10)).toBe('25/08/2026');
  });

  it('incluye el año completo', () => {
    expect(formatearFecha('2026-01-05T10:00:00.000Z')).toContain('2026');
  });
});

describe('isoADatetimeLocal', () => {
  it('devuelve el formato que espera un input datetime-local', () => {
    expect(isoADatetimeLocal('2026-08-25T15:30:00.000Z')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    );
  });

  it('rellena con ceros los meses y días de un dígito', () => {
    const salida = isoADatetimeLocal('2026-01-05T09:05:00.000Z');
    const [fecha] = salida.split('T');
    expect(fecha).toHaveLength(10);
  });

  it('hace round-trip con el valor de un input datetime-local', () => {
    const original = new Date(2026, 7, 25, 15, 30);
    const salida = isoADatetimeLocal(original.toISOString());
    expect(new Date(salida).getHours()).toBe(15);
    expect(new Date(salida).getMinutes()).toBe(30);
  });
});

describe('generarCsv', () => {
  it('arma encabezados y filas separados por ;', () => {
    const csv = generarCsv(['Nombre', 'Stock'], [['Cable', 100]]);
    expect(csv).toBe('Nombre;Stock\r\nCable;100');
  });

  it('entrecomilla y escapa los valores que traen ; o comillas', () => {
    const csv = generarCsv(['A'], [['dice "hola"; y chau']]);
    expect(csv).toContain('"dice ""hola""; y chau"');
  });

  it('entrecomilla los valores con salto de línea', () => {
    const csv = generarCsv(['Notas'], [['linea1\nlinea2']]);
    expect(csv).toContain('"linea1\nlinea2"');
  });

  it('convierte null y undefined en celda vacía', () => {
    expect(generarCsv(['A', 'B'], [[null, undefined]])).toBe('A;B\r\n;');
  });

  it('separa las filas con CRLF (compatibilidad Excel)', () => {
    const csv = generarCsv(['A'], [['1'], ['2']]);
    expect(csv.split('\r\n')).toEqual(['A', '1', '2']);
  });

  it('soporta un CSV sin filas', () => {
    expect(generarCsv(['A', 'B'], [])).toBe('A;B');
  });
});

describe('sufijoFechaArchivo', () => {
  it('devuelve aaaa-mm-dd', () => {
    expect(sufijoFechaArchivo()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
