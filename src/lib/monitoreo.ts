import * as Sentry from '@sentry/react';

/**
 * Aviso de errores de la pantalla a Sentry.
 *
 * Sin `VITE_SENTRY_DSN` no hace nada: en local y en los tests no sale nada, y
 * en producción se prende cargando la variable en Vercel.
 *
 * Lo que se reporta desde acá es lo que solo el navegador ve: una pantalla que
 * se rompe al dibujarse, o un error que nadie atrapó. Los errores del servidor
 * los reporta el backend; repetirlos acá los duplicaría.
 *
 * Sin datos de nadie: ni la IP, ni lo que se escribe en los formularios, ni la
 * pantalla grabada (no se usa Session Replay).
 */
export function iniciarMonitoreo(dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined) {
  if (!dsn?.trim()) return false;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Los avisos que Sentry junta por su cuenta («breadcrumbs») pueden traer
    // direcciones con búsquedas y textos de la consola: se dejan afuera.
    beforeBreadcrumb: () => null,
    beforeSend(evento) {
      delete evento.user;
      if (evento.request) {
        delete evento.request.headers;
        delete evento.request.cookies;
        delete evento.request.query_string;
      }
      return evento;
    },
  });
  return true;
}
