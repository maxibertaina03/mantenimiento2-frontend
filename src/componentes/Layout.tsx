import { UserButton } from '@clerk/clerk-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BannerServidor } from './Estados';
import { useUsuarioActual } from '@/api/usuarios';
import { PanelLogo } from './PanelLogo';

const claseNav = ({ isActive }: { isActive: boolean }) => (isActive ? 'activo' : '');

// Solo mostramos el control de sesión si Clerk está configurado.
const authActiva = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

/** Estructura general: sidebar de navegación + área de contenido.
 *  En celular la barra lateral se vuelve un cajón deslizable (hamburguesa). */
export function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrar = () => setMenuAbierto(false);

  // Equipos IT lo administra solo sistemas. El backend igual lo bloquea; esto
  // es para no mostrar una seccion que va a dar 403.
  const { data: usuario } = useUsuarioActual();
  const esAdmin = usuario?.rol === 'ADMIN';

  return (
    <div className="app">
      {/* Barra superior solo visible en celular */}
      <div className="barra-movil">
        <button
          className="hamburguesa"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <span className="marca">
          <PanelLogo alto={26} className="panel-logo-chico" ampliable={false} />
          Mantenimiento
        </span>
      </div>

      <aside
        className={`sidebar ${menuAbierto ? 'abierta' : ''}`}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <div className="marca marca-lateral">
          <PanelLogo alto={68} />
          <span>Mantenimiento</span>
        </div>
        <nav onClick={cerrar}>
          <NavLink to="/inicio" className={claseNav}>
            Hoy
          </NavLink>
          <NavLink to="/materiales" className={claseNav}>
            Materiales
          </NavLink>
          <NavLink to="/movimientos" end className={claseNav}>
            Historial
          </NavLink>
          <NavLink to="/movimientos/nuevo" className={claseNav}>
            Nuevo movimiento
          </NavLink>
          <NavLink to="/ordenes-compra" className={claseNav}>
            Órdenes de compra
          </NavLink>
          <NavLink to="/proveedores" className={claseNav}>
            Proveedores
          </NavLink>
          {esAdmin && (
            <>
              <NavLink to="/equipos" className={claseNav}>
                Equipos
              </NavLink>
              <NavLink to="/servicios" className={claseNav}>
                Servicios
              </NavLink>
              <NavLink to="/equipos-it" className={claseNav}>
                Equipos IT
              </NavLink>
              <NavLink to="/usuarios" className={claseNav}>
                Usuarios
              </NavLink>
            </>
          )}
        </nav>
        {authActiva && (
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <UserButton showName />
          </div>
        )}
      </aside>

      {/* Fondo oscuro para cerrar el menú en celular */}
      {menuAbierto && <div className="overlay" onClick={cerrar} />}

      <main className="contenido">
        {/* Arranque en frio del backend: visible en cualquier pantalla. */}
        <BannerServidor />
        <Outlet />
      </main>
    </div>
  );
}
