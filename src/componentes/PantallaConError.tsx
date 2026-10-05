import * as Sentry from '@sentry/react';
import type { ReactNode } from 'react';

/**
 * La red de seguridad de toda la app: si una pantalla se rompe al dibujarse,
 * en vez de quedar todo en blanco aparece este aviso, y (si Sentry está
 * configurado) el error queda reportado con su traza.
 *
 * Sin Sentry funciona igual: el aviso se muestra y el error va a la consola.
 */
export function PantallaConError({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary fallback={<AvisoError />}>{children}</Sentry.ErrorBoundary>
  );
}

function AvisoError() {
  return (
    <div className="pantalla-error" role="alert">
      <h1>Algo falló al mostrar esta pantalla</h1>
      <p>
        No se perdió nada de lo que ya estaba guardado. Recargá la página; si vuelve a pasar,
        avisale a sistemas qué estabas haciendo.
      </p>
      <div className="acciones-error">
        <button type="button" className="btn btn-primario" onClick={() => window.location.reload()}>
          Recargar
        </button>
        <a href="/" className="btn">
          Ir al inicio
        </a>
      </div>
    </div>
  );
}
