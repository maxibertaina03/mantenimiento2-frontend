interface Props {
  /** Nombre de lo que se está tocando; va en las etiquetas accesibles. */
  descripcion: string;
  onVer?: () => void;
  onEditar?: () => void;
  onEliminar?: () => void;
}

/**
 * Acciones de una fila/tarjeta: ver, editar y eliminar.
 *
 * Se usan íconos porque en el celular cada fila es una tarjeta y tres botones
 * con texto no entran cómodos. Cada botón lleva `aria-label` y `title`: el
 * ícono solo no dice nada a un lector de pantalla, y el title da el tooltip en
 * escritorio.
 */
export function AccionesFila({ descripcion, onVer, onEditar, onEliminar }: Props) {
  return (
    <div className="acciones-fila">
      {onVer && (
        <button
          type="button"
          className="btn btn-icono"
          onClick={onVer}
          aria-label={`Ver ${descripcion}`}
          title="Ver detalle"
        >
          👁
        </button>
      )}
      {onEditar && (
        <button
          type="button"
          className="btn btn-icono"
          onClick={onEditar}
          aria-label={`Editar ${descripcion}`}
          title="Editar"
        >
          ✏️
        </button>
      )}
      {onEliminar && (
        <button
          type="button"
          className="btn btn-icono btn-icono-peligro"
          onClick={onEliminar}
          aria-label={`Eliminar ${descripcion}`}
          title="Eliminar"
        >
          ✕
        </button>
      )}
    </div>
  );
}

interface PropsDato {
  etiqueta: string;
  valor: React.ReactNode;
}

/** Una línea "etiqueta: valor" dentro de una ficha de detalle. */
export function DatoFicha({ etiqueta, valor }: PropsDato) {
  if (valor === null || valor === undefined || valor === '') return null;
  return (
    <div className="dato">
      <span className="texto-suave texto-chico">{etiqueta}</span>
      <span>{valor}</span>
    </div>
  );
}
