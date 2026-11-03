import { ChevronLeft, ChevronRight, Plus, Printer, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { useOrdenes, type FiltrosOrdenes } from '@/api/ordenesCompra';
import { ComboProveedor } from '@/componentes/ComboProveedor';
import { useBusquedaDemorada, useListaEnUrl, type EsquemaFiltros } from '@/lib/listaEnUrl';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { formatearFecha } from '@/lib/formato';
import { descargarPdfOrdenCompra } from '@/lib/pdfOrdenCompra';
import { EnviarOrden } from '@/componentes/EnviarOrden';
import { ETIQUETA_ESTADO_ORDEN } from '@/tipos/ordenCompra';
import type { EstadoOrdenCompra, OrdenCompra } from '@/tipos/ordenCompra';
import { P, usePuede } from '@/lib/permisos';
import { CLASE_ESTADO, moneda } from '@/componentes/ordenesCompra/formato';
import { ModalNuevaOrden } from '@/componentes/ordenesCompra/ModalNuevaOrden';
import { ModalDetalleOrden } from '@/componentes/ordenesCompra/ModalDetalleOrden';

const LIMITE = 20;

const ESTADOS = Object.keys(ETIQUETA_ESTADO_ORDEN) as EstadoOrdenCompra[];

/** Todo lo que se puede filtrar, en la dirección: volver de una orden deja la lista igual. */
interface Filtros extends FiltrosOrdenes {
  buscar?: string;
  estado?: EstadoOrdenCompra;
  /** Solo para mostrar el proveedor elegido; filtra el id. */
  proveedorNombre?: string;
}

const ESQUEMA: EsquemaFiltros<Filtros> = {
  buscar: 'texto',
  estado: 'texto',
  proveedorId: 'texto',
  proveedorNombre: 'texto',
  fechaDesde: 'texto',
  fechaHasta: 'texto',
  precios: 'texto',
  factura: 'texto',
  atrasadas: 'si',
  conProblemas: 'si',
};

/**
 * Los atajos: lo que más se busca, a un toque. Cada uno es un filtro que se
 * prende y se apaga, y se combinan entre sí (falta precio + sin factura = lo
 * que hay que completar).
 */
const ATAJOS: {
  texto: string;
  ayuda: string;
  activo: (f: Filtros) => boolean;
  cambio: (activo: boolean) => Partial<Filtros>;
}[] = [
  {
    texto: 'Falta precio',
    ayuda: 'Al menos un renglón sin precio',
    activo: (f) => f.precios === 'faltan',
    cambio: (a) => ({ precios: a ? undefined : 'faltan' }),
  },
  {
    texto: 'Sin factura',
    ayuda: 'Sin factura adjunta en Comprobantes',
    activo: (f) => f.factura === 'sin',
    cambio: (a) => ({ factura: a ? undefined : 'sin' }),
  },
  {
    texto: 'Atrasadas',
    ayuda:
      'Esperan mercadería y ya pasó la entrega estimada (o, sin fecha, más de 7 días de emitidas)',
    activo: (f) => Boolean(f.atrasadas),
    cambio: (a) => ({ atrasadas: !a }),
  },
  {
    texto: 'Con problemas',
    ayuda: 'Tuvieron una devolución o se cerraron con faltante',
    activo: (f) => Boolean(f.conProblemas),
    cambio: (a) => ({ conProblemas: !a }),
  },
];

/** Cuántos filtros del panel están puestos (los atajos y el buscador se ven solos). */
function filtrosDelPanel(f: Filtros): number {
  return [
    f.proveedorId,
    f.fechaDesde,
    f.fechaHasta,
    f.precios === 'completos',
    f.factura === 'con',
  ].filter(Boolean).length;
}

/**
 * Con qué papel llegó la mercadería.
 *
 * Una orden se cierra con remito o con factura, así que puede tener uno, el
 * otro, o los dos. Se muestran los que haya y no se inventa un guion cuando la
 * orden todavía no llegó: ahí no hay comprobante porque no tiene que haberlo.
 */
function comprobanteDe(orden: OrdenCompra): string {
  const partes = [
    orden.remito ? `Remito ${orden.remito}` : '',
    orden.factura ? `Factura ${orden.factura}` : '',
  ].filter(Boolean);
  return partes.join(' · ') || '—';
}

export function OrdenesCompraPage() {
  const { filtros, pagina, cambiarFiltros, reemplazarFiltros, irAPagina } =
    useListaEnUrl<Filtros>(ESQUEMA);
  const [buscar, setBuscar] = useBusquedaDemorada(filtros.buscar, (b) =>
    cambiarFiltros({ buscar: b }),
  );
  const [panelAbierto, setPanelAbierto] = useState(() => filtrosDelPanel(filtros) > 0);
  const setPagina = (cambio: (p: number) => number) => irAPagina(cambio(pagina));
  const [modalAlta, setModalAlta] = useState(false);
  const [ordenAbierta, setOrdenAbierta] = useState<OrdenCompra | null>(null);
  const [ordenAEnviar, setOrdenAEnviar] = useState<OrdenCompra | null>(null);
  // Mandarle la orden a un tercero usando la casilla de la empresa no es lo
  // mismo que prepararla, por eso tiene permiso propio. Quien no lo tenga
  // sigue con el flujo de siempre: descargar el PDF y mandarlo por su cuenta.
  const puede = usePuede();
  const puedeEnviar = puede(P.ORDENES_ENVIAR);

  /**
   * Abre la pantalla de envío y cierra la que estaba.
   *
   * Cerrar las otras es la parte que importa: la de envío se abre desde el
   * detalle y desde el alta, y dejar las dos abiertas las apilaba una encima de
   * otra. Cuál tapaba a cuál dependía del orden en el JSX, no de lo que la
   * persona acababa de tocar, así que el botón parecía no hacer nada.
   */
  const alEnviar = puedeEnviar
    ? (orden: OrdenCompra) => {
        setOrdenAbierta(null);
        setModalAlta(false);
        setOrdenAEnviar(orden);
      }
    : undefined;

  const { buscar: busquedaDebounced = '', estado = '', proveedorNombre, ...resto } = filtros;
  void proveedorNombre;
  const { data, isLoading, error } = useOrdenes(pagina, LIMITE, busquedaDebounced, estado, resto);
  const hayFiltros = Object.keys(filtros).length > 0;
  const enPanel = filtrosDelPanel(filtros);
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / LIMITE)) : 1;

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Órdenes de compra</h1>
        <button className="btn btn-primario" onClick={() => setModalAlta(true)}>
          <Plus className="icono" aria-hidden />
          Nueva orden
        </button>
      </div>

      <div className="grilla-filtros">
        <input
          type="search"
          placeholder="Buscar por orden, proveedor, remito, factura o material…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <select
          value={estado}
          onChange={(e) =>
            cambiarFiltros({ estado: (e.target.value || undefined) as EstadoOrdenCompra })
          }
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO_ORDEN[e]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={enPanel > 0 ? 'btn btn-primario' : 'btn'}
          aria-expanded={panelAbierto}
          onClick={() => setPanelAbierto((v) => !v)}
        >
          <SlidersHorizontal className="icono" aria-hidden />
          Más filtros{enPanel > 0 ? ` (${enPanel})` : ''}
        </button>
      </div>

      <div className="atajos-filtro" role="group" aria-label="Atajos">
        {ATAJOS.map((a) => {
          const activo = a.activo(filtros);
          return (
            <button
              key={a.texto}
              type="button"
              className={`chip-periodo${activo ? ' activo' : ''}`}
              aria-pressed={activo}
              title={a.ayuda}
              onClick={() => cambiarFiltros(a.cambio(activo))}
            >
              {a.texto}
            </button>
          );
        })}
        {hayFiltros && (
          <button
            type="button"
            className="btn btn-fantasma btn-sm"
            onClick={() => {
              setBuscar('');
              reemplazarFiltros({});
            }}
          >
            <X className="icono" aria-hidden />
            Limpiar filtros
          </button>
        )}
      </div>

      {panelAbierto && (
        <div className="panel filtros-ordenes">
          <div className="campo">
            <span>Proveedor</span>
            <ComboProveedor
              key={filtros.proveedorId ?? 'ninguno'}
              inicial={
                filtros.proveedorId
                  ? { id: filtros.proveedorId, nombre: filtros.proveedorNombre ?? '' }
                  : null
              }
              onCambio={(p) => cambiarFiltros({ proveedorId: p?.id, proveedorNombre: p?.nombre })}
            />
          </div>
          <label className="campo">
            Desde
            <input
              type="date"
              value={filtros.fechaDesde ?? ''}
              max={filtros.fechaHasta}
              onChange={(e) => cambiarFiltros({ fechaDesde: e.target.value || undefined })}
            />
          </label>
          <label className="campo">
            Hasta
            <input
              type="date"
              value={filtros.fechaHasta ?? ''}
              min={filtros.fechaDesde}
              onChange={(e) => cambiarFiltros({ fechaHasta: e.target.value || undefined })}
            />
          </label>
          <label className="campo">
            Precios
            <select
              value={filtros.precios ?? ''}
              onChange={(e) =>
                cambiarFiltros({ precios: (e.target.value || undefined) as Filtros['precios'] })
              }
            >
              <option value="">Todas</option>
              <option value="completos">Con todos los precios</option>
              <option value="faltan">Falta algún precio</option>
            </select>
          </label>
          <label className="campo">
            Factura
            <select
              value={filtros.factura ?? ''}
              onChange={(e) =>
                cambiarFiltros({ factura: (e.target.value || undefined) as Filtros['factura'] })
              }
            >
              <option value="">Todas</option>
              <option value="con">Con factura adjunta</option>
              <option value="sin">Sin factura adjunta</option>
            </select>
          </label>
        </div>
      )}

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {data && data.datos.length === 0 && (
        <EstadoVacio>
          {hayFiltros
            ? 'No hay órdenes que coincidan con el filtro.'
            : 'Todavía no creaste ninguna orden de compra.'}
        </EstadoVacio>
      )}

      {data && data.datos.length > 0 && (
        <div className="tabla-scroll tabla-cards-contenedor">
          <table className="tabla tabla-cards">
            <thead>
              <tr>
                <th>Número</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th>Ítems</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Comprobante</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.datos.map((orden) => (
                <tr key={orden.id}>
                  <td data-etiqueta="Número">
                    <strong>{orden.numero}</strong>
                  </td>
                  <td data-etiqueta="Proveedor">{orden.proveedorNombre ?? '—'}</td>
                  <td data-etiqueta="Fecha">{formatearFecha(orden.fecha)}</td>
                  <td data-etiqueta="Ítems">{orden.renglones.length}</td>
                  <td data-etiqueta="Total">{moneda(orden.total)}</td>
                  <td data-etiqueta="Estado">
                    <span className={CLASE_ESTADO[orden.estado]}>
                      {ETIQUETA_ESTADO_ORDEN[orden.estado]}
                    </span>
                  </td>
                  <td data-etiqueta="Comprobante">{comprobanteDe(orden)}</td>
                  <td className="celda-acciones">
                    <div className="fila-acciones">
                      <button className="btn btn-sm" onClick={() => setOrdenAbierta(orden)}>
                        Ver
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => descargarPdfOrdenCompra(orden)}
                        title="Descargar la orden en PDF para imprimir o enviar"
                      >
                        <Printer className="icono" aria-hidden />
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && totalPaginas > 1 && (
        <div className="acciones paginacion">
          <button
            className="btn btn-sm"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => p - 1)}
          >
            <ChevronLeft className="icono" aria-hidden />
            Anterior
          </button>
          <span className="texto-suave">
            Página {pagina} de {totalPaginas} · {data.total} órdenes
          </span>
          <button
            className="btn btn-sm"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente
            <ChevronRight className="icono" aria-hidden />
          </button>
        </div>
      )}

      <ModalNuevaOrden
        abierto={modalAlta}
        onCerrar={() => setModalAlta(false)}
        onEnviar={alEnviar}
      />
      {ordenAEnviar && <EnviarOrden orden={ordenAEnviar} onCerrar={() => setOrdenAEnviar(null)} />}
      {ordenAbierta && (
        <ModalDetalleOrden
          orden={ordenAbierta}
          onCerrar={() => setOrdenAbierta(null)}
          onEnviar={alEnviar}
        />
      )}
    </>
  );
}

// ─────────────────────── Nueva orden ───────────────────────
