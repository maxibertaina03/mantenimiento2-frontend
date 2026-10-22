import {
  ArrowRight,
  CircleAlert,
  Factory,
  ListTodo,
  Package,
  Send,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCoberturaAlertas, useMaterialesBajoStock } from '@/api/materiales';
import { useOrdenes } from '@/api/ordenesCompra';
import { useOrdenesTrabajo } from '@/api/ordenesTrabajo';
import { usePendientes } from '@/api/pendientes';
import { usePlanesQueVencen, useResumenEquipos } from '@/api/equipos';
import { Cargando } from '@/componentes/Estados';
import { textoVencimiento } from '@/componentes/PlanesEquipo';
import { formatearFechaSola, formatearNumero } from '@/lib/formato';
import { ETIQUETA_ESTADO_EQUIPO } from '@/tipos/equipo';
import { MisTareasDeHoy } from '@/componentes/MisTareasDeHoy';
import { P, usePuede } from '@/lib/permisos';

/** Cuántas filas se listan antes de mandar a la pantalla completa. */
const MAXIMO_EN_LISTA = 6;

/** Los estados que significan que el equipo no está trabajando. */
const NO_OPERATIVOS = ['EN_REPARACION', 'FUERA_DE_SERVICIO'] as const;

type Clave =
  | 'parados'
  | 'servicios'
  | 'pendientes'
  | 'talleres'
  | 'reponer'
  | 'llegar'
  | 'sinEnviar';

/** El color de cada tarjeta dice qué tan urgente es, antes de leer el número. */
type Tono = 'rojo' | 'ambar' | 'azul' | 'verde' | 'gris' | 'violeta';

const ICONO: Record<Clave, LucideIcon> = {
  parados: CircleAlert,
  servicios: Wrench,
  pendientes: ListTodo,
  talleres: Factory,
  reponer: Package,
  llegar: Truck,
  sinEnviar: Send,
};

/** «martes 20 de octubre», para que la pantalla diga de qué día habla. */
function hoyEnPalabras(): string {
  const texto = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Una tarjeta de arriba, y lo que se despliega al tocarla. */
interface Tarjeta {
  clave: Clave;
  /** El número grande. */
  cuantos: number;
  titulo: string;
  /** Una línea chica debajo del número, cuando dice algo más. */
  detalle?: string;
  /** Pide atención: se pinta distinto. */
  urgente?: boolean;
  tono: Tono;
  /** La lista que se despliega abajo. */
  contenido: ReactNode;
  /** A dónde lleva «Ver todo». */
  ir: { a: string; texto: string };
}

/**
 * Qué hay que hacer hoy.
 *
 * Arriba lo que le toca a cada uno. Debajo, una tarjeta por cada cosa
 * pendiente —equipos parados, services, talleres, reponer, mercadería, órdenes
 * sin enviar— con su número; tocando una se despliega su lista. Antes eran
 * seis bloques uno abajo del otro y para llegar al último había que bajar
 * varias pantallas: así se ve todo de un vistazo, en la compu y en el celular.
 *
 * Las tarjetas en cero no se muestran: ocupan lugar para no decir nada.
 *
 * El aviso de lo que el sistema NO puede saber (materiales sin mínimo,
 * equipos sin plan) sigue estando, plegado al pie. Sin eso, la pantalla podría
 * decir "no hay nada pendiente" mientras media planta está sin cubrir.
 */
export function InicioPage() {
  // Antes esto era "sos administrador". Con cuatro roles no alcanza: gerencia
  // ve los services y no ve usuarios.
  const puede = usePuede();
  const veServicios = puede(P.SERVICIOS_VER);
  const veEquipos = puede(P.EQUIPOS_VER);
  const veTrabajos = puede(P.TRABAJOS_VER);
  const vePendientes = puede(P.PENDIENTES_VER);
  /** La tarjeta abierta. `null`: la primera; 'ninguna': se cerró a propósito. */
  const [abierta, setAbierta] = useState<Clave | 'ninguna' | null>(null);

  const bajoStock = useMaterialesBajoStock();
  const cobertura = useCoberturaAlertas();
  const emitidas = useOrdenes(1, MAXIMO_EN_LISTA, '', 'EMITIDA');
  // Una orden recibida en parte también espera mercadería: lo que falta.
  const enParte = useOrdenes(1, MAXIMO_EN_LISTA, '', 'RECIBIDA_PARCIAL');
  const borradores = useOrdenes(1, MAXIMO_EN_LISTA, '', 'BORRADOR');
  // Equipos es solo para admins: a un operario el pedido le daría 403.
  const servicios = usePlanesQueVencen(7, veServicios);
  const equipos = useResumenEquipos(veEquipos);
  // El anotador de mantenimiento: lo que quedó por hacer, urgentes primero.
  const anotados = usePendientes('abiertos', vePendientes);
  // Lo que está en un taller de afuera: hay que acordarse de ir a buscarlo.
  const talleres = useOrdenesTrabajo(
    1,
    MAXIMO_EN_LISTA,
    { estado: 'ABIERTA', ejecutor: 'EXTERNO' },
    veTrabajos,
  );

  if (bajoStock.isLoading || emitidas.isLoading) return <Cargando />;

  const faltantes = bajoStock.data ?? [];
  const porRecibir = [...(enParte.data?.datos ?? []), ...(emitidas.data?.datos ?? [])];
  const totalPorRecibir = (emitidas.data?.total ?? 0) + (enParte.data?.total ?? 0);
  const sinEnviar = borradores.data?.datos ?? [];
  const vencen = servicios.data ?? [];
  const vencidos = vencen.filter((p) => p.estado === 'VENCIDO').length;
  const afuera = talleres.data?.datos ?? [];
  const pendientes = anotados.data ?? [];
  const pendientesUrgentes = pendientes.filter((p) => p.urgente).length;

  const parados = NO_OPERATIVOS.map((estado) => ({
    estado,
    cuantos: equipos.data?.porEstado[estado] ?? 0,
  })).filter((x) => x.cuantos > 0);
  const totalParados = parados.reduce((suma, x) => suma + x.cuantos, 0);

  // En orden de urgencia: lo parado frena la producción; lo sin enviar, nada todavía.
  const tarjetas: Tarjeta[] = ([
    {
      clave: 'parados' as const,
      cuantos: totalParados,
      titulo: 'Equipos parados',
      urgente: true,
      tono: 'rojo',
      ir: { a: '/equipos', texto: 'Ver los equipos' },
      contenido: (
        <ul className="lista-inicio">
          {parados.map((x) => (
            <li key={x.estado}>
              <Link to={`/equipos?estado=${x.estado}`}>
                {ETIQUETA_ESTADO_EQUIPO[x.estado] ?? x.estado}
              </Link>
              <span className="texto-suave">
                {x.cuantos} de {equipos.data?.total ?? 0} equipos
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      clave: 'servicios' as const,
      cuantos: veServicios ? vencen.length : 0,
      titulo: 'Mantenimiento',
      detalle: vencidos > 0 ? `${vencidos} vencidos` : 'por vencer',
      urgente: vencidos > 0,
      tono: vencidos > 0 ? 'rojo' : 'ambar',
      ir: { a: '/servicios', texto: 'Ver todos los servicios' },
      contenido: (
        <ul className="lista-inicio">
          {vencen.slice(0, MAXIMO_EN_LISTA).map((p) => (
            <li key={p.id}>
              <Link to={`/equipos/${p.equipoId}`}>{p.equipoNombre}</Link>
              <span className="texto-suave">
                {p.nombre}, {textoVencimiento(p.diasParaVencer)}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      clave: 'pendientes' as const,
      cuantos: pendientes.length,
      titulo: 'Pendientes',
      detalle: pendientesUrgentes === 1
          ? '1 urgente'
          : pendientesUrgentes > 1
            ? `${pendientesUrgentes} urgentes`
            : 'anotados',
      urgente: pendientesUrgentes > 0,
      tono: 'azul',
      ir: { a: '/pendientes', texto: 'Ver todos los pendientes' },
      contenido: (
        <ul className="lista-inicio">
          {pendientes.slice(0, MAXIMO_EN_LISTA).map((p) => (
            <li key={p.id}>
              <Link to="/pendientes">{p.texto}</Link>
              <span className="texto-suave">
                {p.urgente ? 'urgente · ' : ''}
                {p.asignadoANombre ?? 'a cualquiera'}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      clave: 'talleres' as const,
      cuantos: talleres.data?.total ?? afuera.length,
      titulo: 'En talleres externos',
      tono: 'violeta',
      ir: { a: '/ordenes-trabajo?afuera=1', texto: 'Ver las órdenes' },
      contenido: (
        <ul className="lista-inicio">
          {afuera.map((o) => (
            <li key={o.id}>
              {o.equipoId ? (
                <Link to={`/equipos/${o.equipoId}`}>{o.equipoNombre}</Link>
              ) : (
                <Link to="/ordenes-trabajo?afuera=1">{o.equipoItNombre ?? o.numero}</Link>
              )}
              <span className="texto-suave">
                en {o.proveedorNombre ?? 'un taller'} desde el {formatearFechaSola(o.abiertaEn)} ·{' '}
                {o.titulo}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      clave: 'reponer' as const,
      cuantos: faltantes.length,
      titulo: 'Hay que reponer',
      detalle: 'bajo el mínimo',
      tono: 'ambar',
      ir: { a: '/materiales', texto: `Ver los ${faltantes.length} materiales` },
      contenido: (
        <ul className="lista-inicio">
          {faltantes.slice(0, MAXIMO_EN_LISTA).map((m) => (
            <li key={m.id}>
              <Link to={`/materiales/${m.id}`}>{m.nombre}</Link>
              <span className="texto-suave">
                quedan {formatearNumero(m.stockActual)} {m.unidad} de{' '}
                {formatearNumero(m.stockMinimo)}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      clave: 'llegar' as const,
      cuantos: totalPorRecibir || porRecibir.length,
      titulo: 'Mercadería por llegar',
      tono: 'verde',
      ir: { a: '/ordenes-compra', texto: 'Ir a órdenes de compra' },
      contenido: (
        <ul className="lista-inicio">
          {porRecibir.map((o) => (
            <li key={o.id}>
              <Link to="/ordenes-compra">{o.numero}</Link>
              <span className="texto-suave">
                {o.proveedorNombre ?? 'sin proveedor'}
                {o.estado === 'RECIBIDA_PARCIAL' && ' · llegó una parte'}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      // Una orden en borrador es trabajo empezado que nadie terminó: el
      // proveedor todavía no se enteró de que existe.
      clave: 'sinEnviar' as const,
      cuantos: borradores.data?.total ?? sinEnviar.length,
      titulo: 'Órdenes sin enviar',
      tono: 'gris',
      ir: { a: '/ordenes-compra', texto: 'Ir a órdenes de compra' },
      contenido: (
        <>
          <ul className="lista-inicio">
            {sinEnviar.map((o) => (
              <li key={o.id}>
                <Link to="/ordenes-compra">{o.numero}</Link>
                <span className="texto-suave">{o.proveedorNombre ?? 'sin proveedor'}</span>
              </li>
            ))}
          </ul>
          <p className="texto-suave texto-chico">
            Están armadas pero el proveedor todavía no las recibió.
          </p>
        </>
      ),
    },
  ] satisfies Tarjeta[]).filter((t) => t.cuantos > 0);

  const claveAbierta = abierta === null ? tarjetas[0]?.clave : abierta;
  const actual = tarjetas.find((t) => t.clave === claveAbierta);

  // Los huecos de carga que dejan al sistema sin poder avisar.
  const sinMinimo = cobertura.data?.sinMinimo ?? 0;
  const sinPlan = equipos.data?.sinPlan ?? 0;
  const hayHuecos = sinMinimo > 0 || (veEquipos && sinPlan > 0);

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Hoy</h1>
          <p>{hoyEnPalabras()}</p>
        </div>
      </div>

      {/* En el celular va todo en columna, en este orden: primero lo que le
          toca a uno, que es el aviso de verdad (el correo puede rebotar, esto
          se ve siempre que alguien entre). En la compu, las tarjetas arriba a
          lo ancho y debajo las tareas al lado del detalle. */}
      <div className="hoy">
        <div className="hoy-tareas">
          <MisTareasDeHoy />
        </div>

        {tarjetas.length === 0 ? (
          <div className="panel hoy-detalle">
            <p style={{ margin: 0 }}>
              No hay nada pendiente: ningún equipo parado, ningún material bajo su mínimo y
              ninguna orden esperando
              {veServicios && ', y ningún service por vencer'}.
            </p>
          </div>
        ) : (
          <>
            <div className="tarjetas-hoy">
              {tarjetas.map((t) => {
                const Icono = ICONO[t.clave];
                return (
                  <button
                    key={t.clave}
                    type="button"
                    className={[
                      'tarjeta-hoy',
                      `tono-${t.tono}`,
                      t.urgente ? 'tarjeta-hoy-urgente' : '',
                      t.clave === claveAbierta ? 'activa' : '',
                    ].join(' ')}
                    aria-expanded={t.clave === claveAbierta}
                    onClick={() => setAbierta(t.clave === claveAbierta ? 'ninguna' : t.clave)}
                  >
                    <span className="tarjeta-hoy-icono" aria-hidden>
                      <Icono />
                    </span>
                    <span className="tarjeta-hoy-textos">
                      <span className="tarjeta-hoy-numero">{t.cuantos}</span>
                      <span className="tarjeta-hoy-titulo">{t.titulo}</span>
                      {t.detalle && <span className="tarjeta-hoy-detalle">{t.detalle}</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {actual && (
              <section className="panel panel-lista detalle-hoy hoy-detalle">
                <div className="panel-cabecera">
                  <h2>{actual.titulo}</h2>
                </div>
                {actual.contenido}
                <div className="panel-pie">
                  <Link to={actual.ir.a} className="enlace-flecha">
                    {actual.ir.texto} <ArrowRight className="icono" aria-hidden />
                  </Link>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {hayHuecos && (
        <details className="panel panel-aviso huecos-hoy">
          <summary>
            <b>De esto el sistema todavía no te puede avisar</b>
          </summary>
          <ul className="lista-huecos">
            {sinMinimo > 0 && (
              <li>
                <b>
                  {sinMinimo} de {cobertura.data?.enUso} materiales
                </b>{' '}
                no tienen stock mínimo cargado, así que pueden llegar a cero sin que aparezcan
                arriba. Se carga desde la ficha de cada material.
              </li>
            )}
            {veEquipos && sinPlan > 0 && (
              <li>
                <b>
                  {sinPlan} de {equipos.data?.total} equipos
                </b>{' '}
                no tienen ningún plan de mantenimiento, así que nunca van a generar un aviso. Se
                define desde la ficha de cada equipo.
              </li>
            )}
          </ul>
        </details>
      )}
    </>
  );
}
