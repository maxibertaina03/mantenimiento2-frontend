import { UserButton } from '@clerk/clerk-react';
import {
  CalendarDays,
  ChartColumn,
  ChevronDown,
  ClipboardCheck,
  Factory,
  History,
  House,
  KeyRound,
  ListTodo,
  MapPin,
  Menu,
  MessageSquareWarning,
  Monitor,
  MoreHorizontal,
  Package,
  PackagePlus,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BannerServidor } from './Estados';
import { useContadorSolicitudes } from '@/api/solicitudes';
import { P, usePuede, type Permiso } from '@/lib/permisos';
import { PanelLogo } from './PanelLogo';
import { VersionSistema } from './VersionSistema';

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
  /** Se esconde si el rol tiene este permiso (ej.: un acceso que es solo para un sector). */
  ocultarCon?: Permiso;
  /** Lleva al lado cuántas solicitudes hay sin revisar. */
  contador?: boolean;
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
        a: '/solicitudes',
        texto: 'Solicitudes',
        Icono: MessageSquareWarning,
        permiso: P.SOLICITUDES_CREAR,
        contador: true,
      },
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
      { a: '/sectores', texto: 'Sectores', Icono: MapPin, permiso: P.TRABAJOS_VER },
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
    titulo: 'Informes',
    opciones: [
      { a: '/informes', texto: 'Informes', Icono: ChartColumn, permiso: P.INFORMES_VER },
      // Sin permiso: cada uno ve lo suyo.
      { a: '/mis-resultados', texto: 'Mis resultados', Icono: TrendingUp },
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
  // Para un sector, que no tiene calendario ni pañol: sus solicitudes a mano.
  {
    a: '/solicitudes',
    texto: 'Solicitudes',
    Icono: MessageSquareWarning,
    permiso: P.SOLICITUDES_CREAR,
    ocultarCon: P.TAREAS_VER,
  },
];

/** El número de solicitudes sin revisar, para quien las revisa. */
function ContadorSolicitudes() {
  const puede = usePuede();
  const { data } = useContadorSolicitudes(puede(P.SOLICITUDES_VER));
  if (!data?.nuevas) return null;
  return (
    <span
      className={`contador-pestana${data.urgentes > 0 ? ' contador-pestana-alerta' : ''}`}
      title={
        data.urgentes > 0
          ? `${data.nuevas} sin revisar, ${data.urgentes} urgente(s)`
          : `${data.nuevas} sin revisar`
      }
    >
      {data.nuevas}
    </span>
  );
}

const CLAVE_MENU = 'menu-secciones-abiertas';

/** Las secciones que la persona dejó abiertas, recordadas en este navegador. */
function leerAbiertas(): Set<string> {
  try {
    const guardado = localStorage.getItem(CLAVE_MENU);
    return new Set(guardado ? (JSON.parse(guardado) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** La sección de la pantalla en la que se está: siempre arranca abierta. */
function seccionDe(ruta: string): string | null {
  return (
    GRUPOS.find((g) =>
      g.opciones.some((o) => ruta === o.a || ruta.startsWith(`${o.a}/`)),
    )?.titulo ?? null
  );
}

/** Estructura general: menú lateral + área de contenido.
 *  En celular el menú se vuelve un cajón deslizable (hamburguesa). */
export function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrar = () => setMenuAbierto(false);
  const puede = usePuede();
  const { pathname } = useLocation();

  // Cada sección (Pañol, Mantenimiento, Compras…) se abre y se cierra tocando
  // su título. La de la pantalla actual se abre sola; las demás quedan como
  // las dejó la persona.
  const [abiertas, setAbiertas] = useState<Set<string>>(() => {
    const guardadas = leerAbiertas();
    const actual = seccionDe(pathname);
    if (actual) guardadas.add(actual);
    return guardadas;
  });
  useEffect(() => {
    const actual = seccionDe(pathname);
    if (actual) setAbiertas((a) => (a.has(actual) ? a : new Set(a).add(actual)));
  }, [pathname]);
  const alternar = (titulo: string) =>
    setAbiertas((a) => {
      const nuevas = new Set(a);
      if (nuevas.has(titulo)) nuevas.delete(titulo);
      else nuevas.add(titulo);
      try {
        localStorage.setItem(CLAVE_MENU, JSON.stringify([...nuevas]));
      } catch {
        // Sin almacenamiento (navegación privada): se recuerda solo mientras dura.
      }
      return nuevas;
    });

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
            const visibles = opciones.filter(
              (o) => (!o.permiso || puede(o.permiso)) && !(o.ocultarCon && puede(o.ocultarCon)),
            );
            if (visibles.length === 0) return null;
            const abierta = !titulo || abiertas.has(titulo);
            const idOpciones = `menu-${(titulo ?? 'inicio').toLowerCase().replace(/\W+/g, '-')}`;
            return (
              <div key={titulo ?? 'inicio'} role="group" aria-label={titulo ?? 'Inicio'}>
                {titulo && (
                  <button
                    type="button"
                    className={`grupo-menu grupo-menu-boton${abierta ? ' abierta' : ''}`}
                    aria-expanded={abierta}
                    aria-controls={idOpciones}
                    // En el celular, tocar el nav cierra el cajón: el título no.
                    onClick={(e) => {
                      e.stopPropagation();
                      alternar(titulo);
                    }}
                  >
                    <span>{titulo}</span>
                    {/* Cerrada, igual se ve si hay solicitudes sin revisar. */}
                    {!abierta && visibles.some((o) => o.contador) && <ContadorSolicitudes />}
                    <ChevronDown className="icono grupo-menu-flecha" aria-hidden />
                  </button>
                )}
                {abierta && (
                  <div id={idOpciones}>
                    {visibles.map(({ a, texto, Icono, exacta, contador }) => (
                      <NavLink key={a} to={a} end={exacta} className={claseNav}>
                        <Icono className="icono" aria-hidden />
                        {texto}
                        {contador && <ContadorSolicitudes />}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        {authActiva && (
          <div className="sesion-lateral">
            <UserButton showName />
          </div>
        )}
        <VersionSistema />
      </aside>

      {/* Fondo oscuro para cerrar el menú en celular */}
      {menuAbierto && <div className="overlay" onClick={cerrar} />}

      <main className="contenido">
        {/* Arranque en frio del backend: visible en cualquier pantalla. */}
        <BannerServidor />
        <Outlet />
      </main>

      <nav className="barra-inferior" aria-label="Accesos rápidos">
        {BARRA_INFERIOR.filter(
          (o) => (!o.permiso || puede(o.permiso)) && !(o.ocultarCon && puede(o.ocultarCon)),
        ).map(
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
