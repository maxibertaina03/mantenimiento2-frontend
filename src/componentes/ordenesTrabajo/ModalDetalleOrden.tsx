import { useEffect, useState } from 'react';
import { useUsuarioActual } from '@/api/usuarios';
import {
  useAnularOrdenTrabajo,
  useAsignables,
  useCerrarOrdenTrabajo,
  useEditarOrdenTrabajo,
  useEliminarOrdenTrabajo,
  useEnviosDeTrabajo,
  useOrdenTrabajo,
  useQuitarMaterialUsado,
  useReabrirOrdenTrabajo,
  useReasignarOrdenTrabajo,
  useUsarMaterial,
} from '@/api/ordenesTrabajo';
import { CampoNumero } from '@/componentes/CampoNumero';
import { ComboEquipo } from '@/componentes/ComboEquipo';
import { ComboMaterial } from '@/componentes/ComboMaterial';
import { EnviarOrdenTrabajo } from '@/componentes/EnviarOrdenTrabajo';
import { Cargando, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { ImprimirOrdenTrabajo, MandarATaller } from '@/componentes/OrdenATaller';
import { VolvioDelTaller } from '@/componentes/VolvioDelTaller';
import {
  DATOS_DEL_TRABAJO_VACIOS,
  faltaElProveedor,
  paraEnviar,
  type DatosDelTrabajo,
} from '@/lib/datosDelTrabajo';
import { MasDatosTrabajo } from '@/componentes/MasDatosTrabajo';
import { formatearFecha, formatearNumero } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import {
  ETIQUETA_EJECUTOR,
  ETIQUETA_ESTADO_TRABAJO,
  ETIQUETA_TIPO_TRABAJO,
} from '@/tipos/ordenTrabajo';
import type { Material } from '@/tipos/material';
import { CLASE_ESTADO } from './estado';

type Pestana = 'materiales' | 'detalle' | 'envios';

/**
 * El detalle de una orden de trabajo.
 *
 * Arriba, siempre a la vista: qué es, de quién, a qué taller va si va afuera,
 * y la acción que toca ahora —cerrarla, o registrar que volvió del taller—.
 * Abajo, pestañas: los materiales, el detalle y, si va afuera, los envíos.
 *
 * Una orden que se hace en un taller de afuera no muestra la carga de
 * materiales (los pone el taller) ni, a quien la tiene, el «pasarle el trabajo
 * a otro»: el trabajo lo hace el proveedor, y lo único que queda de este lado
 * es mandársela y registrar la vuelta.
 */
export function ModalDetalleOrden({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  const puede = usePuede();
  const { data: orden, isLoading, error } = useOrdenTrabajo(id);

  const usar = useUsarMaterial();
  const quitar = useQuitarMaterialUsado();
  const cerrarOrden = useCerrarOrdenTrabajo();
  const reabrir = useReabrirOrdenTrabajo();
  const anular = useAnularOrdenTrabajo();
  const eliminar = useEliminarOrdenTrabajo();
  const editar = useEditarOrdenTrabajo();

  const [material, setMaterial] = useState<Material | null>(null);
  const [cantidad, setCantidad] = useState<number | undefined>(undefined);
  const [resolucion, setResolucion] = useState('');
  const [masDatos, setMasDatos] = useState<DatosDelTrabajo>(DATOS_DEL_TRABAJO_VACIOS);
  const [equipoNuevo, setEquipoNuevo] = useState<{ id: string; nombre: string } | null>(null);
  const [nuevoAsignado, setNuevoAsignado] = useState('');
  const [enviandoAlTaller, setEnviandoAlTaller] = useState(false);
  const [volviendo, setVolviendo] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [pestanaElegida, setPestanaElegida] = useState<Pestana | null>(null);

  const { data: yo } = useUsuarioActual();
  const reasignar = useReasignarOrdenTrabajo();
  const externa = orden?.ejecutor === 'EXTERNO';
  const envios = useEnviosDeTrabajo(id, Boolean(orden) && externa);

  /**
   * El trabajo es de quien lo tiene asignado. Los demás ven la orden entera
   * —saber qué pasa en la planta es de todos— pero no pueden cargarle
   * materiales ni cerrarla. El backend lo vuelve a comprobar; esto es no
   * ofrecer botones que van a dar error.
   */
  const esMia = !!yo && orden?.asignadoAId === yo.id;
  const editable = orden?.estado === 'ABIERTA' && puede(P.TRABAJOS_EDITAR) && esMia;
  // En una externa, pasársela a otro sirve solo para destrabarla cuando quien
  // la tiene no está: a esa persona no se le ofrece.
  const puedeReasignar =
    puede(P.TRABAJOS_ASIGNAR) && orden?.estado === 'ABIERTA' && (!externa || !esMia);
  const { data: asignables } = useAsignables(puedeReasignar);

  // Si ya se dijo a qué taller va, el cierre arranca con eso cargado: que no
  // haya que elegirlo dos veces, ni que se pierda por cerrar sin abrir «Más datos».
  const ejecutorGuardado = orden?.ejecutor;
  const proveedorGuardado = orden?.proveedorId;
  const nombreProveedorGuardado = orden?.proveedorNombre;
  useEffect(() => {
    if (!ejecutorGuardado) return;
    setMasDatos((d) => ({
      ...d,
      ejecutor: ejecutorGuardado,
      proveedorId: proveedorGuardado ?? '',
      proveedorNombre: nombreProveedorGuardado ?? undefined,
    }));
  }, [ejecutorGuardado, proveedorGuardado, nombreProveedorGuardado]);

  const agregar = async (m: Material, cuanto: number) => {
    await usar.mutateAsync({ ordenId: id, materialId: m.id, cantidad: cuanto });
    setMaterial(null);
    setCantidad(undefined);
  };

  if (!orden) {
    return (
      <Modal titulo="Orden de trabajo" abierto tamano="ancho" onCerrar={onCerrar}>
        {isLoading && <Cargando />}
        {error && <MensajeError error={error} />}
      </Modal>
    );
  }

  // Los materiales de una externa los pone el taller: la pestaña aparece solo
  // si igual se cargó alguno.
  const verMateriales = !externa || orden.materiales.length > 0;
  const pestanas: { id: Pestana; titulo: string; cuenta?: number }[] = [
    ...(verMateriales
      ? [{ id: 'materiales' as const, titulo: 'Materiales', cuenta: orden.materiales.length }]
      : []),
    { id: 'detalle', titulo: 'Detalle' },
    ...(externa ? [{ id: 'envios' as const, titulo: 'Envíos', cuenta: envios.data?.length }] : []),
  ];
  // Por defecto: lo que se va a mirar. En una abierta de fábrica, los
  // materiales; en lo demás, qué pasó.
  const porDefecto: Pestana =
    orden.estado === 'ABIERTA' && verMateriales && !externa ? 'materiales' : 'detalle';
  const pestana =
    pestanaElegida && pestanas.some((p) => p.id === pestanaElegida) ? pestanaElegida : porDefecto;

  const errorAccion =
    cerrarOrden.error ?? anular.error ?? eliminar.error ?? reabrir.error ?? editar.error;

  return (
    <Modal titulo={`Orden ${orden.numero}`} abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal detalle-oc">
        {/* ── Encabezado: siempre a la vista ── */}
        <div className="detalle-oc-cabecera">
          <div className="detalle-oc-titulo">
            <strong className="detalle-oc-proveedor">{orden.titulo}</strong>
            <span className={CLASE_ESTADO[orden.estado]}>
              {ETIQUETA_ESTADO_TRABAJO[orden.estado]}
            </span>
            <span className="texto-suave">{ETIQUETA_TIPO_TRABAJO[orden.tipo]}</span>
          </div>
          <div className="texto-suave texto-chico detalle-oc-datos">
            <span>
              Abierta el {formatearFecha(orden.abiertaEn)}
              {orden.abiertaPorNombre ? ` por ${orden.abiertaPorNombre}` : ''}
            </span>
            {(orden.equipoNombre || orden.equipoItNombre) && (
              <span>Equipo: {orden.equipoNombre ?? orden.equipoItNombre}</span>
            )}
            <span>
              Asignada a: <strong>{orden.asignadoANombre ?? '—'}</strong>
              {esMia && ' (vos)'}
            </span>
          </div>

          {/* A qué taller va, y cambiarlo. */}
          {editable && <MandarATaller orden={orden} />}
          {!editable && orden.estado === 'ABIERTA' && externa && (
            <p className="detalle-oc-datos">
              <span className="texto-suave">Se manda a: </span>
              <strong>{orden.proveedorNombre}</strong>
            </p>
          )}

          {!cerrando && (
            <div className="detalle-oc-acciones">
              {editable && externa && (
                <button
                  type="button"
                  className="btn btn-primario"
                  onClick={() => setVolviendo(true)}
                >
                  ✔ Volvió del taller
                </button>
              )}
              {editable && !externa && (
                <button
                  type="button"
                  className="btn btn-primario"
                  onClick={() => setCerrando(true)}
                >
                  ✔ Cerrar orden
                </button>
              )}
              {orden.estado === 'ABIERTA' &&
                externa &&
                orden.proveedorId &&
                puede(P.TRABAJOS_EDITAR) && (
                  <button type="button" className="btn" onClick={() => setEnviandoAlTaller(true)}>
                    ✉ Mandársela al taller
                  </button>
                )}
              {orden.estado !== 'ANULADA' && <ImprimirOrdenTrabajo orden={orden} />}
              {orden.estado === 'CERRADA' && puede(P.TRABAJOS_EDITAR) && esMia && (
                <button
                  type="button"
                  className="btn"
                  disabled={reabrir.isPending}
                  onClick={() => reabrir.mutate(id)}
                >
                  Reabrir
                </button>
              )}
              {editable && (
                <button
                  type="button"
                  className="btn btn-peligro"
                  disabled={anular.isPending}
                  onClick={() => {
                    const motivo = prompt('¿Por qué se anula esta orden?');
                    if (motivo) anular.mutate({ id, motivo });
                  }}
                >
                  Anular
                </button>
              )}
              {/* Borrar de verdad, y solo una anulada: nunca movió stock, así
                  que no deja ninguna salida huérfana. El backend lo vuelve a
                  comprobar; esto es solo no ofrecer lo imposible. */}
              {orden.estado === 'ANULADA' && puede(P.TRABAJOS_ELIMINAR) && (
                <button
                  type="button"
                  className="btn btn-peligro"
                  disabled={eliminar.isPending}
                  onClick={() => {
                    if (!confirm(`¿Eliminar la orden ${orden.numero}? No se puede deshacer.`)) {
                      return;
                    }
                    eliminar.mutate(id, { onSuccess: onCerrar });
                  }}
                >
                  {eliminar.isPending ? 'Eliminando…' : 'Eliminar'}
                </button>
              )}
            </div>
          )}

          {/* Pasárselo a otro: al lado de a quién está asignada. */}
          {puedeReasignar && (
            <div className="fila-acciones">
              <select
                aria-label="Pasarle el trabajo a otra persona"
                value={nuevoAsignado}
                onChange={(e) => setNuevoAsignado(e.target.value)}
              >
                <option value="">Pasarle el trabajo a…</option>
                {(asignables ?? [])
                  .filter((u) => u.id !== orden.asignadoAId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!nuevoAsignado || reasignar.isPending}
                onClick={() =>
                  reasignar.mutate(
                    { id, asignadoAId: nuevoAsignado },
                    { onSuccess: () => setNuevoAsignado('') },
                  )
                }
              >
                {reasignar.isPending ? 'Pasando…' : 'Reasignar'}
              </button>
            </div>
          )}
          {reasignar.error && <MensajeError error={reasignar.error} />}
        </div>

        {/* Dicho de frente, para que nadie se quede buscando el botón. */}
        {!esMia && orden.estado === 'ABIERTA' && (
          <p className="aviso-escaneo es-error">
            Este trabajo es de {orden.asignadoANombre ?? 'otra persona'}. Podés verlo, pero lo
            termina quien lo tiene a cargo.
          </p>
        )}
        {errorAccion && <MensajeError error={errorAccion} />}

        {/* ── Cerrar: debajo del encabezado, donde se está mirando ── */}
        {cerrando && editable && (
          <div className="panel">
            <h3 className="subtitulo-form">Cerrar el trabajo</h3>
            <label className="campo">
              Qué se hizo
              <textarea
                rows={3}
                value={resolucion}
                maxLength={2000}
                placeholder="Se cambio el sello mecanico y la junta de la tapa"
                onChange={(e) => setResolucion(e.target.value)}
              />
            </label>
            {/* Si se mandó a reparar afuera, acá se dice a quién. */}
            <MasDatosTrabajo datos={masDatos} onCambio={setMasDatos} />
            <div className="acciones">
              <button type="button" className="btn" onClick={() => setCerrando(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primario"
                disabled={
                  cerrarOrden.isPending || resolucion.trim() === '' || faltaElProveedor(masDatos)
                }
                onClick={() =>
                  cerrarOrden.mutate(
                    { id, resolucion, ...paraEnviar(masDatos) },
                    { onSuccess: () => setCerrando(false) },
                  )
                }
              >
                {cerrarOrden.isPending ? 'Cerrando…' : 'Confirmar el cierre'}
              </button>
            </div>
          </div>
        )}

        {/* ── Pestañas ── */}
        {!cerrando && (
          <>
            <div className="pestanas-equipo" role="tablist" aria-label="Secciones de la orden">
              {pestanas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={pestana === p.id}
                  className={pestana === p.id ? 'pestana-equipo activa' : 'pestana-equipo'}
                  onClick={() => setPestanaElegida(p.id)}
                >
                  {p.titulo}
                  {p.cuenta ? <span className="contador-pestana">{p.cuenta}</span> : null}
                </button>
              ))}
            </div>

            <div role="tabpanel" className="detalle-oc-panel">
              {pestana === 'materiales' && (
                <>
                  {editable && !externa && (
                    <div className="panel alta-renglon">
                      <label className="alta-renglon-material">
                        Material
                        <ComboMaterial
                          key={`material-${orden.materiales.length}`}
                          materialId=""
                          onCambio={setMaterial}
                          enfocarAlMontar={orden.materiales.length > 0}
                        />
                      </label>
                      <label>
                        Cantidad
                        <CampoNumero
                          step="0.001"
                          min="0.001"
                          placeholder="0"
                          valor={cantidad}
                          onCambio={setCantidad}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-primario alta-renglon-boton"
                        disabled={
                          !material || cantidad === undefined || cantidad <= 0 || usar.isPending
                        }
                        onClick={() => material && cantidad && void agregar(material, cantidad)}
                      >
                        {usar.isPending ? 'Sacando…' : '+ Usar'}
                      </button>
                    </div>
                  )}

                  {usar.error && <MensajeError error={usar.error} />}
                  {quitar.error && <MensajeError error={quitar.error} />}

                  {orden.materiales.length === 0 && (
                    <p className="texto-suave">
                      Todavía no se cargó ningún material. Lo que cargues acá sale del pañol de
                      verdad.
                    </p>
                  )}

                  {orden.materiales.length > 0 && (
                    <div className="tabla-scroll tabla-cards-contenedor">
                      <table className="tabla tabla-cards">
                        <thead>
                          <tr>
                            <th>Material</th>
                            <th>Cantidad</th>
                            <th>Cargado</th>
                            {editable && <th />}
                          </tr>
                        </thead>
                        <tbody>
                          {orden.materiales.map((m) => (
                            <tr key={m.id}>
                              <td data-etiqueta="Material">{m.materialNombre}</td>
                              <td data-etiqueta="Cantidad">
                                {formatearNumero(m.cantidad)} {m.unidad}
                              </td>
                              <td data-etiqueta="Cargado">{formatearFecha(m.creadoEn)}</td>
                              {editable && (
                                <td className="celda-acciones">
                                  <button
                                    className="btn btn-sm btn-peligro"
                                    disabled={quitar.isPending}
                                    onClick={() => quitar.mutate(m.id)}
                                  >
                                    Quitar
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {pestana === 'detalle' && (
                <>
                  {orden.descripcion ? (
                    <p>{orden.descripcion}</p>
                  ) : (
                    orden.estado === 'ABIERTA' && (
                      <p className="texto-suave">Sin más detalle que el título.</p>
                    )
                  )}

                  {orden.estado === 'CERRADA' && (
                    <>
                      <h3 className="subtitulo-form">Qué se hizo</h3>
                      <p>{orden.resolucion}</p>
                      {(externa || orden.costoManoObra !== null || orden.horasParada !== null) && (
                        <p className="texto-chico">
                          {externa
                            ? `${ETIQUETA_EJECUTOR.EXTERNO}${orden.proveedorNombre ? `: ${orden.proveedorNombre}` : ''}`
                            : ETIQUETA_EJECUTOR.INTERNO}
                          {orden.costoManoObra !== null &&
                            ` · Mano de obra $${formatearNumero(orden.costoManoObra)}`}
                          {orden.horasParada !== null &&
                            ` · ${formatearNumero(orden.horasParada)} horas parada`}
                          {orden.comprobanteExterno &&
                            ` · Comprobante del taller: ${orden.comprobanteExterno}`}
                        </p>
                      )}
                      <p className="texto-suave texto-chico">
                        Cerrada el {orden.cerradaEn ? formatearFecha(orden.cerradaEn) : '—'}
                        {orden.cerradaPorNombre ? ` por ${orden.cerradaPorNombre}` : ''}
                      </p>
                    </>
                  )}

                  {orden.estado === 'ANULADA' && (
                    <p className="texto-suave">Anulada: {orden.motivoAnulacion}</p>
                  )}

                  {/* Relacionar la máquina después: es el caso del administrador
                      que revisa una orden que cargó mantenimiento sin equipo. */}
                  {editable && puede(P.EQUIPOS_VER) && !orden.equipoId && (
                    <label className="campo">
                      Relacionar con un equipo
                      <ComboEquipo onCambio={setEquipoNuevo} />
                      {equipoNuevo && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primario"
                          onClick={() => editar.mutate({ id, equipoId: equipoNuevo.id })}
                          disabled={editar.isPending}
                        >
                          Relacionar con «{equipoNuevo.nombre}»
                        </button>
                      )}
                    </label>
                  )}
                </>
              )}

              {pestana === 'envios' &&
                (envios.data && envios.data.length > 0 ? (
                  <ul className="lista-envios">
                    {envios.data.map((e) => (
                      <li key={e.id}>
                        <span>
                          {e.via === 'CORREO' ? '✉' : '💬'} {e.destinatarios}
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
                  <p className="texto-suave">Todavía no se le mandó al taller.</p>
                ))}
            </div>
          </>
        )}
      </div>

      {enviandoAlTaller && (
        <EnviarOrdenTrabajo orden={orden} onCerrar={() => setEnviandoAlTaller(false)} />
      )}
      {volviendo && <VolvioDelTaller orden={orden} onCerrar={() => setVolviendo(false)} />}
    </Modal>
  );
}
