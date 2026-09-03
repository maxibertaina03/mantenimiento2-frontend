import { Link } from 'react-router-dom';
import { useCoberturaAlertas, useMaterialesBajoStock } from '@/api/materiales';
import { useOrdenes } from '@/api/ordenesCompra';
import { usePlanesQueVencen } from '@/api/equipos';
import { useUsuarioActual } from '@/api/usuarios';
import { Cargando } from '@/componentes/Estados';
import { textoVencimiento } from '@/componentes/PlanesEquipo';
import { formatearNumero } from '@/lib/formato';

/** Cuántas filas se listan antes de mandar a la pantalla completa. */
const MAXIMO_EN_LISTA = 6;

/**
 * Qué hay que hacer hoy.
 *
 * La pantalla de entrada era el listado de 920 materiales, que no contesta
 * ninguna pregunta: hay que saber de antemano qué buscar. Lo que la mayoría
 * necesita al abrir el sistema es qué falta reponer, qué service vence y qué
 * mercadería está por llegar.
 *
 * No repite lo que ya hacen las otras pantallas: cada bloque muestra las
 * primeras filas y lleva a la vista completa, que es donde están los filtros.
 */
export function InicioPage() {
  const { data: usuario } = useUsuarioActual();
  const esAdmin = usuario?.rol === 'ADMIN';

  const bajoStock = useMaterialesBajoStock();
  const cobertura = useCoberturaAlertas();
  const emitidas = useOrdenes(1, MAXIMO_EN_LISTA, '', 'EMITIDA');
  // Los servicios son parte del módulo de Equipos, que es solo para admins: a
  // un operario el pedido le daría 403.
  const servicios = usePlanesQueVencen(7, esAdmin);

  const cargando = bajoStock.isLoading || emitidas.isLoading;
  if (cargando) return <Cargando />;

  const faltantes = bajoStock.data ?? [];
  const porRecibir = emitidas.data?.datos ?? [];
  const vencen = servicios.data ?? [];
  const vencidos = vencen.filter((p) => p.estado === 'VENCIDO').length;

  const nadaQueHacer =
    faltantes.length === 0 && porRecibir.length === 0 && vencen.length === 0;

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Hoy</h1>
      </div>

      {nadaQueHacer && (
        <div className="panel">
          <p style={{ margin: 0 }}>
            No hay nada pendiente: ningún material bajo su mínimo, ninguna orden esperando
            mercadería
            {esAdmin && ' y ningún service por vencer'}.
          </p>
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

      {/* El aviso más importante de la pantalla: sin mínimo cargado, un
          material puede quedar en cero sin que nadie se entere, y arriba
          diría "no hay nada pendiente". */}
      {cobertura.data && cobertura.data.sinMinimo > 0 && (
        <div className="panel panel-aviso">
          <b>
            {cobertura.data.sinMinimo} de {cobertura.data.enUso} materiales no tienen stock
            mínimo cargado.
          </b>{' '}
          De esos, el sistema no puede avisar cuando se están por acabar: solo mira los{' '}
          {cobertura.data.conMinimo} que sí lo tienen. Se carga desde la ficha de cada
          material, en "Stock mínimo".
        </div>
      )}
    </>
  );
}
