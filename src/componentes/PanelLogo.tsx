import { useEffect, useState } from 'react';
import { LogoLasTres } from './LogoLasTres';

interface Props {
  /** Alto del logo dentro del panel. */
  alto?: number;
  /** Clases extra del panel (p. ej. panel-logo-grande). */
  className?: string;
  /** Si es false, el panel no se puede ampliar (barra móvil, por ejemplo). */
  ampliable?: boolean;
}

/**
 * Logo sobre panel blanco. Al tocarlo se abre a pantalla completa, que es la
 * forma de verlo en detalle desde el celular, donde el panel es chico.
 */
export function PanelLogo({ alto = 64, className = '', ampliable = true }: Props) {
  const [ampliado, setAmpliado] = useState(false);

  if (!ampliable) {
    return (
      <span className={`panel-logo ${className}`}>
        <LogoLasTres alto={alto} />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`panel-logo panel-logo-boton ${className}`}
        onClick={() => setAmpliado(true)}
        aria-label="Ampliar el logo de Lácteos Las Tres"
        title="Tocá para ampliar"
      >
        <LogoLasTres alto={alto} />
      </button>

      {ampliado && <VisorLogo alCerrar={() => setAmpliado(false)} />}
    </>
  );
}

/** Visor a pantalla completa: se cierra tocando en cualquier lado o con Escape. */
function VisorLogo({ alCerrar }: { alCerrar: () => void }) {
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', alPresionar);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [alCerrar]);

  return (
    <div
      className="visor-logo"
      onClick={alCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Logo ampliado"
    >
      <div className="visor-logo-panel" onClick={(e) => e.stopPropagation()}>
        {/* Sin `alto` fijo: el CSS lo hace crecer hasta llenar la pantalla. */}
        <LogoLasTres className="visor-logo-svg" />
      </div>
      <button type="button" className="visor-logo-cerrar" onClick={alCerrar} aria-label="Cerrar">
        ✕
      </button>
    </div>
  );
}
