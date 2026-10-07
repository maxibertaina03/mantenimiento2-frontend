import { describe, expect, it } from 'vitest';
import {
  aIso,
  diasDelMes,
  semanaInicial,
  semanasDe,
  textoDia,
  textoSemana,
} from './fechasCalendario';

const fecha = (iso: string) => new Date(`${iso}T12:00:00`);

describe('las fechas del calendario', () => {
  it('octubre 2026 son 5 semanas enteras, del lunes 28/9 al domingo 1/11', () => {
    const semanas = semanasDe(diasDelMes(fecha('2026-10-15')));

    expect(semanas).toHaveLength(5);
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    expect(aIso(semanas[0][0])).toBe('2026-09-28');
    expect(aIso(semanas[4][6])).toBe('2026-11-01');
  });

  it('la semana inicial es la de hoy; si hoy no está en el mes, la primera', () => {
    const semanas = semanasDe(diasDelMes(fecha('2026-10-15')));

    expect(semanaInicial(semanas, fecha('2026-10-14'))).toBe(2);
    expect(semanaInicial(semanas, fecha('2027-03-01'))).toBe(0);
  });

  it('dice la semana como se dice, también cuando cruza de mes', () => {
    const semanas = semanasDe(diasDelMes(fecha('2026-10-15')));

    expect(textoSemana(semanas[2])).toBe('del 12 al 18 de octubre');
    expect(textoSemana(semanas[0])).toBe('del 28 de septiembre al 4 de octubre');
  });

  it('el día, con su nombre', () => {
    expect(textoDia(fecha('2026-10-12'))).toBe('Lunes 12 de octubre');
    expect(textoDia(fecha('2026-10-18'))).toBe('Domingo 18 de octubre');
  });
});
