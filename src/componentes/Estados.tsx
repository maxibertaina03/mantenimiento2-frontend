import type { ReactNode } from 'react';

/** Indicador de carga simple. */
export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <p className="texto-suave">{texto}</p>;
}

/** Caja de error legible (usa el mensaje del backend si está disponible). */
export function MensajeError({ error }: { error: unknown }) {
  const mensaje = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  return <div className="alerta alerta-error">⚠️ {mensaje}</div>;
}

/** Estado vacío para listados sin datos. */
export function EstadoVacio({ children }: { children: ReactNode }) {
  return <div className="estado-vacio">{children}</div>;
}
