import { describe, expect, it } from 'vitest';
import { hoyLocal, vencio } from './diaDeTarea';

describe('el día de una tarea', () => {
  // Las 22 hs del 2/10 en la computadora: en UTC ya es el 3/10.
  const nocheDel2 = new Date(2026, 9, 2, 22, 0);

  it('hoy es el día de la computadora, no el de UTC', () => {
    expect(hoyLocal(nocheDel2)).toBe('2026-10-02');
  });

  it('REGRESION: una tarea de hoy no cuenta como vencida', () => {
    // Antes se comparaba la medianoche UTC contra la medianoche local, y en
    // Argentina la de hoy quedaba tres horas antes: «vencida».
    expect(vencio('2026-10-02T00:00:00.000Z', new Date(2026, 9, 2, 9, 0))).toBe(false);
    expect(vencio('2026-10-02T00:00:00.000Z', nocheDel2)).toBe(false);
  });

  it('la de ayer sí venció; la de mañana no', () => {
    expect(vencio('2026-10-01T00:00:00.000Z', nocheDel2)).toBe(true);
    expect(vencio('2026-10-03T00:00:00.000Z', nocheDel2)).toBe(false);
  });
});
