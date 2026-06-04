import type { ErrorApi } from '@/tipos/comunes';

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

interface OpcionesRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Query params; los valores undefined/null/'' se omiten. */
  query?: Record<string, string | number | undefined | null>;
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

/** Cliente HTTP central. Tipa la respuesta y normaliza los errores del backend. */
export async function apiRequest<T>(path: string, opciones: OpcionesRequest = {}): Promise<T> {
  const { method = 'GET', body, query } = opciones;

  const respuesta = await fetch(construirUrl(path, query), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 No Content (p. ej. DELETE) no trae cuerpo.
  if (respuesta.status === 204) {
    return undefined as T;
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ApiError(respuesta.status, extraerMensaje(datos, respuesta.status));
  }

  return datos as T;
}
