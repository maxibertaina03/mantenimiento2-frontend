import { useState } from 'react';
import {
  useAnularOrden,
  useCerrarConFaltante,
  useCorregirPrecios,
  useEliminarOrden,
  useEmitirOrden,
} from '@/api/ordenesCompra';
import { CampoNumero } from '@/componentes/CampoNumero';
import { MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { formatearFecha, formatearNumero } from '@/lib/formato';
import { descargarPdfOrdenCompra } from '@/lib/pdfOrdenCompra';
import { ComprobantesOrden } from '@/componentes/ComprobantesOrden';
import { ETIQUETA_ESTADO_ORDEN, nombreDelRenglon } from '@/tipos/ordenCompra';
import type { OrdenCompra } from '@/tipos/ordenCompra';
import { P, usePuede } from '@/lib/permisos';
import { CLASE_ESTADO, moneda } from './formato';
import { ReclamarFaltante } from './ReclamarFaltante';
import { RecibirMercaderia } from './RecibirMercaderia';

export function ModalDetalleOrden({
  orden: ordenDeLaLista,
  onCerrar,
  onEnviar,
}: {
  orden: OrdenCompra;
  onCerrar: () => void;
  onEnviar?: (orden: OrdenCompra) => void;
}) {
  // La orden llega de la lista. Al corregir precios el servidor devuelve la
  // nueva, y es la que tienen que usar la tabla, el PDF y el envío: si no, se
  // le volvería a mandar al proveedor el papel viejo, sin el precio.
  const [orden, setOrden] = useState(ordenDeLaLista);
  const puede = usePuede();
  const corregir = useCorregirPrecios(orden.id);
  const [editandoPrecios, setEditandoPrecios] = useState(false);
  const [precios, setPrecios] = useState<Record<string, number | undefined>>({});
  const [preciosGuardados, setPreciosGuardados] = useState(false);
  const puedeCorregirPrecios =
    puede(P.ORDENES_EDITAR) &&
    (orden.estado === 'EMITIDA' ||
      orden.estado === 'RECIBIDA_PARCIAL' ||
      orden.estado === 'RECIBIDA');

  const empezarAEditarPrecios = () => {
    setPrecios(Object.fromEntries(orden.renglones.map((r) => [r.id, r.precioUnitario ?? undefined])));
    setPreciosGuardados(false);
    setEditandoPrecios(true);
  };

  // Solo los que cambiaron y tienen un precio cargado.
  const preciosCambiados = orden.renglones
    .filter((r) => {
      const nuevo = precios[r.id];
      return nuevo !== undefined && nuevo > 0 && nuevo !== r.precioUnitario;
    })
    .map((r) => ({ renglonId: r.id, precioUnitario: precios[r.id] as number }));

  const guardarPrecios = async () => {
    const nueva = await corregir.mutateAsync(preciosCambiados);
    setOrden(nueva);
    setEditandoPrecios(false);
    setPreciosGuardados(true);
  };

  const emitir = useEmitirOrden(orden.id);
  const anular = useAnularOrden(orden.id);
  const eliminar = useEliminarOrden();
  const cerrarConFaltante = useCerrarConFaltante(orden.id);

  const [mostrarRecepcion, setMostrarRecepcion] = useState(false);
  const [recienRecibida, setRecienRecibida] = useState(false);
  const [reclamando, setReclamando] = useState(false);
  const [cerrandoConFaltante, setCerrandoConFaltante] = useState(false);
  const [motivoFaltante, setMotivoFaltante] = useState('');

  // Las órdenes de antes de las entregas pueden no traerlas.
  const recepciones = orden.recepciones ?? [];
  /** Lo que todavía falta entregar. */
  const pendientes = orden.renglones.filter((r) => r.pendiente > 0);
  const esperaMercaderia = orden.estado === 'EMITIDA' || orden.estado === 'RECIBIDA_PARCIAL';
  // La columna de lo recibido se muestra cuando hay algo que contar: una orden
  // que llegó en partes, o que se cerró con faltante.
  const mostrarRecibido =
    orden.estado === 'RECIBIDA_PARCIAL' || orden.cerradaConFaltante || recepciones.length > 1;

  const errorAccion =
    emitir.error ?? anular.error ?? eliminar.error ?? corregir.error ?? cerrarConFaltante.error;

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
          {/* El comprobante con el que llegó la mercadería. Es el dato que se
              compara contra el papel, así que va en la ficha y no escondido en
              el formulario de recibir, que después de recibir ya no se abre. */}
          {orden.remito && (
            <div className="dato">
              <span className="texto-suave texto-chico">Remito</span>
              <span>
                <strong>{orden.remito}</strong>
              </span>
            </div>
          )}
          {orden.factura && (
            <div className="dato">
              <span className="texto-suave texto-chico">Factura</span>
              <span>
                <strong>{orden.factura}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="tabla-scroll tabla-cards-contenedor">
          <table className="tabla tabla-cards">
            <thead>
              <tr>
                <th>Material</th>
                <th>Cantidad</th>
                {mostrarRecibido && <th>Recibido</th>}
                <th>P. unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {orden.renglones.map((r) => (
                <tr key={r.id}>
                  <td data-etiqueta="Material">{nombreDelRenglon(r) ?? '—'}</td>
                  <td data-etiqueta="Cantidad">
                    {formatearNumero(r.cantidad)} {r.unidad ?? ''}
                  </td>
                  {mostrarRecibido && (
                    <td
                      data-etiqueta="Recibido"
                      className={r.pendiente > 0 ? 'renglon-falta' : 'renglon-completo'}
                    >
                      {formatearNumero(r.cantidadRecibida)} de {formatearNumero(r.cantidad)}
                      {r.pendiente > 0 ? ` · falta ${formatearNumero(r.pendiente)}` : ' ✔'}
                    </td>
                  )}
                  {editandoPrecios ? (
                    <>
                      <td data-etiqueta="P. unitario" className="celda-editable">
                        <CampoNumero
                          step="0.01"
                          min="0.01"
                          placeholder="Sin precio"
                          aria-label={`Precio de ${nombreDelRenglon(r) ?? 'el renglón'}`}
                          valor={precios[r.id]}
                          onCambio={(p) => setPrecios((ps) => ({ ...ps, [r.id]: p }))}
                        />
                      </td>
                      <td data-etiqueta="Subtotal">
                        {precios[r.id] !== undefined
                          ? moneda(r.cantidad * (precios[r.id] as number))
                          : '—'}
                      </td>
                    </>
                  ) : (
                    <>
                      <td
                        data-etiqueta="P. unitario"
                        className={r.precioUnitario === null ? 'renglon-sin-precio' : undefined}
                      >
                        {r.precioUnitario === null ? 'Sin precio' : moneda(r.precioUnitario)}
                      </td>
                      <td data-etiqueta="Subtotal">{moneda(r.subtotal)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            {!editandoPrecios && orden.total !== null && (
              <tfoot>
                <tr>
                  <td colSpan={mostrarRecibido ? 4 : 3}>
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

        {editandoPrecios && (
          <div className="panel">
            <p className="texto-suave texto-chico">
              Solo cambian los precios: las cantidades y los materiales quedan como están
              {orden.estado === 'RECIBIDA' ? ', y el stock no se mueve' : ''}. Después
              descargá el PDF de nuevo para mandárselo al proveedor.
            </p>
            <div className="acciones">
              <button className="btn" onClick={() => setEditandoPrecios(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primario"
                disabled={corregir.isPending || preciosCambiados.length === 0}
                onClick={guardarPrecios}
              >
                {corregir.isPending ? 'Guardando…' : 'Guardar precios'}
              </button>
            </div>
          </div>
        )}

        {preciosGuardados && (
          <div className="alerta alerta-exito">
            ✔ Precios guardados. Descargá el PDF de nuevo (o enviáselo) para que el proveedor
            tenga la orden completa.
          </div>
        )}

        {orden.observaciones && (
          <>
            <h3 className="subtitulo-form">Observaciones</h3>
            <p className="texto-suave">{orden.observaciones}</p>
          </>
        )}

        {orden.estado === 'RECIBIDA' && !orden.cerradaConFaltante && (
          <div className="alerta alerta-exito">
            ✔ Orden finalizada: la mercadería ya ingresó al stock. Cada renglón generó su
            movimiento de ENTRADA, que podés ver en el Historial.
          </div>
        )}

        {orden.estado === 'RECIBIDA' && orden.cerradaConFaltante && (
          <div className="alerta alerta-aviso">
            Cerrada con lo que llegó: el proveedor no entregó todo. Lo que llegó ingresó al stock;
            lo que faltó quedó sin recibir.
            {orden.motivoFaltante && (
              <>
                {' '}
                Motivo: <strong>{orden.motivoFaltante}</strong>.
              </>
            )}
          </div>
        )}

        {orden.estado === 'RECIBIDA_PARCIAL' && (
          <div className="alerta alerta-aviso">
            {recienRecibida ? '✔ Entrega registrada. ' : ''}
            Llegó una parte: lo que llegó ya sumó al stock. Falta{' '}
            {pendientes.length === 1 ? 'un renglón' : `${pendientes.length} renglones`}: se puede
            reclamar al proveedor, recibir cuando llegue, o cerrar la orden con lo que llegó.
          </div>
        )}

        {recepciones.length > 0 && (recepciones.length > 1 || mostrarRecibido) && (
          <>
            <h3 className="subtitulo-form">Entregas</h3>
            <ul className="entregas-lista">
              {recepciones.map((e) => (
                <li key={e.id}>
                  <strong>{formatearFecha(e.fecha)}</strong>
                  {e.remito ? ` · Remito ${e.remito}` : ''}
                  {e.factura ? ` · Factura ${e.factura}` : ''}
                  {e.recibidaPorNombre ? ` · ${e.recibidaPorNombre}` : ''}
                  <div className="texto-suave texto-chico">
                    {e.renglones
                      .map((x) => {
                        const renglon = orden.renglones.find((r) => r.id === x.renglonId);
                        return `${formatearNumero(x.cantidad)} ${renglon?.unidad ?? ''} ${
                          renglon ? (nombreDelRenglon(renglon) ?? '') : ''
                        }`.trim();
                      })
                      .join(' · ')}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* El papel del remito o la factura. Se muestra desde que la orden se
            emitió: a veces el comprobante llega con la mercadería y se carga
            antes de terminar de contar todo. */}
        {orden.estado !== 'BORRADOR' && <ComprobantesOrden ordenId={orden.id} />}

        {mostrarRecepcion && (
          <RecibirMercaderia
            orden={orden}
            onCancelar={() => setMostrarRecepcion(false)}
            onListo={(actualizada) => {
              // Queda abierta con la orden nueva: si llegó una parte, desde acá
              // mismo se reclama lo que falta.
              setOrden(actualizada);
              setMostrarRecepcion(false);
              setRecienRecibida(true);
            }}
          />
        )}

        {cerrandoConFaltante && (
          <div className="panel">
            <h3 className="subtitulo-form">Cerrar con lo que llegó</h3>
            <p className="texto-suave texto-chico">
              El proveedor no va a entregar el resto. La orden queda finalizada con lo que llegó, y
              lo que falta deja de esperarse. Si después igual hace falta, se hace una orden nueva.
            </p>
            <label className="campo">
              ¿Por qué? *
              <input
                value={motivoFaltante}
                onChange={(e) => setMotivoFaltante(e.target.value)}
                placeholder="Ej: el proveedor no tiene stock del acrílico"
                maxLength={300}
              />
            </label>
            <div className="acciones">
              <button className="btn" onClick={() => setCerrandoConFaltante(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primario"
                disabled={cerrarConFaltante.isPending || motivoFaltante.trim().length < 3}
                onClick={async () => {
                  try {
                    setOrden(await cerrarConFaltante.mutateAsync(motivoFaltante.trim()));
                    setCerrandoConFaltante(false);
                  } catch {
                    // El rechazo se muestra abajo.
                  }
                }}
              >
                {cerrarConFaltante.isPending ? 'Cerrando…' : 'Cerrar la orden'}
              </button>
            </div>
          </div>
        )}

        {errorAccion && <MensajeError error={errorAccion} />}

        <div className="acciones">
          <button className="btn" onClick={() => descargarPdfOrdenCompra(orden)}>
            🖨 Descargar PDF
          </button>
          {puedeCorregirPrecios && !editandoPrecios && (
            <button className="btn" onClick={empezarAEditarPrecios}>
              ✏ Cargar o corregir precios
            </button>
          )}
          {onEnviar && orden.estado !== 'BORRADOR' && (
            <button className="btn" onClick={() => onEnviar(orden)}>
              ✉ Enviar al proveedor
            </button>
          )}

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
                onEnviar?.(orden);
                onCerrar();
              }}
            >
              {emitir.isPending ? 'Procesando…' : '🖨 Imprimir y enviar al proveedor'}
            </button>
          )}

          {esperaMercaderia && !mostrarRecepcion && !cerrandoConFaltante && (
            <button
              className="btn btn-primario"
              onClick={() => {
                setRecienRecibida(false);
                setMostrarRecepcion(true);
              }}
            >
              {orden.estado === 'EMITIDA' ? '📦 Recibir mercadería' : '📦 Recibir otra entrega'}
            </button>
          )}

          {orden.estado === 'RECIBIDA_PARCIAL' && !mostrarRecepcion && (
            <>
              <button className="btn" onClick={() => setReclamando(true)}>
                ✉ Reclamar lo que falta
              </button>
              {!cerrandoConFaltante && (
                <button className="btn" onClick={() => setCerrandoConFaltante(true)}>
                  Cerrar con lo que llegó
                </button>
              )}
            </>
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

      {reclamando && <ReclamarFaltante orden={orden} onCerrar={() => setReclamando(false)} />}
    </Modal>
  );
}
