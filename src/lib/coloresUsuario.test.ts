import { describe, expect, it } from 'vitest';
import {
  colorDePersona,
  colorDeTarea,
  coloresPorPersona,
  COLORES_PERSONA,
  COLOR_SIN_ASIGNAR,
} from './coloresUsuario';

/**
 * El color por persona en el calendario.
 *
 * Lo que tiene que cumplir para servir de algo es UNA cosa: que el color de
 * alguien sea siempre el mismo. Si cambia entre septiembre y octubre, o segun
 * quien mas tenga tareas ese mes, la gente que ya se fio del color se
 * confunde, y eso es peor que no haber puesto colores.
 */
const UUID_A = '25307df7-cee7-4416-9248-8098d9df925b';
const UUID_B = 'b8b97d4d-455a-43bc-91c7-5267d5114a6e';

describe('el color de una persona', () => {
  it('REGRESION: es siempre el mismo para el mismo id', () => {
    // La propiedad que motiva todo el diseño.
    expect(colorDePersona(UUID_A)).toBe(colorDePersona(UUID_A));
  });

  it('REGRESION: no depende de quien mas haya', () => {
    // El primer intento repartia los colores por posicion en una lista, y por
    // eso a alguien le cambiaba el color cuando cambiaba la lista.
    const solo = colorDePersona(UUID_B);
    [UUID_A, 'otro-1', 'otro-2', 'otro-3'].forEach((id) => colorDePersona(id));
    expect(colorDePersona(UUID_B)).toBe(solo);
  });

  it('siempre devuelve uno de la paleta', () => {
    for (const id of [UUID_A, UUID_B, 'x', '', 'a-b-c-d-e']) {
      expect(COLORES_PERSONA).toContain(colorDePersona(id));
    }
  });

  it('personas distintas no caen todas en el mismo color', () => {
    // Con uuid, que comparten casi todos los caracteres, sumar los codigos
    // agrupaba a casi todos en el mismo color. Por eso el hash es FNV-1a.
    const ids = Array.from({ length: 24 }, (_, i) => `${UUID_A.slice(0, 30)}${i}x`);
    const distintos = new Set(ids.map(colorDePersona));
    expect(distintos.size).toBeGreaterThan(4);
  });
});

describe('repartir entre el padron conocido', () => {
  const PADRON = [{ id: UUID_A }, { id: UUID_B }, { id: 'c-tercero' }, { id: 'd-cuarto' }];

  it('REGRESION: dos personas nunca comparten color', () => {
    // Es lo que el hash solo no puede garantizar: con 8 colores y 5 personas,
    // lo mas probable era que dos cayeran en el mismo, y asi paso (tres
    // quedaron en rosas parecidos).
    const usados = [...coloresPorPersona(PADRON).values()];
    expect(new Set(usados).size).toBe(usados.length);
  });

  it('REGRESION: no depende del orden en que vino la lista', () => {
    expect(coloresPorPersona([...PADRON].reverse())).toEqual(coloresPorPersona(PADRON));
  });

  it('con mas gente que colores se vuelve a empezar, nadie queda sin color', () => {
    const muchos = Array.from({ length: COLORES_PERSONA.length + 3 }, (_, i) => ({
      id: `u${String(i).padStart(2, '0')}`,
    }));
    const colores = coloresPorPersona(muchos);
    expect(colores.size).toBe(muchos.length);
    for (const c of colores.values()) expect(COLORES_PERSONA).toContain(c);
  });

  it('una lista vacia no rompe nada', () => {
    expect(coloresPorPersona([]).size).toBe(0);
  });
});

describe('la paleta', () => {
  it('REGRESION: no tiene dos colores repetidos', () => {
    expect(new Set(COLORES_PERSONA).size).toBe(COLORES_PERSONA.length);
  });

  it('el color de sin repartir no es el de nadie', () => {
    expect(COLORES_PERSONA).not.toContain(COLOR_SIN_ASIGNAR);
  });
});

describe('el color de una tarea', () => {
  it('toma el de su duenio', () => {
    const { color, sinAsignar } = colorDeTarea(UUID_A);
    expect(color).toBe(colorDePersona(UUID_A));
    expect(sinAsignar).toBe(false);
  });

  it('sin duenio avisa, para poder dibujarla distinto', () => {
    // No alcanza con el color: impreso en blanco y negro el color se pierde,
    // asi que estas ademas se dibujan punteadas.
    const { color, sinAsignar } = colorDeTarea(null);
    expect(color).toBe(COLOR_SIN_ASIGNAR);
    expect(sinAsignar).toBe(true);
  });

  it('usa el reparto del padron cuando se lo conoce', () => {
    const colores = coloresPorPersona([{ id: UUID_A }, { id: UUID_B }]);
    expect(colorDeTarea(UUID_A, colores).color).toBe(colores.get(UUID_A));
  });

  it('REGRESION: alguien que ya no esta en el padron igual recibe color', () => {
    // Un usuario dado de baja con tareas viejas. Sin esto se quedaba sin
    // borde y parecia que no tenia duenio.
    const colores = coloresPorPersona([{ id: UUID_A }]);
    const { color, sinAsignar } = colorDeTarea('alguien-que-se-fue', colores);
    expect(COLORES_PERSONA).toContain(color);
    expect(sinAsignar).toBe(false);
  });
});
