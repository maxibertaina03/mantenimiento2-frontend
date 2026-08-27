import { SignIn, SignUp } from '@clerk/clerk-react';
import { useState } from 'react';
import { PanelLogo } from './PanelLogo';
import { StickerHerramientas } from './StickerHerramientas';

/**
 * Pantalla de acceso: alterna entre iniciar sesión y registrarse.
 *
 * El enlace propio de Clerk ("¿No tenés cuenta?") se oculta porque navega a una
 * ruta que todavía no existe: el Router recién se monta después del login. En su
 * lugar usamos el boton de abajo, que cambia de vista con estado local. Sin esto
 * aparecian DOS enlaces "Registrate" y el de Clerk no hacía nada.
 */
const APARIENCIA_CLERK = {
  elements: {
    footerAction: { display: 'none' },
    // La tarjeta ya vive dentro de nuestro contenedor centrado.
    rootBox: { width: '100%' },
    cardBox: { width: '100%' },
  },
} as const;

export function PantallaLogin() {
  const [vista, setVista] = useState<'ingresar' | 'registrarse'>('ingresar');
  const esIngreso = vista === 'ingresar';

  return (
    <div className="pantalla-acceso">
      <div className="acceso-marca">
        {/* El isologo es rojo: necesita fondo blanco. Se toca para ampliar. */}
        <PanelLogo alto={150} className="panel-logo-grande" />

        <div className="acceso-titulo">
          <StickerHerramientas tamano={64} />
          <div>
            <h1>Sistema de Mantenimiento</h1>
            <p className="texto-suave">
              Gestión de stock, equipos informáticos y órdenes de compra.
            </p>
          </div>
        </div>
      </div>

      <div className="acceso-formulario">
        {esIngreso ? (
          <SignIn routing="virtual" appearance={APARIENCIA_CLERK} />
        ) : (
          <SignUp routing="virtual" appearance={APARIENCIA_CLERK} />
        )}

        <p className="acceso-cambio">
          {esIngreso ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
          <button
            type="button"
            className="boton-enlace"
            onClick={() => setVista(esIngreso ? 'registrarse' : 'ingresar')}
          >
            {esIngreso ? 'Registrate' : 'Iniciá sesión'}
          </button>
        </p>
      </div>

      <footer className="acceso-pie texto-suave">
        Lácteos Las Tres S.R.L. · Sistema interno de mantenimiento
      </footer>
    </div>
  );
}
