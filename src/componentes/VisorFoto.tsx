import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Una foto a pantalla completa. Se cierra tocando en cualquier lado, con la ✕
 * o con Escape.
 *
 * Va al final del documento (portal) y no dentro de quien la abre: abierta
 * desde un buscador dentro de un modal, el modal la recortaría.
 *
 * Escape se atrapa antes que nadie: si no, además de cerrar la foto cerraría
 * el modal de abajo, con lo que se estaba cargando.
 */
export function VisorFoto({
  url,
  titulo,
  alCerrar,
}: {
  url: string;
  titulo: string;
  alCerrar: () => void;
}) {
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      alCerrar();
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => window.removeEventListener('keydown', alPresionar, true);
  }, [alCerrar]);

  return createPortal(
    <div
      className="visor-foto"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto de ${titulo}`}
      // Se corta acá para que el buscador de abajo no lo tome como un clic
      // afuera y se cierre: al volver de la foto, la lista sigue ahí.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        alCerrar();
      }}
    >
      <figure className="visor-foto-cuadro">
        <img src={url} alt={titulo} />
        <figcaption>{titulo}</figcaption>
      </figure>
      <button type="button" className="visor-logo-cerrar" aria-label="Cerrar">
        ✕
      </button>
    </div>,
    document.body,
  );
}
