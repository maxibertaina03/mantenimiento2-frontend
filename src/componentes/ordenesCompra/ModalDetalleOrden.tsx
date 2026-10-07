import { useState } from 'react';
import { useAnularOrden, useEliminarOrden, useEmitirOrden, useRecibirOrden, useCorregirPrecios } from '@/api/ordenesCompra';
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
    puede(P.ORDENES_EDITAR) && (orden.estado === 'EMITIDA' || orden.estado === 'RECIBIDA');

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
  const recibir = useRecibirOrden(orden.id);
  const anular = useAnularOrden(orden.id);
  const eliminar = useEliminarOrden();

  const [remito, setRemito] = useState('');
  const [factura, setFactura] = useState('');
  // Sin comprobante no se cierra la orden: es lo unico que ata la entrada de
  // stock al papel. El servidor lo rechaza igual; esto evita el viaje.
  const hayComprobante = remito.trim() !== '' || factura.trim() !== '';
  const [mostrarRecepcion, setMostrarRecepcion] = useState(false);

  const errorAccion =
    emitir.error ?? recibir.error ?? anular.error ?? eliminar.error ?? corregir.error;

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

        {orden.estado === 'RECIBIDA' && (
          <div className="alerta alerta-exito">
            ✔ Orden finalizada: la mercadería ya ingresó al stock. Cada renglón generó su
            movimiento de ENTRADA, que podés ver en el Historial.
          </div>
        )}

        {/* El papel del remito o la factura. Se muestra desde que la orden se
            emitió: a veces el comprobante llega con la mercadería y se carga
            antes de terminar de contar todo. */}
        {orden.estado !== 'BORRADOR' && <ComprobantesOrden ordenId={orden.id} />}

        {mostrarRecepcion && (
          <div className="panel">
            <div className="grilla-2">
              <label className="campo">
                Nº de remito
                <input
                  value={remito}
                  onChange={(e) => setRemito(e.target.value)}
                  placeholder="R-0001-00012345"
                />
              </label>
              <label className="campo">
                Nº de factura
                <input
                  value={factura}
                  onChange={(e) => setFactura(e.target.value)}
                  placeholder="A-0001-00098765"
                />
              </label>
            </div>
            <p className="texto-suave texto-chico">
              Hace falta <strong>uno de los dos</strong>. Es lo que después permite cruzar el
              stock con el papel que quedó en la empresa.
            </p>
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
                disabled={recibir.isPending || !hayComprobante}
                title={hayComprobante ? undefined : 'Cargá el número de remito o el de factura'}
                onClick={async () => {
                  await recibir.mutateAsync({
                    remito: remito.trim() || undefined,
                    factura: factura.trim() || undefined,
                  });
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
