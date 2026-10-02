import { useId, useRef, useState } from 'react';

interface Props {
  /** Lo que se pide, en grande: «Subí una foto de la máquina». */
  titulo: string;
  /** Una línea abajo: qué formatos, qué pasa con el archivo. */
  ayuda?: string;
  /** Tipos aceptados, como en <input accept>. */
  accept?: string;
  multiple?: boolean;
  /** Elegir una carpeta entera (con sus subcarpetas) en vez de archivos. */
  carpeta?: boolean;
  disabled?: boolean;
  /** Texto mientras se procesa lo elegido: «Subiendo…». */
  ocupado?: string | null;
  /** Ícono grande de la izquierda. */
  icono?: string;
  /** Más chico, en una línea: para cambiar algo que ya está (otra foto). */
  compacto?: boolean;
  onElegir: (archivos: File[]) => void;
}

/**
 * El selector de archivos del sistema: una zona para tocar o arrastrar.
 *
 * Reemplaza al «Seleccionar archivo · Sin archivos seleccionados» del
 * navegador, que se ve distinto en cada uno, no dice qué se espera y en el
 * celular es un botón gris diminuto. Acá dice qué subir, en qué formato, y
 * muestra el nombre de lo que se eligió.
 *
 * Una carpeta no se puede arrastrar (el navegador no da sus subcarpetas por
 * esa vía), así que en modo carpeta solo se elige tocando.
 */
export function SelectorArchivo({
  titulo,
  ayuda,
  accept,
  multiple = false,
  carpeta = false,
  disabled = false,
  ocupado = null,
  icono = '⬆',
  compacto = false,
  onElegir,
}: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const idAyuda = useId();
  const [encima, setEncima] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);
  const inactivo = disabled || Boolean(ocupado);

  const recibir = (lista: FileList | null) => {
    const archivos = Array.from(lista ?? []);
    if (archivos.length === 0) return;
    setElegido(
      carpeta
        ? `${archivos.length} archivos de «${(archivos[0].webkitRelativePath || '').split('/')[0] || 'la carpeta'}»`
        : archivos.length === 1
          ? archivos[0].name
          : `${archivos.length} archivos`,
    );
    onElegir(archivos);
  };

  const clases = [
    'selector-archivo',
    compacto ? 'selector-archivo-compacto' : '',
    encima ? 'selector-archivo-encima' : '',
    inactivo ? 'selector-archivo-inactivo' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={clases}
      onDragOver={(e) => {
        if (inactivo || carpeta) return;
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        if (inactivo || carpeta) return;
        e.preventDefault();
        setEncima(false);
        recibir(e.dataTransfer.files);
      }}
    >
      <button
        type="button"
        className="selector-archivo-boton"
        disabled={inactivo}
        aria-describedby={ayuda ? idAyuda : undefined}
        onClick={() => entrada.current?.click()}
      >
        <span className="selector-archivo-icono" aria-hidden="true">
          {icono}
        </span>
        <span className="selector-archivo-texto">
          <span className="selector-archivo-titulo">{ocupado ?? titulo}</span>
          {!compacto && (
            <span className="selector-archivo-ayuda" id={idAyuda}>
              {elegido && !ocupado ? `Elegido: ${elegido}` : ayuda}
              {!carpeta && !elegido && ' · o arrastralo acá'}
            </span>
          )}
        </span>
      </button>
      <input
        ref={entrada}
        type="file"
        hidden
        accept={accept}
        multiple={multiple || carpeta}
        {...(carpeta ? ({ webkitdirectory: '', directory: '' } as Record<string, string>) : {})}
        onChange={(e) => {
          recibir(e.target.files);
          // Para poder volver a elegir el mismo archivo si algo falló.
          e.target.value = '';
        }}
      />
    </div>
  );
}
