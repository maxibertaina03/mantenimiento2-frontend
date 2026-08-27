import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ErrorServidorNoDisponible, apiRequest } from './apiClient';
import { registrarObtenedorToken } from './authToken';

/**
 * El backend corre en el plan free de Render: se apaga tras ~15 min sin uso y
 * la primera request tarda hasta un minuto. Estos tests fijan que eso se
 * resuelva solo en vez de mostrarle un error al usuario.
 */
const fetchMock = vi.fn();

function ok(body: unknown = { ok: true }) {
  return { status: 200, ok: true, json: async () => body } as Response;
}

function error(status: number, body: unknown = {}) {
  return { status, ok: false, json: async () => body } as Response;
}

/** Lo que tira fetch cuando no puede llegar al servidor (o lo bloquea CORS). */
function falloDeRed() {
  return new TypeError('Failed to fetch');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  registrarObtenedorToken(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Corre la promesa dejando que los timers de backoff avancen solos. */
async function conTimers<T>(promesa: Promise<T>): Promise<T> {
  const resultado = promesa.then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  );
  await vi.runAllTimersAsync();
  const r = await resultado;
  if (!r.ok) throw r.e;
  return r.v;
}

describe('Arranque en frio - fallos de red', () => {
  it('reintenta un GET que falla por red y devuelve los datos al despertar', async () => {
    fetchMock
      .mockRejectedValueOnce(falloDeRed())
      .mockRejectedValueOnce(falloDeRed())
      .mockResolvedValue(ok({ datos: [], total: 0 }));

    const res = await conTimers(apiRequest('/materiales'));

    expect(res).toEqual({ datos: [], total: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('aguanta un arranque largo (varios fallos seguidos)', async () => {
    for (let i = 0; i < 5; i++) fetchMock.mockRejectedValueOnce(falloDeRed());
    fetchMock.mockResolvedValue(ok());

    await expect(conTimers(apiRequest('/materiales'))).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('si el servidor nunca responde, tira un error explicativo (no "Failed to fetch")', async () => {
    fetchMock.mockRejectedValue(falloDeRed());

    await expect(conTimers(apiRequest('/materiales'))).rejects.toBeInstanceOf(
      ErrorServidorNoDisponible,
    );
    await expect(conTimers(apiRequest('/materiales'))).rejects.toThrow(/iniciándose/);
  });

  it('REGRESION: NO reintenta mutaciones (evita duplicar un movimiento de stock)', async () => {
    fetchMock.mockRejectedValue(falloDeRed());

    await expect(
      conTimers(apiRequest('/movimientos', { method: 'POST', body: { cantidad: 10 } })),
    ).rejects.toBeInstanceOf(ErrorServidorNoDisponible);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('Arranque en frio - 502/503/504 del proxy', () => {
  it.each([502, 503, 504])('reintenta un GET que recibe %i y luego resuelve', async (status) => {
    fetchMock.mockResolvedValueOnce(error(status)).mockResolvedValue(ok({ listo: true }));

    await expect(conTimers(apiRequest('/materiales'))).resolves.toEqual({ listo: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('si sigue en 503 tras los reintentos, el error explica que esta iniciando', async () => {
    fetchMock.mockResolvedValue(error(503));

    await expect(conTimers(apiRequest('/materiales'))).rejects.toBeInstanceOf(
      ErrorServidorNoDisponible,
    );
  });
});

describe('Los errores reales siguen llegando sin demora', () => {
  it('un 404 no se reintenta', async () => {
    fetchMock.mockResolvedValue(error(404, { message: 'No existe el material' }));

    await expect(conTimers(apiRequest('/materiales/x'))).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('un 400 de validacion no se reintenta y conserva el mensaje', async () => {
    fetchMock.mockResolvedValue(error(400, { message: 'Stock insuficiente: hay 5' }));

    await expect(conTimers(apiRequest('/movimientos', { method: 'POST' }))).rejects.toThrow(
      /Stock insuficiente/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('un 401 no se reintenta (hay que renovar la sesion, no esperar)', async () => {
    fetchMock.mockResolvedValue(error(401, { message: 'Falta el token' }));

    await expect(conTimers(apiRequest('/usuarios/me'))).rejects.toMatchObject({ statusCode: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('un 500 real no se confunde con un arranque en frio', async () => {
    fetchMock.mockResolvedValue(error(500, { message: 'Error interno' }));

    await expect(conTimers(apiRequest('/materiales'))).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
