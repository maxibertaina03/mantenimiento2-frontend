import type { ErrorApi } from '@/tipos/comunes';
import { obtenerTokenAuth } from './authToken';
import { marcarDespertando } from './estadoServidor';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

/** Error tipado que conserva el status y el mensaje legible del backend. */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * El servidor no estaba disponible (dormido, arrancando o sin red).
 * Se distingue de ApiError para que la UI pueda dar un mensaje útil en vez de
 * un "Failed to fetch" o un falso error de CORS.
 */
export class ErrorServidorNoDisponible extends Error {
  constructor(message = 'No se pudo contactar al servidor.') {
    super(message);
    this.name = 'ErrorServidorNoDisponible';
  }
}

interface OpcionesRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Query params; los valores undefined/null/'' se omiten. */
  query?: Record<string, string | number | undefined | null>;
}

/**
 * Esperas entre reintentos mientras la instancia de Render arranca (~44s en
 * total). El plan free puede tardar hasta 50-60s en el primer request tras
 * dormirse; con esto el usuario ve un cartel de "despertando" y la pantalla
 * carga sola cuando el servidor responde.
 */
const ESPERAS_REINTENTO_MS = [1000, 3000, 5000, 8000, 12000, 15000];

/** Códigos que devuelve el proxy de Render mientras la instancia no está lista. */
const ESTADOS_ARRANCANDO = new Set([502, 503, 504]);

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function construirUrl(path: string, query?: OpcionesRequest['query']): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [clave, valor] of Object.entries(query)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        url.searchParams.set(clave, String(valor));
      }
    }
  }
  return url.toString();
}

function extraerMensaje(payload: Partial<ErrorApi> | null, status: number): string {
  if (!payload) return `Error ${status}`;
  const { message } = payload;
  if (Array.isArray(message)) return message.join(' · ');
  return message ?? `Error ${status}`;
}

/**
 * fetch con reintentos para cubrir el arranque en frío del servidor.
 *
 * Solo se reintentan los GET: un fallo de red no permite saber si el servidor
 * llegó a procesar la request, y reintentar un POST/PATCH/DELETE podría
 * duplicar un movimiento de stock. Como toda pantalla arranca con GETs, para
 * cuando el usuario guarda algo el servidor ya está despierto.
 */
async function fetchConReintentos(
  url: string,
  init: RequestInit,
  reintentable: boolean,
): Promise<Response> {
  const maxIntentos = reintentable ? ESPERAS_REINTENTO_MS.length : 0;

  for (let intento = 0; ; intento++) {
    try {
      const respuesta = await fetch(url, init);

      // El proxy responde 502/503/504 mientras la instancia levanta.
      if (ESTADOS_ARRANCANDO.has(respuesta.status) && intento < maxIntentos) {
        marcarDespertando(true);
        await esperar(ESPERAS_REINTENTO_MS[intento]);
        continue;
      }

      // Llegamos al servidor: ya no está despertando.
      marcarDespertando(false);
      return respuesta;
    } catch (error) {
      // fetch lanza TypeError cuando no puede llegar al servidor. Es también lo
      // que se ve cuando el navegador bloquea la respuesta por falta de headers
      // CORS, que es exactamente lo que pasa con un error del proxy de Render.
      if (intento >= maxIntentos) {
        marcarDespertando(false);
        throw new ErrorServidorNoDisponible(
          'No se pudo contactar al servidor. Puede estar iniciándose; probá de nuevo en un minuto.',
        );
      }
      marcarDespertando(true);
      await esperar(ESPERAS_REINTENTO_MS[intento]);
    }
  }
}

/** Cliente HTTP central. Tipa la respuesta y normaliza los errores del backend. */
export async function apiRequest<T>(path: string, opciones: OpcionesRequest = {}): Promise<T> {
  const { method = 'GET', body, query } = opciones;

  // Adjunta el token de Clerk si hay sesión (ver lib/authToken.ts).
  const token = await obtenerTokenAuth();
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const respuesta = await fetchConReintentos(
    construirUrl(path, query),
    { method, headers, body: body ? JSON.stringify(body) : undefined },
    method === 'GET',
  );

  // 204 No Content (p. ej. DELETE) no trae cuerpo.
  if (respuesta.status === 204) {
    return undefined as T;
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    // Un 5xx que sobrevivió a los reintentos suele ser el servidor sin levantar.
    // Pero nuestra API también usa 502/503 para cosas reales (por ejemplo, que
    // el correo no esté configurado), y ahí el mensaje explicativo tapaba el
    // motivo verdadero. Se distinguen por el cuerpo: el proxy de Render
    // devuelve HTML, y nuestra API devuelve JSON con `message`.
    if (ESTADOS_ARRANCANDO.has(respuesta.status) && !datos?.message) {
      throw new ErrorServidorNoDisponible(
        'El servidor no está respondiendo. Puede estar iniciándose; probá de nuevo en un minuto.',
      );
    }
    throw new ApiError(respuesta.status, extraerMensaje(datos, respuesta.status));
  }

  return datos as T;
}
