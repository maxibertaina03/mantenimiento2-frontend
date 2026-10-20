import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface OpcionMenu {
  texto: string;
  Icono?: LucideIcon;
  onElegir: () => void;
  deshabilitada?: boolean;
}

interface Props {
  /** Lo que dice el botón: «Exportar», «Configurar». */
  texto: ReactNode;
  Icono?: LucideIcon;
  opciones: OpcionMenu[];
  /** Hacia dónde se abre: la cabecera lo pide a la derecha para no salirse. */
  alinear?: 'izquierda' | 'derecha';
  deshabilitado?: boolean;
}

/**
 * Un botón que despliega varias acciones.
 *
 * Para agrupar lo que se usa poco y llenaba la cabecera de botones: en
 * Materiales eran siete, y el que importa —«Nuevo material»— se perdía entre
 * los demás. Se cierra al elegir, al tocar afuera y con Escape.
 */
export function MenuDesplegable({
  texto,
  Icono,
  opciones,
  alinear = 'derecha',
  deshabilitado = false,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  return (
    <div className="menu-desplegable" ref={caja}>
      <button
        type="button"
        className="btn"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={id}
        disabled={deshabilitado}
        onClick={() => setAbierto((v) => !v)}
      >
        {Icono && <Icono className="icono" aria-hidden />}
        {texto}
        <ChevronDown className="icono icono-flecha" aria-hidden />
      </button>
      {abierto && (
        <div id={id} role="menu" className={`menu-desplegable-lista hacia-${alinear}`}>
          {opciones.map(({ texto: t, Icono: I, onElegir, deshabilitada }) => (
            <button
              key={t}
              type="button"
              role="menuitem"
              disabled={deshabilitada}
              onClick={() => {
                setAbierto(false);
                onElegir();
              }}
            >
              {I && <I className="icono" aria-hidden />}
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
