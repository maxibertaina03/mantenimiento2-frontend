import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Traer un listado completo.
 *
 * Antes las páginas se pedían en fila india: una, esperar, la siguiente. Para
 * los 911 materiales de las etiquetas eran diez idas y vueltas, una detrás de
 * otra. La consulta tarda milisegundos; lo que se siente es el viaje.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const { traerTodasLasPaginas } = await import('./paginado');

interface Fila {
  id: string;
}

/**
 * Simula el servidor y mide cuántos pedidos estuvieron en el aire a la vez.
 *
 * `demora` hace que las respuestas lleguen desordenadas a propósito: la página
 * 3 contesta antes que la 2. Si el código armara el resultado por orden de
 * llegada, el listado saldría mezclado.
 */
function servidorCon(cantidad: number, opciones: { desordenar?: boolean } = {}) {
  let enVuelo = 0;
  const medicion = { maximoSimultaneo: 0 };

  apiRequestMock.mockImplementation(async (_ruta: string, config: unknown) => {
    const { pagina, limite } = (config as { query: { pagina: number; limite: number } }).query;
    if (limite > 100) throw new Error('limite must not be greater than 100');

    enVuelo += 1;
    medicion.maximoSimultaneo = Math.max(medicion.maximoSimultaneo, enVuelo);

    // Las páginas altas contestan primero: así el desorden es seguro, no azar.
    const espera = opciones.desordenar ? Math.max(0, 30 - pagina * 5) : 0;
    await new Promise((listo) => setTimeout(listo, espera));

    enVuelo -= 1;
    const desde = (pagina - 1) * limite;
    const datos: Fila[] = Array.from(
      { length: Math.max(0, Math.min(limite, cantidad - desde)) },
      (_, i) => ({ id: `fila-${desde + i}` }),
    );
    return { datos, total: cantidad, pagina, limite };
  });

  return medicion;
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('traerTodasLasPaginas', () => {
  it('nunca pide mas de 100 por pagina', async () => {
    // El servidor rechaza limites mayores, y la pantalla queda sin abrir.
    servidorCon(911);
    await traerTodasLasPaginas<Fila>('/materiales');

    for (const [, config] of apiRequestMock.mock.calls) {
      expect(config.query.limite).toBeLessThanOrEqual(100);
    }
  });

  it('trae las 911 filas completas', async () => {
    servidorCon(911);
    expect(await traerTodasLasPaginas<Fila>('/materiales')).toHaveLength(911);
    expect(apiRequestMock).toHaveBeenCalledTimes(10);
  });

  it('REGRESION: las paginas van juntas, no una detras de otra', async () => {
    // Esta es la mejora. Antes el maximo simultaneo era 1 siempre: la unica
    // forma de tardar diez viajes en vez de dos.
    const medicion = servidorCon(911, { desordenar: true });
    await traerTodasLasPaginas<Fila>('/materiales');

    expect(medicion.maximoSimultaneo).toBeGreaterThan(1);
  });

  it('no dispara mas de seis pedidos a la vez', async () => {
    // Con mil filas serian diez mil pedidos simultaneos sin tope, y el servidor
    // de Render es chico. El paralelo tiene que ayudar, no tirarlo abajo.
    const medicion = servidorCon(5000, { desordenar: true });
    await traerTodasLasPaginas<Fila>('/materiales');

    expect(medicion.maximoSimultaneo).toBeLessThanOrEqual(6);
  });

  it('REGRESION: el orden se conserva aunque las respuestas lleguen mezcladas', async () => {
    // Armar el resultado por orden de llegada dejaria el listado desordenado,
    // y las etiquetas QR saldrian salteadas respecto de la pantalla.
    servidorCon(350, { desordenar: true });
    const filas = await traerTodasLasPaginas<Fila>('/materiales');

    expect(filas[0].id).toBe('fila-0');
    expect(filas[100].id).toBe('fila-100');
    expect(filas[349].id).toBe('fila-349');
  });

  it('con menos de una pagina, hace una sola llamada', async () => {
    servidorCon(12);
    expect(await traerTodasLasPaginas<Fila>('/materiales')).toHaveLength(12);
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it('un multiplo exacto de 100 no pide una pagina de mas', async () => {
    servidorCon(200);
    expect(await traerTodasLasPaginas<Fila>('/materiales')).toHaveLength(200);
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it('un listado vacio no deja la pantalla pidiendo paginas', async () => {
    servidorCon(0);
    expect(await traerTodasLasPaginas<Fila>('/materiales')).toHaveLength(0);
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it('pasa los filtros a todas las paginas', async () => {
    servidorCon(350);
    await traerTodasLasPaginas<Fila>('/materiales', { sinQr: 'true', categoriaId: 'cat-1' });

    for (const [, config] of apiRequestMock.mock.calls) {
      expect(config.query.sinQr).toBe('true');
      expect(config.query.categoriaId).toBe('cat-1');
    }
  });
});
