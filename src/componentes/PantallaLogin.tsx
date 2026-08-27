import { SignIn, SignUp } from '@clerk/clerk-react';
import { useState } from 'react';
import { LogoLasTres } from './LogoLasTres';
import { StickerHerramientas } from './StickerHerramientas';

/**
 * Pantalla de acceso: alterna entre iniciar sesión y registrarse.
 *
 * Clerk trae su propio enlace "Registrate", pero navega a una ruta que acá no
 * existe (la app no monta el Router hasta después del login). Por eso el cambio
 * entre una vista y otra se maneja con estado local.
 */
export function PantallaLogin() {
  const [vista, setVista] = useState<'ingresar' | 'registrarse'>('ingresar');

  return (
    <div className="pantalla-acceso">
      <div className="acceso-marca">
        {/* El isologo es rojo: necesita fondo blanco para leerse. */}
        <div className="panel-logo panel-logo-grande">
          <LogoLasTres alto={132} />
        </div>

        <div className="acceso-titulo">
          <StickerHerramientas tamano={72} />
          <div>
            <h1>Sistema de Mantenimiento</h1>
            <p className="texto-suave">
              Gestión de stock, equipos informáticos y órdenes de compra.
            </p>
          </div>
        </div>
      </div>

      <div className="acceso-formulario">
        {vista === 'ingresar' ? (
          <SignIn routing="virtual" signUpUrl={undefined} />
        ) : (
          <SignUp routing="virtual" signInUrl={undefined} />
        )}

        <p className="acceso-cambio">
          {vista === 'ingresar' ? (
            <>
              ¿No tenés cuenta?{' '}
              <button type="button" className="boton-enlace" onClick={() => setVista('registrarse')}>
                Registrate
              </button>
            </>
          ) : (
            <>
              ¿Ya tenés cuenta?{' '}
              <button type="button" className="boton-enlace" onClick={() => setVista('ingresar')}>
                Iniciá sesión
              </button>
            </>
          )}
        </p>
      </div>

      <footer className="acceso-pie texto-suave">
        Lácteos Las Tres S.R.L. · Sistema interno de mantenimiento
      </footer>
    </div>
  );
}
