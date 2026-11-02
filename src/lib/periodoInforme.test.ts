import { describe, expect, it } from 'vitest';
import { etiquetaTramo, periodoDeAtajo, textoPeriodo } from './periodoInforme';

// Jueves 15 de octubre de 2026, a la tarde.
const HOY = new Date(2026, 9, 15, 17, 0);

describe('periodoDeAtajo', () => {
  it('esta semana va del lunes a hoy, día por día', () => {
    expect(periodoDeAtajo('semana', HOY)).toEqual({
      desde: '2026-10-12',
      hasta: '2026-10-15',
      agrupar: 'dia',
    });
  });

  it('el mes pasado es el mes entero, por semana', () => {
    expect(periodoDeAtajo('mesPasado', HOY)).toEqual({
      desde: '2026-09-01',
      hasta: '2026-09-30',
      agrupar: 'semana',
    });
  });

  it('el año, por mes y hasta hoy', () => {
    expect(periodoDeAtajo('anio', HOY)).toEqual({
      desde: '2026-01-01',
      hasta: '2026-10-15',
      agrupar: 'mes',
    });
  });

  it('en enero, el mes pasado es diciembre del año anterior', () => {
    expect(periodoDeAtajo('mesPasado', new Date(2027, 0, 10))).toMatchObject({
      desde: '2026-12-01',
      hasta: '2026-12-31',
    });
  });
});

describe('cómo se leen las fechas', () => {
  it('los tramos del eje', () => {
    expect(etiquetaTramo('2026-10-05', 'dia')).toBe('5/10');
    expect(etiquetaTramo('2026-10-05', 'semana')).toBe('sem 5/10');
    expect(etiquetaTramo('2026-10-01', 'mes')).toBe('oct 26');
  });

  it('el período del encabezado', () => {
    expect(textoPeriodo({ desde: '2026-10-01', hasta: '2026-10-31', agrupar: 'dia' })).toBe(
      'del 01/10/2026 al 31/10/2026',
    );
  });
});
