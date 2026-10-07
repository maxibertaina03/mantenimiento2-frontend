import { useEffect, useState } from 'react';
import { useOrdenes } from '@/api/ordenesCompra';
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
  const [pagina, setPagina] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [estado, setEstado] = useState<EstadoOrdenCompra | ''>('');
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

  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaDebounced(buscar);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading, error } = useOrdenes(pagina, LIMITE, busquedaDebounced, estado);
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / LIMITE)) : 1;

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Órdenes de compra</h1>
        <button className="btn btn-primario" onClick={() => setModalAlta(true)}>
          + Nueva orden
        </button>
      </div>

      <div className="grilla-filtros">
        <input
          type="search"
          placeholder="🔍 Buscar por orden, proveedor, remito o factura…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <select
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value as EstadoOrdenCompra | '');
            setPagina(1);
          }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO_ORDEN[e]}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {data && data.datos.length === 0 && (
        <EstadoVacio>
          {busquedaDebounced || estado
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
                        🖨 PDF
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
          <button className="btn btn-sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            ← Anterior
          </button>
          <span className="texto-suave">
            Página {pagina} de {totalPaginas} · {data.total} órdenes
          </span>
          <button
            className="btn btn-sm"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}

      <ModalNuevaOrden
        abierto={modalAlta}
        onCerrar={() => setModalAlta(false)}
        onEnviar={alEnviar}
      />
      {ordenAEnviar && (
        <EnviarOrden orden={ordenAEnviar} onCerrar={() => setOrdenAEnviar(null)} />
      )}
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
