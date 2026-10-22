import { UserButton } from '@clerk/clerk-react';
import {
  CalendarDays,
  ClipboardCheck,
  Factory,
  History,
  House,
  KeyRound,
  ListTodo,
  Menu,
  MoreHorizontal,
  Monitor,
  Package,
  PackagePlus,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BannerServidor } from './Estados';
import { P, usePuede, type Permiso } from '@/lib/permisos';
import { PanelLogo } from './PanelLogo';

const claseNav = ({ isActive }: { isActive: boolean }) => (isActive ? 'activo' : '');

// Solo mostramos el control de sesión si Clerk está configurado.
const authActiva = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

interface Opcion {
  a: string;
  texto: string;
  Icono: LucideIcon;
  /** Sin permiso, la opción no se ofrece. */
  permiso?: Permiso;
  /** Solo se marca activa en esa dirección exacta, no en las de abajo. */
  exacta?: boolean;
}

/**
 * El menú, agrupado por área. Antes eran quince opciones sueltas y costaba
 * encontrar las cosas; ahora cada una está donde se la busca.
 *
 * Muestra solo lo que el rol puede usar: el servidor igual lo bloquea, pero
 * ofrecer una sección que va a dar 403 en cada consulta solo confunde. Un
 * grupo sin ninguna opción visible no se muestra.
 */
const GRUPOS: { titulo: string | null; opciones: Opcion[] }[] = [
  { titulo: null, opciones: [{ a: '/inicio', texto: 'Hoy', Icono: House }] },
  {
    titulo: 'Pañol',
    opciones: [
      { a: '/materiales', texto: 'Materiales', Icono: Package, permiso: P.MATERIALES_VER },
      {
        a: '/movimientos',
        texto: 'Historial',
        Icono: History,
        permiso: P.MOVIMIENTOS_VER,
        exacta: true,
      },
      {
        a: '/movimientos/nuevo',
        texto: 'Nuevo movimiento',
        Icono: PackagePlus,
        permiso: P.MOVIMIENTOS_CREAR,
      },
      {
        a: '/inventario',
        texto: 'Toma de inventario',
        Icono: ClipboardCheck,
        permiso: P.INVENTARIO_VER,
      },
    ],
  },
  {
    titulo: 'Mantenimiento',
    opciones: [
      { a: '/calendario', texto: 'Calendario', Icono: CalendarDays, permiso: P.TAREAS_VER },
      { a: '/pendientes', texto: 'Pendientes', Icono: ListTodo, permiso: P.PENDIENTES_VER },
      {
        a: '/ordenes-trabajo',
        texto: 'Órdenes de trabajo',
        Icono: Wrench,
        permiso: P.TRABAJOS_VER,
      },
      {
        a: '/equipos',
        texto: 'Equipos y herramientas',
        Icono: Factory,
        permiso: P.EQUIPOS_VER,
      },
      { a: '/servicios', texto: 'Servicios', Icono: Settings2, permiso: P.SERVICIOS_VER },
    ],
  },
  {
    titulo: 'Compras',
    opciones: [
      {
        a: '/ordenes-compra',
        texto: 'Órdenes de compra',
        Icono: ShoppingCart,
        permiso: P.ORDENES_VER,
      },
      { a: '/proveedores', texto: 'Proveedores', Icono: Truck, permiso: P.PROVEEDORES_VER },
    ],
  },
  {
    titulo: 'Informática',
    opciones: [
      { a: '/equipos-it', texto: 'Equipos IT', Icono: Monitor, permiso: P.IT_VER },
      {
        a: '/credenciales',
        texto: 'Contraseñas',
        Icono: KeyRound,
        permiso: P.CREDENCIALES_VER,
      },
    ],
  },
  {
    titulo: 'Administración',
    opciones: [
      { a: '/usuarios', texto: 'Usuarios', Icono: Users, permiso: P.USUARIOS_ADMINISTRAR },
      {
        a: '/permisos',
        texto: 'Permisos',
        Icono: ShieldCheck,
        permiso: P.PERMISOS_ADMINISTRAR,
      },
    ],
  },
];

/**
 * La barra de abajo del celular: lo que se usa todos los días, a un toque y
 * con el pulgar. «Más» abre el menú completo. Cada acceso aparece solo si el
 * rol lo puede usar.
 */
const BARRA_INFERIOR: Opcion[] = [
  { a: '/inicio', texto: 'Hoy', Icono: House },
  { a: '/materiales', texto: 'Materiales', Icono: Package, permiso: P.MATERIALES_VER },
  {
    a: '/movimientos/nuevo',
    texto: 'Cargar',
    Icono: PackagePlus,
    permiso: P.MOVIMIENTOS_CREAR,
  },
  { a: '/calendario', texto: 'Calendario', Icono: CalendarDays, permiso: P.TAREAS_VER },
];

/** Estructura general: menú lateral + área de contenido.
 *  En celular el menú se vuelve un cajón deslizable (hamburguesa). */
export function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrar = () => setMenuAbierto(false);
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
          <Menu className="icono" aria-hidden />
        </button>
        <span className="marca">
          <PanelLogo alto={26} className="panel-logo-chico" ampliable={false} />
          Mantenimiento
        </span>
      </div>

      <aside className={`sidebar ${menuAbierto ? 'abierta' : ''}`}>
        <div className="marca marca-lateral">
          <PanelLogo alto={30} className="panel-logo-chico" />
          <span>
            <b>Mantenimiento</b>
            <small>Lácteos Las Tres</small>
          </span>
        </div>
        <nav onClick={cerrar}>
          {GRUPOS.map(({ titulo, opciones }) => {
            const visibles = opciones.filter((o) => !o.permiso || puede(o.permiso));
            if (visibles.length === 0) return null;
            return (
              <div key={titulo ?? 'inicio'} role="group" aria-label={titulo ?? 'Inicio'}>
                {titulo && <div className="grupo-menu">{titulo}</div>}
                {visibles.map(({ a, texto, Icono, exacta }) => (
                  <NavLink key={a} to={a} end={exacta} className={claseNav}>
                    <Icono className="icono" aria-hidden />
                    {texto}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        {authActiva && (
          <div className="sesion-lateral">
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

      <nav className="barra-inferior" aria-label="Accesos rápidos">
        {BARRA_INFERIOR.filter((o) => !o.permiso || puede(o.permiso)).map(
          ({ a, texto, Icono }) => (
            <NavLink key={a} to={a} className={claseNav}>
              <Icono className="icono" aria-hidden />
              {texto}
            </NavLink>
          ),
        )}
        <button
          type="button"
          className={menuAbierto ? 'activo' : ''}
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label="Más opciones del menú"
        >
          <MoreHorizontal className="icono" aria-hidden />
          Más
        </button>
      </nav>
    </div>
  );
}
