import { useEffect, useRef, useState, type ReactNode } from 'react';

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
  /**
   * Si se cargó algo, preguntar antes de cerrar por un clic afuera, la ✕ o
   * Escape. Por defecto sí. Los botones «Cancelar» del propio formulario
   * cierran directo: ahí la intención es clara.
   */
  avisarSiHayCambios?: boolean;
  children: ReactNode;
}

/**
 * Los modales abiertos, del de más abajo al de más arriba. Escape y el aviso
 * son solo del de arriba: con un modal abierto sobre otro (el material nuevo
 * sobre la orden de compra), Escape no tiene que cerrar los dos.
 */
const abiertos: symbol[] = [];

/** Modal genérico con fondo oscuro, cabecera fija y cuerpo con scroll propio. */
export function Modal({
  titulo,
  abierto,
  onCerrar,
  tamano = 'normal',
  avisarSiHayCambios = true,
  children,
}: Props) {
  const yo = useRef(Symbol(titulo));
  /** Si se escribió o eligió algo adentro: ahí cerrar sin querer pierde trabajo. */
  const [tocado, setTocado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  /** Dónde empezó el clic: soltar afuera después de seleccionar texto no es «tocar afuera». */
  const empezoEnElFondo = useRef(false);

  const intentarCerrar = () => {
    if (avisarSiHayCambios && tocado) setConfirmando(true);
    else onCerrar();
  };

  // Escape lee el estado de este render, no el del momento en que se abrió.
  const alEscape = useRef(() => {});
  alEscape.current = () => {
    if (confirmando) setConfirmando(false);
    else intentarCerrar();
  };

  // Cerrar con Escape y bloquear el scroll del fondo mientras está abierto:
  // sin esto, en celular se scrollea la página de atrás en vez del formulario.
  useEffect(() => {
    if (!abierto) return;
    const id = yo.current;
    abiertos.push(id);
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && abiertos[abiertos.length - 1] === id) alEscape.current();
    };
    document.addEventListener('keydown', alPresionar);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = overflowPrevio;
      abiertos.splice(abiertos.indexOf(id), 1);
    };
  }, [abierto]);

  // Cerrado y vuelto a abrir, arranca de cero.
  useEffect(() => {
    if (!abierto) {
      setTocado(false);
      setConfirmando(false);
    }
  }, [abierto]);

  if (!abierto) return null;

  const marcarTocado = () => {
    if (!tocado) setTocado(true);
  };

  return (
    <div
      className="modal-fondo"
      onMouseDown={(e) => {
        empezoEnElFondo.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && empezoEnElFondo.current) intentarCerrar();
        empezoEnElFondo.current = false;
      }}
    >
      <div
        className={`modal ${tamano === 'ancho' ? 'modal-ancho' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-titulo">
          <h2>{titulo}</h2>
          <button className="btn btn-sm" onClick={intentarCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-cuerpo" onInputCapture={marcarTocado} onChangeCapture={marcarTocado}>
          {children}
        </div>

        {confirmando && (
          <div className="modal-confirmar" role="alertdialog" aria-label="¿Salir sin guardar?">
            <div className="modal-confirmar-caja">
              <strong>¿Salir sin guardar?</strong>
              <p className="texto-suave">
                Lo que cargaste en «{titulo}» se pierde. Si querés terminarlo, seguí cargando.
              </p>
              <div className="acciones">
                <button type="button" className="btn btn-peligro" onClick={onCerrar}>
                  Salir sin guardar
                </button>
                <button
                  type="button"
                  className="btn btn-primario"
                  autoFocus
                  onClick={() => setConfirmando(false)}
                >
                  Seguir cargando
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
