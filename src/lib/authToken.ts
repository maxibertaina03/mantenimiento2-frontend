/**
 * Puente entre Clerk (que vive en componentes/hooks) y el apiClient (función plana).
 *
 * Un componente dentro del ClerkProvider registra acá el "obtenedor" de token
 * (useAuth().getToken). El apiClient lo invoca antes de cada request para
 * adjuntar el Authorization: Bearer <token>.
 *
 * Si Clerk no está configurado (dev sin auth), el getter queda en null y no se
 * envía ningún token (el backend con AUTH_DISABLED="true" igual responde).
 */
type ObtenedorToken = () => Promise<string | null>;

let obtenedor: ObtenedorToken | null = null;

export function registrarObtenedorToken(fn: ObtenedorToken | null): void {
  obtenedor = fn;
}

export async function obtenerTokenAuth(): Promise<string | null> {
  if (!obtenedor) return null;
  try {
    return await obtenedor();
  } catch {
    return null;
  }
}
