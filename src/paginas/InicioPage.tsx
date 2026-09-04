import { Link } from 'react-router-dom';
import { useCoberturaAlertas, useMaterialesBajoStock } from '@/api/materiales';
import { useOrdenes } from '@/api/ordenesCompra';
import { usePlanesQueVencen, useResumenEquipos } from '@/api/equipos';
import { useUsuarioActual } from '@/api/usuarios';
import { Cargando } from '@/componentes/Estados';
import { textoVencimiento } from '@/componentes/PlanesEquipo';
import { formatearNumero } from '@/lib/formato';
import { ETIQUETA_ESTADO_EQUIPO } from '@/tipos/equipo';

/** Cuántas filas se listan antes de mandar a la pantalla completa. */
const MAXIMO_EN_LISTA = 6;

/** Los estados que significan que el equipo no está trabajando. */
const NO_OPERATIVOS = ['EN_REPARACION', 'FUERA_DE_SERVICIO'] as const;

/**
 * Qué hay que hacer hoy.
 *
 * La pantalla de entrada era el listado de 911 materiales, que no contesta
 * ninguna pregunta: hay que saber de antemano qué buscar. Esta contesta cuatro,
 * en el orden en que importan al abrir el sistema a la mañana: qué está parado,
 * qué service vence, qué falta reponer y qué quedó a medio hacer.
 *
 * No repite lo que hacen las otras pantallas: cada bloque muestra las primeras
 * filas y lleva a la vista completa, que es donde están los filtros.
 *
 * El último bloque es distinto y es el que más importa: dice de qué NO puede
 * avisar el sistema porque le falta el dato cargado. Sin eso, la pantalla puede
 * decir "no hay nada pendiente" mientras media planta está sin cubrir, y eso
 * sería peor que no tener la pantalla.
 */
export function InicioPage() {
  const { data: usuario } = useUsuarioActual();
  const esAdmin = usuario?.rol === 'ADMIN';

  const bajoStock = useMaterialesBajoStock();
  const cobertura = useCoberturaAlertas();
  const emitidas = useOrdenes(1, MAXIMO_EN_LISTA, '', 'EMITIDA');
  const borradores = useOrdenes(1, MAXIMO_EN_LISTA, '', 'BORRADOR');
  // Equipos es solo para admins: a un operario el pedido le daría 403.
  const servicios = usePlanesQueVencen(7, esAdmin);
  const equipos = useResumenEquipos(esAdmin);

  if (bajoStock.isLoading || emitidas.isLoading) return <Cargando />;

  const faltantes = bajoStock.data ?? [];
  const porRecibir = emitidas.data?.datos ?? [];
  const sinEnviar = borradores.data?.datos ?? [];
  const vencen = servicios.data ?? [];
  const vencidos = vencen.filter((p) => p.estado === 'VENCIDO').length;

  const parados = NO_OPERATIVOS.map((estado) => ({
    estado,
    cuantos: equipos.data?.porEstado[estado] ?? 0,
  })).filter((x) => x.cuantos > 0);
  const totalParados = parados.reduce((suma, x) => suma + x.cuantos, 0);

  const nadaQueHacer =
    faltantes.length === 0 &&
    porRecibir.length === 0 &&
    sinEnviar.length === 0 &&
    vencen.length === 0 &&
    totalParados === 0;

  // Los huecos de carga que dejan al sistema sin poder avisar.
  const sinMinimo = cobertura.data?.sinMinimo ?? 0;
  const sinPlan = equipos.data?.sinPlan ?? 0;
  const hayHuecos = sinMinimo > 0 || sinPlan > 0;

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Hoy</h1>
      </div>

      {nadaQueHacer && (
        <div className="panel">
          <p style={{ margin: 0 }}>
            No hay nada pendiente: ningún equipo parado, ningún material bajo su mínimo y ninguna
            orden esperando
            {esAdmin && ', y ningún service por vencer'}.
          </p>
        </div>
      )}

      {/* Primero lo que está parado: es lo único que frena la producción. */}
      {totalParados > 0 && (
        <div className="panel">
          <div className="cabecera-bloque">
            <h2>Equipos parados</h2>
            <span className="badge badge-bajo">{totalParados}</span>
          </div>
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
          <Link to="/equipos">Ver los equipos →</Link>
        </div>
      )}

      {esAdmin && vencen.length > 0 && (
        <div className="panel">
          <div className="cabecera-bloque">
            <h2>Mantenimiento</h2>
            {vencidos > 0 && <span className="badge badge-bajo">{vencidos} vencidos</span>}
          </div>
          <ul className="lista-inicio">
            {vencen.slice(0, MAXIMO_EN_LISTA).map((p) => (
              <li key={p.id}>
                <Link to={`/equipos?equipo=${p.equipoId}`}>{p.equipoNombre}</Link>
                <span className="texto-suave">
                  {p.nombre}, {textoVencimiento(p.diasParaVencer)}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/servicios">Ver todos los servicios →</Link>
        </div>
      )}

      {faltantes.length > 0 && (
        <div className="panel">
          <div className="cabecera-bloque">
            <h2>Hay que reponer</h2>
            <span className="badge badge-bajo">{faltantes.length}</span>
          </div>
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
          {faltantes.length > MAXIMO_EN_LISTA && (
            <Link to="/materiales">Ver los {faltantes.length} materiales →</Link>
          )}
        </div>
      )}

      {porRecibir.length > 0 && (
        <div className="panel">
          <div className="cabecera-bloque">
            <h2>Mercadería por llegar</h2>
            <span className="badge">{emitidas.data?.total ?? porRecibir.length}</span>
          </div>
          <ul className="lista-inicio">
            {porRecibir.map((o) => (
              <li key={o.id}>
                <Link to="/ordenes-compra">{o.numero}</Link>
                <span className="texto-suave">{o.proveedorNombre ?? 'sin proveedor'}</span>
              </li>
            ))}
          </ul>
          <Link to="/ordenes-compra">Ir a órdenes de compra →</Link>
        </div>
      )}

      {/* Una orden en borrador es trabajo empezado que nadie terminó: el
          proveedor todavía no se enteró de que existe. */}
      {sinEnviar.length > 0 && (
        <div className="panel">
          <div className="cabecera-bloque">
            <h2>Órdenes sin enviar</h2>
            <span className="badge">{borradores.data?.total ?? sinEnviar.length}</span>
          </div>
          <ul className="lista-inicio">
            {sinEnviar.map((o) => (
              <li key={o.id}>
                <Link to="/ordenes-compra">{o.numero}</Link>
                <span className="texto-suave">{o.proveedorNombre ?? 'sin proveedor'}</span>
              </li>
            ))}
          </ul>
          <p className="texto-suave texto-chico" style={{ marginBottom: 0 }}>
            Están armadas pero el proveedor todavía no las recibió.
          </p>
        </div>
      )}

      {hayHuecos && (
        <div className="panel panel-aviso">
          <b>De esto el sistema todavía no te puede avisar</b>
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
            {esAdmin && sinPlan > 0 && (
              <li>
                <b>
                  {sinPlan} de {equipos.data?.total} equipos
                </b>{' '}
                no tienen ningún plan de mantenimiento, así que nunca van a generar un aviso. Se
                define desde la ficha de cada equipo.
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}
