import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
}

/** Modal genérico con fondo oscuro. */
export function Modal({ titulo, abierto, onCerrar, children }: Props) {
  if (!abierto) return null;
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-titulo">
          <h2 style={{ margin: 0 }}>{titulo}</h2>
          <button className="btn btn-sm" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
