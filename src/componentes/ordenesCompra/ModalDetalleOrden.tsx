import { useState } from 'react';
import { useComprobantes } from '@/api/comprobantes';
import {
  useAnularOrden,
  useCerrarConFaltante,
  useCorregirPrecios,
  useEliminarOrden,
  useEmitirOrden,
  useEnviosDeOrden,
} from '@/api/ordenesCompra';
import { CampoNumero } from '@/componentes/CampoNumero';
import { ComprobantesOrden } from '@/componentes/ComprobantesOrden';
import { MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { formatearFecha, formatearNumero } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { descargarPdfOrdenCompra } from '@/lib/pdfOrdenCompra';
import { ETIQUETA_ESTADO_ORDEN, nombreDelRenglon } from '@/tipos/ordenCompra';
import type { OrdenCompra } from '@/tipos/ordenCompra';
import { CLASE_ESTADO, moneda } from './formato';
import { ReclamarFaltante } from './ReclamarFaltante';
import { RecibirMercaderia } from './RecibirMercaderia';

type Pestana = 'detalle' | 'entregas' | 'comprobantes' | 'envios';

/**
 * El detalle de una orden de compra.
 *
 * Arriba, siempre a la vista: quién, en qué estado, cuánto, y la acción que
 * toca ahora (enviarla, recibirla, reclamar lo que falta). Abajo, pestañas:
 * el detalle, las entregas, los comprobantes y los envíos. Antes era todo una
 * columna y para llegar a «Recibir» había que bajar hasta el final.
 *
 * Los formularios —recibir, cerrar con faltante, corregir precios— se abren
 * debajo del encabezado, donde se está mirando, y no al pie.
 */
export function ModalDetalleOrden({
  orden: ordenDeLaLista,
  onCerrar,
  onEnviar,
}: {
  orden: OrdenCompra;
  onCerrar: () => void;
  onEnviar?: (orden: OrdenCompra) => void;
}) {
  // La orden llega de la lista. Al corregir precios o recibir, el servidor
  // devuelve la nueva, y es la que tienen que usar la tabla, el PDF y el envío.
  const [orden, setOrden] = useState(ordenDeLaLista);
  const puede = usePuede();
  const [pestana, setPestana] = useState<Pestana>('detalle');

  const corregir = useCorregirPrecios(orden.id);
  const emitir = useEmitirOrden(orden.id);
  const anular = useAnularOrden(orden.id);
  const eliminar = useEliminarOrden();
  const cerrarConFaltante = useCerrarConFaltante(orden.id);
  const comprobantes = useComprobantes(orden.id, orden.estado !== 'BORRADOR');
  const envios = useEnviosDeOrden(orden.id, orden.estado !== 'BORRADOR');

  const [editandoPrecios, setEditandoPrecios] = useState(false);
  const [precios, setPrecios] = useState<Record<string, number | undefined>>({});
  const [preciosGuardados, setPreciosGuardados] = useState(false);
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
  // La columna de lo recibido se muestra cuando hay algo que contar.
  const mostrarRecibido =
    orden.estado === 'RECIBIDA_PARCIAL' || orden.cerradaConFaltante || recepciones.length > 1;
  const puedeCorregirPrecios =
    puede(P.ORDENES_EDITAR) &&
    (orden.estado === 'EMITIDA' ||
      orden.estado === 'RECIBIDA_PARCIAL' ||
      orden.estado === 'RECIBIDA');
  /** Hay un formulario abierto: las acciones del encabezado se apartan. */
  const formularioAbierto = mostrarRecepcion || cerrandoConFaltante || editandoPrecios;

  const empezarAEditarPrecios = () => {
    setPrecios(Object.fromEntries(orden.renglones.map((r) => [r.id, r.precioUnitario ?? undefined])));
    setPreciosGuardados(false);
    setPestana('detalle');
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
    try {
      setOrden(await corregir.mutateAsync(preciosCambiados));
      setEditandoPrecios(false);
      setPreciosGuardados(true);
    } catch {
      // El rechazo se muestra abajo.
    }
  };

  const errorAccion =
    emitir.error ?? anular.error ?? eliminar.error ?? corregir.error ?? cerrarConFaltante.error;

  const pestanas: { id: Pestana; titulo: string; cuenta?: number; alerta?: boolean }[] = [
    { id: 'detalle', titulo: 'Detalle', cuenta: orden.renglones.length },
    // Con una sola entrega completa, el encabezado ya dice el remito.
    ...(mostrarRecibido && recepciones.length > 0
      ? [{ id: 'entregas' as const, titulo: 'Entregas', cuenta: recepciones.length }]
      : []),
    ...(orden.estado !== 'BORRADOR'
      ? [
          {
            id: 'comprobantes' as const,
            titulo: 'Comprobantes',
            cuenta: comprobantes.data?.length,
          },
          { id: 'envios' as const, titulo: 'Envíos', cuenta: envios.data?.length },
        ]
      : []),
  ];

  return (
    <Modal titulo={`Orden ${orden.numero}`} abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal detalle-oc">
        {/* ── Encabezado: siempre a la vista ── */}
        <div className="detalle-oc-cabecera">
          <div className="detalle-oc-titulo">
            <strong className="detalle-oc-proveedor">{orden.proveedorNombre ?? '—'}</strong>
            <span className={CLASE_ESTADO[orden.estado]}>{ETIQUETA_ESTADO_ORDEN[orden.estado]}</span>
            {orden.total !== null && (
              <span className="detalle-oc-total">{moneda(orden.total)}</span>
            )}
          </div>
          <div className="texto-suave texto-chico detalle-oc-datos">
            <span>{formatearFecha(orden.fecha)}</span>
            {orden.creadoPorNombre && <span>Solicitó {orden.creadoPorNombre}</span>}
            {orden.proveedorCuit && <span>CUIT {orden.proveedorCuit}</span>}
            {orden.recibidaEn && (
              <span>
                Recibida {formatearFecha(orden.recibidaEn)}
                {orden.recibidaPorNombre ? ` · ${orden.recibidaPorNombre}` : ''}
              </span>
            )}
            {/* El comprobante con el que llegó: se compara contra el papel. */}
            {orden.remito && (
              <span>
                Remito <strong>{orden.remito}</strong>
              </span>
            )}
            {orden.factura && (
              <span>
                Factura <strong>{orden.factura}</strong>
              </span>
            )}
          </div>

          {!formularioAbierto && (
            <div className="detalle-oc-acciones">
              {orden.estado === 'BORRADOR' && (
                <button
                  className="btn btn-primario"
                  disabled={emitir.isPending}
                  onClick={async () => {
                    // Imprimir y marcar como enviada es un solo gesto.
                    await descargarPdfOrdenCompra(orden);
                    await emitir.mutateAsync();
                    onEnviar?.(orden);
                    onCerrar();
                  }}
                >
                  {emitir.isPending ? 'Procesando…' : '🖨 Imprimir y enviar al proveedor'}
                </button>
              )}
              {esperaMercaderia && (
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
              {orden.estado === 'RECIBIDA_PARCIAL' && (
                <button className="btn" onClick={() => setReclamando(true)}>
                  ✉ Reclamar lo que falta
                </button>
              )}
              {onEnviar && orden.estado !== 'BORRADOR' && (
                <button
                  className="btn"
                  aria-label="Enviar al proveedor"
                  title="Enviar al proveedor"
                  onClick={() => onEnviar(orden)}
                >
                  ✉ Enviar
                </button>
              )}
              <button
                className="btn"
                aria-label="Descargar PDF"
                title="Descargar PDF"
                onClick={() => descargarPdfOrdenCompra(orden)}
              >
                🖨 PDF
              </button>
              {puedeCorregirPrecios && (
                <button
                  className="btn"
                  aria-label="Cargar o corregir precios"
                  title="Cargar o corregir precios"
                  onClick={empezarAEditarPrecios}
                >
                  ✏ Precios
                </button>
              )}
              {orden.estado === 'RECIBIDA_PARCIAL' && (
                <button className="btn" onClick={() => setCerrandoConFaltante(true)}>
                  Cerrar con lo que llegó
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
            </div>
          )}
        </div>

        {/* ── Cómo está: una línea, solo cuando dice algo ── */}
        {orden.estado === 'RECIBIDA_PARCIAL' && !formularioAbierto && (
          <div className="alerta alerta-aviso">
            {recienRecibida ? '✔ Entrega registrada. ' : ''}
            Llegó una parte y ya sumó al stock. Falta{' '}
            {pendientes.length === 1 ? 'un renglón' : `${pendientes.length} renglones`}: reclamalo, o
            recibilo cuando llegue.
          </div>
        )}
        {orden.estado === 'RECIBIDA' && orden.cerradaConFaltante && (
          <div className="alerta alerta-aviso">
            Cerrada con lo que llegó: lo que faltó quedó sin recibir.
            {orden.motivoFaltante && (
              <>
                {' '}
                Motivo: <strong>{orden.motivoFaltante}</strong>.
              </>
            )}
          </div>
        )}
        {orden.estado === 'RECIBIDA' && !orden.cerradaConFaltante && recienRecibida && (
          <div className="alerta alerta-exito">
            ✔ Orden finalizada: la mercadería ingresó al stock.
          </div>
        )}
        {preciosGuardados && (
          <div className="alerta alerta-exito">
            ✔ Precios guardados. Descargá el PDF de nuevo (o enviáselo) para que el proveedor
            tenga la orden completa.
          </div>
        )}
        {errorAccion && <MensajeError error={errorAccion} />}

        {/* ── Los formularios, donde se está mirando ── */}
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
              setPestana('detalle');
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
                    // El rechazo se muestra arriba.
                  }
                }}
              >
                {cerrarConFaltante.isPending ? 'Cerrando…' : 'Cerrar la orden'}
              </button>
            </div>
          </div>
        )}

        {/* ── Pestañas ── */}
        {!mostrarRecepcion && !cerrandoConFaltante && (
          <>
            {pestanas.length > 1 && (
              <div className="pestanas-equipo" role="tablist" aria-label="Secciones de la orden">
                {pestanas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={pestana === p.id}
                    className={pestana === p.id ? 'pestana-equipo activa' : 'pestana-equipo'}
                    onClick={() => setPestana(p.id)}
                  >
                    {p.titulo}
                    {p.cuenta ? <span className="contador-pestana">{p.cuenta}</span> : null}
                  </button>
                ))}
              </div>
            )}

            <div role="tabpanel" className="detalle-oc-panel">
              {pestana === 'detalle' && (
                <>
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
                                {formatearNumero(r.cantidadRecibida)} de{' '}
                                {formatearNumero(r.cantidad)}
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
                                  className={
                                    r.precioUnitario === null ? 'renglon-sin-precio' : undefined
                                  }
                                >
                                  {r.precioUnitario === null
                                    ? 'Sin precio'
                                    : moneda(r.precioUnitario)}
                                </td>
                                <td data-etiqueta="Subtotal">{moneda(r.subtotal)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
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

                  {orden.observaciones && (
                    <p className="detalle-oc-observaciones">
                      <span className="texto-suave texto-chico">Observaciones · </span>
                      {orden.observaciones}
                    </p>
                  )}
                </>
              )}

              {pestana === 'entregas' && (
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
              )}

              {/* El papel del remito o la factura: se carga desde que la orden
                  salió, a veces antes de terminar de contar la mercadería. */}
              {pestana === 'comprobantes' && <ComprobantesOrden ordenId={orden.id} />}

              {pestana === 'envios' &&
                (envios.data && envios.data.length > 0 ? (
                  <ul className="lista-envios">
                    {envios.data.map((e) => (
                      <li key={e.id}>
                        <span>
                          {e.via === 'CORREO' ? '✉' : '💬'} {e.esReclamo ? 'Reclamo · ' : ''}
                          {e.destinatarios}
                          {!e.automatico && <span className="texto-suave"> (a mano)</span>}
                        </span>
                        <span className="texto-suave texto-chico">
                          {formatearFecha(e.enviadoEn)}
                          {e.usuarioNombre && ` · ${e.usuarioNombre}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="texto-suave">Todavía no se le mandó al proveedor.</p>
                ))}
            </div>
          </>
        )}
      </div>

      {reclamando && <ReclamarFaltante orden={orden} onCerrar={() => setReclamando(false)} />}
    </Modal>
  );
}
