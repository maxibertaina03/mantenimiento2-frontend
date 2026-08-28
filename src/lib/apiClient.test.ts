import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ErrorServidorNoDisponible, apiRequest } from './apiClient';
import { registrarObtenedorToken } from './authToken';

/** Respuesta fetch falsa. */
function respuesta(status: number, body: unknown = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(respuesta(200, { ok: true }));
  registrarObtenedorToken(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Devuelve la URL con la que se llamó a fetch. */
function urlLlamada(): URL {
  return new URL(fetchMock.mock.calls[0][0]);
}

function opcionesLlamada(): RequestInit {
  return fetchMock.mock.calls[0][1];
}

describe('apiRequest - construcción de URL', () => {
  it('concatena el path a la base', async () => {
    await apiRequest('/materiales');
    expect(urlLlamada().pathname).toMatch(/\/materiales$/);
  });

  it('agrega los query params', async () => {
    await apiRequest('/materiales', { query: { pagina: 1, limite: 20 } });
    const url = urlLlamada();
    expect(url.searchParams.get('pagina')).toBe('1');
    expect(url.searchParams.get('limite')).toBe('20');
  });

  it('omite los params undefined, null y string vacío', async () => {
    await apiRequest('/materiales', {
      query: { buscar: undefined, tipo: null, motivo: '', pagina: 1 },
    });
    const url = urlLlamada();
    expect(url.searchParams.has('buscar')).toBe(false);
    expect(url.searchParams.has('tipo')).toBe(false);
    expect(url.searchParams.has('motivo')).toBe(false);
    expect(url.searchParams.get('pagina')).toBe('1');
  });

  it('NO omite el 0 (es un valor legítimo)', async () => {
    await apiRequest('/materiales', { query: { stockMinimo: 0 } });
    expect(urlLlamada().searchParams.get('stockMinimo')).toBe('0');
  });

  it('escapa caracteres especiales en la búsqueda', async () => {
    await apiRequest('/materiales', { query: { buscar: 'cable & cinta 2.5' } });
    expect(urlLlamada().searchParams.get('buscar')).toBe('cable & cinta 2.5');
  });
});

describe('apiRequest - método y cuerpo', () => {
  it('por defecto usa GET y no manda body', async () => {
    await apiRequest('/materiales');
    const opts = opcionesLlamada();
    expect(opts.method).toBe('GET');
    expect(opts.body).toBeUndefined();
  });

  it('serializa el body a JSON y setea Content-Type', async () => {
    await apiRequest('/materiales', { method: 'POST', body: { nombre: 'Cable' } });
    const opts = opcionesLlamada();
    expect(opts.body).toBe('{"nombre":"Cable"}');
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('no manda Content-Type si no hay body', async () => {
    await apiRequest('/materiales', { method: 'DELETE' });
    expect((opcionesLlamada().headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
});

describe('apiRequest - autenticación', () => {
  it('sin token registrado no manda Authorization', async () => {
    await apiRequest('/materiales');
    expect((opcionesLlamada().headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('adjunta el Bearer token cuando hay sesión', async () => {
    registrarObtenedorToken(async () => 'jwt-de-clerk');
    await apiRequest('/materiales');
    expect((opcionesLlamada().headers as Record<string, string>)['Authorization']).toBe(
      'Bearer jwt-de-clerk',
    );
  });

  it('si el obtenedor de token falla, la request igual sale sin token', async () => {
    registrarObtenedorToken(async () => {
      throw new Error('Clerk caído');
    });
    await expect(apiRequest('/materiales')).resolves.toBeDefined();
    expect((opcionesLlamada().headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('un token null no se adjunta', async () => {
    registrarObtenedorToken(async () => null);
    await apiRequest('/materiales');
    expect((opcionesLlamada().headers as Record<string, string>)['Authorization']).toBeUndefined();
  });
});

describe('apiRequest - respuestas', () => {
  it('devuelve el JSON parseado', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { datos: [1, 2], total: 2 }));
    await expect(apiRequest('/materiales')).resolves.toEqual({ datos: [1, 2], total: 2 });
  });

  it('204 No Content devuelve undefined sin intentar parsear', async () => {
    const json = vi.fn();
    fetchMock.mockResolvedValue({ status: 204, ok: true, json } as unknown as Response);
    await expect(apiRequest('/materiales/x')).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });
});

describe('apiRequest - manejo de errores', () => {
  it('lanza ApiError con el status del backend', async () => {
    fetchMock.mockResolvedValue(respuesta(404, { message: 'No existe el material' }));
    await expect(apiRequest('/materiales/x')).rejects.toBeInstanceOf(ApiError);
    await expect(apiRequest('/materiales/x')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('usa el mensaje legible del backend', async () => {
    fetchMock.mockResolvedValue(respuesta(400, { message: 'Stock insuficiente: hay 5' }));
    await expect(apiRequest('/movimientos', { method: 'POST' })).rejects.toThrow(
      /Stock insuficiente/,
    );
  });

  it('une los errores de validación de class-validator (array de mensajes)', async () => {
    fetchMock.mockResolvedValue(
      respuesta(400, { message: ['nombre no puede estar vacío', 'unidad es requerida'] }),
    );
    await expect(apiRequest('/materiales', { method: 'POST' })).rejects.toThrow(
      'nombre no puede estar vacío · unidad es requerida',
    );
  });

  it('si el cuerpo del error no es JSON, cae a un mensaje genérico', async () => {
    fetchMock.mockResolvedValue({
      status: 500,
      ok: false,
      json: async () => {
        throw new Error('no es JSON');
      },
    } as unknown as Response);
    await expect(apiRequest('/materiales')).rejects.toThrow('Error 500');
  });

  it('si el error no trae message, cae a un mensaje genérico', async () => {
    fetchMock.mockResolvedValue(respuesta(409, {}));
    await expect(apiRequest('/materiales')).rejects.toThrow('Error 409');
  });

  it('REGRESION: un 503 CON mensaje de la API conserva ese mensaje', async () => {
    // La API usa 503 para "el correo no esta configurado". Antes el cliente lo
    // tapaba con el cartel de "el servidor esta arrancando" y el motivo real
    // nunca llegaba a la pantalla.
    fetchMock.mockResolvedValue(
      respuesta(503, { message: 'El envío automático de correo no está configurado.' }),
    );
    await expect(
      apiRequest('/ordenes-compra/x/enviar-correo', { method: 'POST', body: {} }),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      apiRequest('/ordenes-compra/x/enviar-correo', { method: 'POST', body: {} }),
    ).rejects.toThrow(/no está configurado/);
  });

  it('REGRESION: un 502 CON mensaje (Gmail rechazo el envio) tambien lo conserva', async () => {
    fetchMock.mockResolvedValue(
      respuesta(502, { message: 'No se pudo enviar el correo: Invalid login 535-5.7.8' }),
    );
    await expect(
      apiRequest('/ordenes-compra/x/enviar-correo', { method: 'POST', body: {} }),
    ).rejects.toThrow(/535-5\.7\.8/);
  });

  it('un 503 SIN mensaje sigue siendo el servidor arrancando', async () => {
    // Es lo que devuelve el proxy de Render mientras la instancia levanta: HTML,
    // sin cuerpo JSON.
    fetchMock.mockResolvedValue({
      status: 503,
      ok: false,
      json: async () => {
        throw new Error('no es JSON');
      },
    } as unknown as Response);
    await expect(
      apiRequest('/materiales', { method: 'POST', body: {} }),
    ).rejects.toBeInstanceOf(ErrorServidorNoDisponible);
  });

  it('un fallo de red se traduce a ErrorServidorNoDisponible (ver arranqueEnFrio.test.ts)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    // Las mutaciones no se reintentan, asi que esto resuelve sin esperas.
    await expect(
      apiRequest('/movimientos', { method: 'POST', body: {} }),
    ).rejects.toBeInstanceOf(ErrorServidorNoDisponible);
  });
});
