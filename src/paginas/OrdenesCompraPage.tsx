import { useEffect, useState } from 'react';
import {
  useAnularOrden,
  useCrearOrden,
  useEliminarOrden,
  useEmitirOrden,
  useOrdenes,
  useRecibirOrden,
} from '@/api/ordenesCompra';
import { ComboMaterial } from '@/componentes/ComboMaterial';
import { ComboProveedor } from '@/componentes/ComboProveedor';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { formatearFecha, formatearNumero } from '@/lib/formato';
import { descargarPdfOrdenCompra } from '@/lib/pdfOrdenCompra';
import { ETIQUETA_ESTADO_ORDEN } from '@/tipos/ordenCompra';
import type {
  EstadoOrdenCompra,
  OrdenCompra,
  RenglonInput,
} from '@/tipos/ordenCompra';
import type { Material } from '@/tipos/material';

const LIMITE = 20;
const ESTADOS = Object.keys(ETIQUETA_ESTADO_ORDEN) as EstadoOrdenCompra[];

const CLASE_ESTADO: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'badge',
  EMITIDA: 'badge badge-aviso',
  RECIBIDA: 'badge badge-ok',
  ANULADA: 'badge badge-error',
};

function moneda(valor: number | null): string {
  if (valor === null) return '—';
  return `$ ${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OrdenesCompraPage() {
  const [pagina, setPagina] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [estado, setEstado] = useState<EstadoOrdenCompra | ''>('');
  const [modalAlta, setModalAlta] = useState(false);
  const [ordenAbierta, setOrdenAbierta] = useState<OrdenCompra | null>(null);

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
          placeholder="🔍 Buscar por número de orden o proveedor…"
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
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Número</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th>Ítems</th>
                <th>Total</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.datos.map((orden) => (
                <tr key={orden.id}>
                  <td>
                    <strong>{orden.numero}</strong>
                  </td>
                  <td>{orden.proveedorNombre ?? '—'}</td>
                  <td>{formatearFecha(orden.fecha)}</td>
                  <td>{orden.renglones.length}</td>
                  <td>{moneda(orden.total)}</td>
                  <td>
                    <span className={CLASE_ESTADO[orden.estado]}>
                      {ETIQUETA_ESTADO_ORDEN[orden.estado]}
                    </span>
                  </td>
                  <td>
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
        <div className="acciones" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
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

      <ModalNuevaOrden abierto={modalAlta} onCerrar={() => setModalAlta(false)} />
      {ordenAbierta && (
        <ModalDetalleOrden orden={ordenAbierta} onCerrar={() => setOrdenAbierta(null)} />
      )}
    </>
  );
}

// ─────────────────────── Nueva orden ───────────────────────

interface RenglonBorrador extends RenglonInput {
  /** Se guarda para mostrar el nombre sin volver a pedirlo a la API. */
  materialNombre: string;
  unidad: string;
}

function ModalNuevaOrden({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [proveedorId, setProveedorId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [renglones, setRenglones] = useState<RenglonBorrador[]>([]);

  // Renglón que se está armando.
  const [material, setMaterial] = useState<Material | null>(null);
  const [cantidad, setCantidad] = useState('');
  const [precio, setPrecio] = useState('');

  const crear = useCrearOrden();

  const limpiar = () => {
    setProveedorId('');
    setObservaciones('');
    setRenglones([]);
    setMaterial(null);
    setCantidad('');
    setPrecio('');
  };

  const agregarRenglon = () => {
    if (!material || !cantidad) return;
    // El backend rechaza el mismo material dos veces: lo avisamos antes.
    if (renglones.some((r) => r.materialId === material.id)) {
      alert(`"${material.nombre}" ya está en la orden. Editá la cantidad de ese renglón.`);
      return;
    }
    setRenglones((rs) => [
      ...rs,
      {
        materialId: material.id,
        materialNombre: material.nombre,
        unidad: material.unidad,
        cantidad: Number(cantidad),
        precioUnitario: precio ? Number(precio) : undefined,
      },
    ]);
    setMaterial(null);
    setCantidad('');
    setPrecio('');
  };

  const quitarRenglon = (materialId: string) =>
    setRenglones((rs) => rs.filter((r) => r.materialId !== materialId));

  const total = renglones.every((r) => r.precioUnitario !== undefined)
    ? renglones.reduce((s, r) => s + r.cantidad * (r.precioUnitario ?? 0), 0)
    : null;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const orden = await crear.mutateAsync({
      proveedorId,
      observaciones: observaciones || undefined,
      renglones: renglones.map(({ materialId, cantidad: c, precioUnitario }) => ({
        materialId,
        cantidad: c,
        precioUnitario,
      })),
    });
    limpiar();
    onCerrar();
    // Ofrecemos el PDF apenas se crea: es el motivo principal de cargar la orden.
    if (confirm(`Orden ${orden.numero} creada. ¿Descargar el PDF para imprimir?`)) {
      await descargarPdfOrdenCompra(orden);
    }
  };

  return (
    <Modal titulo="Nueva orden de compra" abierto={abierto} tamano="ancho" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <label className="campo">
          Proveedor *
          <ComboProveedor onCambio={(p) => setProveedorId(p?.id ?? '')} />
        </label>

        <h3 className="subtitulo-form">Materiales a comprar</h3>

        <div className="panel alta-renglon">
          <label className="alta-renglon-material">
            Material
            {/* La `key` fuerza a remontar el combo tras cada alta: mantiene
                estado interno y si no, seguiría mostrando el material anterior.
                Solo ofrece materiales cargados en el sistema (busca en la API). */}
            <ComboMaterial
              key={`material-${renglones.length}`}
              materialId=""
              onCambio={setMaterial}
            />
          </label>
          <label>
            Cantidad *
            <input
              type="number"
              step="0.001"
              min="0.001"
              placeholder="0"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </label>
          <label>
            Precio unitario
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="opcional"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primario alta-renglon-boton"
            onClick={agregarRenglon}
            disabled={!material || !cantidad}
          >
            + Agregar
          </button>
        </div>

        {renglones.length === 0 && (
          <p className="texto-suave">
            Buscá un material por nombre, poné la cantidad y tocá «Agregar». La orden necesita
            al menos uno.
          </p>
        )}

        {renglones.length > 0 && (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Cantidad</th>
                  <th>P. unitario</th>
                  <th>Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {renglones.map((r) => (
                  <tr key={r.materialId}>
                    <td>{r.materialNombre}</td>
                    <td>
                      {formatearNumero(r.cantidad)} {r.unidad}
                    </td>
                    <td>{r.precioUnitario !== undefined ? moneda(r.precioUnitario) : '—'}</td>
                    <td>
                      {r.precioUnitario !== undefined
                        ? moneda(r.cantidad * r.precioUnitario)
                        : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-peligro"
                        onClick={() => quitarRenglon(r.materialId)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {total !== null && (
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      <strong>Total</strong>
                    </td>
                    <td colSpan={2}>
                      <strong>{moneda(total)}</strong>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        <label className="campo">
          Observaciones
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Salen impresas en la orden"
          />
        </label>

        {crear.error && <MensajeError error={crear.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primario"
            disabled={crear.isPending || !proveedorId || renglones.length === 0}
          >
            {crear.isPending ? 'Creando…' : 'Crear orden'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────── Detalle de la orden ───────────────────────

function ModalDetalleOrden({ orden, onCerrar }: { orden: OrdenCompra; onCerrar: () => void }) {
  const emitir = useEmitirOrden(orden.id);
  const recibir = useRecibirOrden(orden.id);
  const anular = useAnularOrden(orden.id);
  const eliminar = useEliminarOrden();

  const [remito, setRemito] = useState('');
  const [mostrarRecepcion, setMostrarRecepcion] = useState(false);

  const errorAccion = emitir.error ?? recibir.error ?? anular.error ?? eliminar.error;

  return (
    <Modal titulo={`Orden ${orden.numero}`} abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <div className="grilla-datos">
          <div className="dato">
            <span className="texto-suave texto-chico">Proveedor</span>
            <span>{orden.proveedorNombre ?? '—'}</span>
          </div>
          {orden.proveedorCuit && (
            <div className="dato">
              <span className="texto-suave texto-chico">CUIT</span>
              <span>{orden.proveedorCuit}</span>
            </div>
          )}
          <div className="dato">
            <span className="texto-suave texto-chico">Estado</span>
            <span className={CLASE_ESTADO[orden.estado]}>
              {ETIQUETA_ESTADO_ORDEN[orden.estado]}
            </span>
          </div>
          <div className="dato">
            <span className="texto-suave texto-chico">Fecha</span>
            <span>{formatearFecha(orden.fecha)}</span>
          </div>
          {orden.creadoPorNombre && (
            <div className="dato">
              <span className="texto-suave texto-chico">Solicitó</span>
              <span>{orden.creadoPorNombre}</span>
            </div>
          )}
          {orden.recibidaEn && (
            <div className="dato">
              <span className="texto-suave texto-chico">Recibida</span>
              <span>
                {formatearFecha(orden.recibidaEn)}
                {orden.recibidaPorNombre ? ` · ${orden.recibidaPorNombre}` : ''}
              </span>
            </div>
          )}
        </div>

        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Material</th>
                <th>Cantidad</th>
                <th>P. unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {orden.renglones.map((r) => (
                <tr key={r.id}>
                  <td>{r.materialNombre ?? '—'}</td>
                  <td>
                    {formatearNumero(r.cantidad)} {r.unidad ?? ''}
                  </td>
                  <td>{moneda(r.precioUnitario)}</td>
                  <td>{moneda(r.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            {orden.total !== null && (
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>{moneda(orden.total)}</strong>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {orden.observaciones && (
          <>
            <h3 className="subtitulo-form">Observaciones</h3>
            <p className="texto-suave">{orden.observaciones}</p>
          </>
        )}

        {orden.estado === 'RECIBIDA' && (
          <div className="alerta alerta-exito">
            ✔ Orden finalizada: la mercadería ya ingresó al stock. Cada renglón generó su
            movimiento de ENTRADA, que podés ver en el Historial.
          </div>
        )}

        {mostrarRecepcion && (
          <div className="panel">
            <label className="campo">
              Nº de remito (opcional)
              <input
                value={remito}
                onChange={(e) => setRemito(e.target.value)}
                placeholder="R-0001-00012345"
              />
            </label>
            <p className="texto-suave texto-chico">
              Al confirmar, la orden queda <strong>finalizada</strong> y cada material de la
              orden suma su cantidad al stock.
            </p>
            <div className="acciones">
              <button className="btn" onClick={() => setMostrarRecepcion(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primario"
                disabled={recibir.isPending}
                onClick={async () => {
                  await recibir.mutateAsync({ remito: remito || undefined });
                  setMostrarRecepcion(false);
                  onCerrar();
                }}
              >
                {recibir.isPending ? 'Registrando…' : 'Confirmar y sumar al stock'}
              </button>
            </div>
          </div>
        )}

        {errorAccion && <MensajeError error={errorAccion} />}

        <div className="acciones">
          <button className="btn" onClick={() => descargarPdfOrdenCompra(orden)}>
            🖨 Descargar PDF
          </button>

          {orden.estado === 'BORRADOR' && (
            <button
              className="btn btn-primario"
              disabled={emitir.isPending}
              onClick={async () => {
                // Imprimir y marcar como enviada es un solo gesto: se baja el
                // PDF para mandarle al proveedor y la orden queda esperando la
                // mercaderia.
                await descargarPdfOrdenCompra(orden);
                await emitir.mutateAsync();
                onCerrar();
              }}
            >
              {emitir.isPending ? 'Procesando…' : '🖨 Imprimir y enviar al proveedor'}
            </button>
          )}

          {orden.estado === 'EMITIDA' && !mostrarRecepcion && (
            <button className="btn btn-primario" onClick={() => setMostrarRecepcion(true)}>
              ✔ Marcar como recibida
            </button>
          )}

          {(orden.estado === 'BORRADOR' || orden.estado === 'EMITIDA') && (
            <button
              className="btn btn-peligro"
              disabled={anular.isPending}
              onClick={async () => {
                if (!confirm(`¿Anular la orden ${orden.numero}?`)) return;
                await anular.mutateAsync();
                onCerrar();
              }}
            >
              Anular
            </button>
          )}

          <button className="btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
