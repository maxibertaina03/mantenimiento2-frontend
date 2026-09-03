import { describe, expect, it } from 'vitest';
import { textoVencimiento } from './PlanesEquipo';

/**
 * Cómo se le cuenta a una persona cuánto falta para un service.
 *
 * "Faltan -3 días" es lo que sale si nadie se ocupa de los negativos, y es
 * justo el caso que más importa: el service vencido.
 */
describe('textoVencimiento', () => {
  it('REGRESION: lo vencido se dice en positivo, no con dias negativos', () => {
    expect(textoVencimiento(-3)).toBe('Vencido hace 3 días');
    expect(textoVencimiento(-1)).toBe('Vencido hace 1 día');
  });

  it('el dia exacto dice "hoy"', () => {
    expect(textoVencimiento(0)).toBe('Vence hoy');
  });

  it('el dia siguiente dice "mañana"', () => {
    expect(textoVencimiento(1)).toBe('Vence mañana');
  });

  it('mas adelante cuenta los dias', () => {
    expect(textoVencimiento(7)).toBe('Faltan 7 días');
  });

  it('el singular y el plural de "día" quedan bien', () => {
    expect(textoVencimiento(-1)).toContain('1 día');
    expect(textoVencimiento(-2)).toContain('2 días');
  });
});
