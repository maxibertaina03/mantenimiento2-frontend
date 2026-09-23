import { UserButton } from '@clerk/clerk-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BannerServidor } from './Estados';
import { P, usePuede } from '@/lib/permisos';
import { PanelLogo } from './PanelLogo';

const claseNav = ({ isActive }: { isActive: boolean }) => (isActive ? 'activo' : '');

// Solo mostramos el control de sesión si Clerk está configurado.
const authActiva = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

/** Estructura general: sidebar de navegación + área de contenido.
 *  En celular la barra lateral se vuelve un cajón deslizable (hamburguesa). */
export function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrar = () => setMenuAbierto(false);

  // El menu muestra solo lo que el rol puede usar. El servidor igual lo
  // bloquea; esto es para no ofrecer una seccion que va a dar 403 en cada
  // consulta.
  const puede = usePuede();

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
          {/* El menú muestra solo lo que el rol puede usar. Antes se partía en
              dos por el rol de administrador, y eso no alcanzaba para cuatro
              roles: gerencia ve equipos y no ve usuarios. */}
          <NavLink to="/inicio" className={claseNav}>
            Hoy
          </NavLink>
          {puede(P.MATERIALES_VER) && (
            <NavLink to="/materiales" className={claseNav}>
              Materiales
            </NavLink>
          )}
          {puede(P.MOVIMIENTOS_VER) && (
            <NavLink to="/movimientos" end className={claseNav}>
              Historial
            </NavLink>
          )}
          {puede(P.MOVIMIENTOS_CREAR) && (
            <NavLink to="/movimientos/nuevo" className={claseNav}>
              Nuevo movimiento
            </NavLink>
          )}
          {puede(P.TAREAS_VER) && (
            <NavLink to="/calendario" className={claseNav}>
              Calendario
            </NavLink>
          )}
          {puede(P.TRABAJOS_VER) && (
            <NavLink to="/ordenes-trabajo" className={claseNav}>
              Órdenes de trabajo
            </NavLink>
          )}
          {puede(P.ORDENES_VER) && (
            <NavLink to="/ordenes-compra" className={claseNav}>
              Órdenes de compra
            </NavLink>
          )}
          {puede(P.PROVEEDORES_VER) && (
            <NavLink to="/proveedores" className={claseNav}>
              Proveedores
            </NavLink>
          )}
          {puede(P.EQUIPOS_VER) && (
            <NavLink to="/equipos" className={claseNav}>
              Equipos
            </NavLink>
          )}
          {puede(P.SERVICIOS_VER) && (
            <NavLink to="/servicios" className={claseNav}>
              Servicios
            </NavLink>
          )}
          {puede(P.IT_VER) && (
            <NavLink to="/equipos-it" className={claseNav}>
              Equipos IT
            </NavLink>
          )}
          {puede(P.CREDENCIALES_VER) && (
            <NavLink to="/credenciales" className={claseNav}>
              🔐 Contraseñas
            </NavLink>
          )}
          {puede(P.USUARIOS_ADMINISTRAR) && (
            <NavLink to="/usuarios" className={claseNav}>
              Usuarios
            </NavLink>
          )}
          {puede(P.PERMISOS_ADMINISTRAR) && (
            <NavLink to="/permisos" className={claseNav}>
              Permisos
            </NavLink>
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
