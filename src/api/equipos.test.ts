import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El padrón completo de equipos.
 *
 * El servidor no acepta más de 100 por página. Pedirle "traeme los 326" de una
 * devuelve `limite must not be greater than 100`, y las pantallas que necesitan
 * el padrón entero quedan sin poder hacer nada.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const { obtenerTodosLosEquipos } = await import('./equipos');

/** Simula un padrón de N equipos servido de a páginas. */
function servidorCon(cantidad: number) {
  apiRequestMock.mockImplementation((..._args: unknown[]) => {
    const config = _args[1] as { query: Record<string, number> };
    const { pagina, limite } = config.query;
    if (limite > 100) {
      return Promise.reject(new Error('limite must not be greater than 100'));
    }
    const desde = (pagina - 1) * limite;
    const datos = Array.from({ length: Math.max(0, Math.min(limite, cantidad - desde)) }, (_, i) => ({
      id: `eq-${desde + i}`,
    }));
    return Promise.resolve({ datos, total: cantidad, pagina, limite });
  });
}

// Con llaves a propósito: `() => apiRequestMock.mockReset()` DEVUELVE el mock,
// y Vitest toma lo que devuelve un hook como función de limpieza. Al terminar
// cada prueba lo llamaba sin argumentos, y esa llamada fantasma se colaba en
// `mock.calls` y rompía las comprobaciones.
beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('obtenerTodosLosEquipos', () => {
  it('REGRESION: nunca pide mas de 100 por pagina', async () => {
    // Pedir 1000 de una devolvia "limite must not be greater than 100" y la
    // pantalla de cargar fotos no abria.
    servidorCon(326);
    await obtenerTodosLosEquipos();

    for (const [, config] of apiRequestMock.mock.calls) {
      expect(config.query.limite).toBeLessThanOrEqual(100);
    }
  });

  it('trae los 326 recorriendo las paginas', async () => {
    servidorCon(326);
    const todos = await obtenerTodosLosEquipos();

    expect(todos).toHaveLength(326);
    expect(apiRequestMock).toHaveBeenCalledTimes(4);
  });

  it('con menos de una pagina, hace una sola llamada', async () => {
    servidorCon(12);
    expect(await obtenerTodosLosEquipos()).toHaveLength(12);
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it('un padron vacio no deja el bucle girando', async () => {
    // Sin el corte por datos vacios, un total mal informado colgaria la pantalla.
    servidorCon(0);
    expect(await obtenerTodosLosEquipos()).toHaveLength(0);
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it('un multiplo exacto de 100 no pide una pagina de mas', async () => {
    servidorCon(200);
    expect(await obtenerTodosLosEquipos()).toHaveLength(200);
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it('pasa los filtros a todas las paginas', async () => {
    servidorCon(150);
    await obtenerTodosLosEquipos({ sinQr: true, ubicacionId: 'ubi-1' });

    for (const [, config] of apiRequestMock.mock.calls) {
      expect(config.query.sinQr).toBe('true');
      expect(config.query.ubicacionId).toBe('ubi-1');
    }
  });
});
