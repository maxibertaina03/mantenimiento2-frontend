import { NavLink, Outlet } from 'react-router-dom';

const claseNav = ({ isActive }: { isActive: boolean }) => (isActive ? 'activo' : '');

/** Estructura general: sidebar de navegación + área de contenido. */
export function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
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
      </aside>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
