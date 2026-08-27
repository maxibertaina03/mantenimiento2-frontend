import type { ReactNode } from 'react';
import { ErrorServidorNoDisponible } from '@/lib/apiClient';
import { useServidorDespertando } from '@/lib/estadoServidor';

/** Indicador de carga simple. */
export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  const despertando = useServidorDespertando();
  // Durante un arranque en frío la espera es larga: conviene explicar por qué.
  if (despertando) return <AvisoDespertando />;
  return <p className="texto-suave">{texto}</p>;
}

/**
 * Cartel para el arranque en frío del servidor (plan free de Render: la
 * instancia se apaga tras ~15 min sin uso y tarda hasta un minuto en volver).
 * Es un aviso, no un error: el apiClient reintenta solo y la pantalla carga
 * cuando el servidor responde.
 */
export function AvisoDespertando() {
  return (
    <div className="alerta alerta-aviso" role="status" aria-live="polite">
      <span className="girando" aria-hidden="true">
        ⏳
      </span>{' '}
      Iniciando el servidor… La primera carga del día puede tardar hasta un minuto. Esto se
      reintenta solo, no hace falta recargar.
    </div>
  );
}

/** Banner global: aparece en cualquier pantalla mientras el servidor arranca. */
export function BannerServidor() {
  const despertando = useServidorDespertando();
  if (!despertando) return null;
  return <AvisoDespertando />;
}

/** Caja de error legible (usa el mensaje del backend si está disponible). */
export function MensajeError({ error }: { error: unknown }) {
  // Servidor caído/arrancando: es un aviso con salida, no un error de la app.
  if (error instanceof ErrorServidorNoDisponible) {
    return (
      <div className="alerta alerta-aviso" role="status">
        ⏳ {error.message}{' '}
        <button type="button" className="boton-enlace" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    );
  }

  const mensaje = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  return <div className="alerta alerta-error">⚠️ {mensaje}</div>;
}

/** Estado vacío para listados sin datos. */
export function EstadoVacio({ children }: { children: ReactNode }) {
  return <div className="estado-vacio">{children}</div>;
}
