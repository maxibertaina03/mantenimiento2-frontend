import { useEffect, type ReactNode } from 'react';

interface Props {
  titulo: string;
  abierto: boolean;
  onCerrar: () => void;
  /**
   * 'ancho' para formularios de varias columnas (alta de equipo, orden de
   * compra). Por defecto es angosto, que sirve para confirmaciones y ABMs
   * cortos.
   */
  tamano?: 'normal' | 'ancho';
  children: ReactNode;
}

/** Modal genérico con fondo oscuro, cabecera fija y cuerpo con scroll propio. */
export function Modal({ titulo, abierto, onCerrar, tamano = 'normal', children }: Props) {
  // Cerrar con Escape y bloquear el scroll del fondo mientras está abierto:
  // sin esto, en celular se scrollea la página de atrás en vez del formulario.
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alPresionar);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div
        className={`modal ${tamano === 'ancho' ? 'modal-ancho' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-titulo">
          <h2>{titulo}</h2>
          <button className="btn btn-sm" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}
