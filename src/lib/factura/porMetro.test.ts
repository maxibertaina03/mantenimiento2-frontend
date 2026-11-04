import { describe, expect, it } from 'vitest';
import { factorAutomatico, metrosPorUnidad, porUnidad } from './porMetro';

describe('metrosPorUnidad', () => {
  it('lee los metros del nombre, sin confundirlos con milímetros', () => {
    expect(metrosPorUnidad('Barras caño ø50.8 x 1,5 mm x 6 mts')).toBe(6);
    expect(metrosPorUnidad('Manguera 3/4 rollo 50 metros')).toBe(50);
    expect(metrosPorUnidad('Perfil C 80 x 6 m')).toBe(6);
    expect(metrosPorUnidad('Válvula mariposa mecanizada ø51 mm')).toBeNull();
    expect(metrosPorUnidad('Rulemán 6204')).toBeNull();
  });
});

describe('factorAutomatico', () => {
  const cano = 'Barras caño ø50.8 x 1,5 mm x 6 mts';

  it('4 barras facturadas como 24 m: el precio se multiplica por 6', () => {
    expect(factorAutomatico(cano, 4, 24)).toBe(6);
  });

  it('si la cuenta no cierra, no adivina', () => {
    expect(factorAutomatico(cano, 7, 18)).toBe(1);
    expect(factorAutomatico(cano, 4, 4)).toBe(1);
    expect(factorAutomatico(cano, 4, null)).toBe(1);
    expect(factorAutomatico('Rulemán 6204', 4, 24)).toBe(1);
  });

  it('el precio por barra, en centavos', () => {
    expect(porUnidad(24805, 6)).toBe(148830);
    expect(porUnidad(1234.567, 1)).toBe(1234.57);
  });
});
