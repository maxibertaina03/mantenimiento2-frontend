import { UserButton } from '@clerk/clerk-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const claseNav = ({ isActive }: { isActive: boolean }) => (isActive ? 'activo' : '');

// Solo mostramos el control de sesión si Clerk está configurado.
const authActiva = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

/** Estructura general: sidebar de navegación + área de contenido.
 *  En celular la barra lateral se vuelve un cajón deslizable (hamburguesa). */
export function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrar = () => setMenuAbierto(false);

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
        <span className="marca">🔧 Mantenimiento</span>
      </div>

      <aside
        className={`sidebar ${menuAbierto ? 'abierta' : ''}`}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <div className="marca">🔧 Mantenimiento</div>
        <nav onClick={cerrar}>
          <NavLink to="/materiales" className={claseNav}>
            Materiales
          </NavLink>
          <NavLink to="/movimientos" end className={claseNav}>
            Historial
          </NavLink>
          <NavLink to="/movimientos/nuevo" className={claseNav}>
            Nuevo movimiento
          </NavLink>
          <NavLink to="/proveedores" className={claseNav}>
            Proveedores
          </NavLink>
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
        <Outlet />
      </main>
    </div>
  );
}
