import { UserButton } from '@clerk/clerk-react';
import { NavLink, Outlet } from 'react-router-dom';

const claseNav = ({ isActive }: { isActive: boolean }) => (isActive ? 'activo' : '');

// Solo mostramos el control de sesión si Clerk está configurado.
const authActiva = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

/** Estructura general: sidebar de navegación + área de contenido. */
export function Layout() {
  return (
    <div className="app">
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="marca">🔧 Mantenimiento</div>
        <nav>
          <NavLink to="/materiales" className={claseNav}>
            Materiales
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
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
