import { describe, expect, it } from 'vitest';
import { paresSospechosos } from './ResponsablesEquipo';
import type { Responsable } from '@/api/responsables';

/**
 * La sugerencia de responsables repetidos.
 *
 * Es la parte con riesgo de todo esto: si sugiere de mas, alguien junta dos
 * personas distintas y un equipo termina asignado a quien no es. Por eso es
 * deliberadamente conservadora, y por eso SUGIERE en vez de decidir.
 */
const r = (id: string, nombre: string, equipos = 0): Responsable => ({
  id,
  nombre,
  sector: null,
  notas: null,
  activo: true,
  equipos,
  asignaciones: equipos,
});

const nombres = (pares: [Responsable, Responsable][]) =>
  pares.map(([a, b]) => `${a.nombre} + ${b.nombre}`).sort();

describe('paresSospechosos', () => {
  it('encuentra el nombre corto dentro del largo', () => {
    // Son los casos reales del inventario.
    expect(nombres(paresSospechosos([r('1', 'Julieta Redolfi'), r('2', 'Julieta')]))).toEqual([
      'Julieta Redolfi + Julieta',
    ]);
    expect(nombres(paresSospechosos([r('1', 'Monica'), r('2', 'Monica Carassai')]))).toEqual([
      'Monica Carassai + Monica',
    ]);
  });

  it('ignora acentos y mayusculas', () => {
    expect(paresSospechosos([r('1', 'MÓNICA CARASSAI'), r('2', 'monica')])).toHaveLength(1);
  });

  it('REGRESION: NO junta a dos personas distintas con apellido compartido', () => {
    // Este es el caso que hace peligrosa cualquier regla automatica: en el
    // inventario real conviven los dos, y son dos personas.
    expect(
      paresSospechosos([r('1', 'Jose ignacio Carassai'), r('2', 'José Luis Carassai')]),
    ).toHaveLength(0);
  });

  it('REGRESION: no junta nombres que solo comparten el principio de una palabra', () => {
    // "Romi Ubino" y "Romina Ubino" probablemente sean la misma, pero probar
    // eso abre la puerta a juntar "Jose" con "Josefina". Se prefiere no
    // sugerirlo antes que sugerir algo que rompa datos.
    expect(paresSospechosos([r('1', 'Romi Ubino'), r('2', 'Romina Ubino')])).toHaveLength(0);
    expect(paresSospechosos([r('1', 'Jose'), r('2', 'Josefina')])).toHaveLength(0);
  });

  it('no sugiere nada cuando todos son distintos', () => {
    expect(
      paresSospechosos([r('1', 'Julieta Redolfi'), r('2', 'Luis Rodriguez'), r('3', 'Queco')]),
    ).toHaveLength(0);
  });

  it('el que queda es el de nombre mas completo', () => {
    // Conservar "Julieta Redolfi" y no "Julieta": el nombre completo identifica
    // mejor, y es el que conviene que quede en el sistema.
    const [[queda, seAbsorbe]] = paresSospechosos([r('1', 'Julieta'), r('2', 'Julieta Redolfi')]);
    expect(queda.nombre).toBe('Julieta Redolfi');
    expect(seAbsorbe.nombre).toBe('Julieta');
  });

  it('no se sugiere a si mismo', () => {
    expect(paresSospechosos([r('1', 'Julieta')])).toHaveLength(0);
  });
});
