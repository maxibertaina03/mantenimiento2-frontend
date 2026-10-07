import { useEffect, useState } from 'react';
import { useUsuarioActual } from '@/api/usuarios';
import { useAnularOrdenTrabajo, useAsignables, useCerrarOrdenTrabajo, useEditarOrdenTrabajo, useEliminarOrdenTrabajo, useOrdenTrabajo, useQuitarMaterialUsado, useReabrirOrdenTrabajo, useReasignarOrdenTrabajo, useUsarMaterial } from '@/api/ordenesTrabajo';
import { CampoNumero } from '@/componentes/CampoNumero';
import { ComboEquipo } from '@/componentes/ComboEquipo';
import { ComboMaterial } from '@/componentes/ComboMaterial';
import { Cargando, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { ImprimirOrdenTrabajo, MandarATaller } from '@/componentes/OrdenATaller';
import {
  DATOS_DEL_TRABAJO_VACIOS,
  faltaElProveedor,
  paraEnviar,
  type DatosDelTrabajo,
} from '@/lib/datosDelTrabajo';
import { MasDatosTrabajo } from '@/componentes/MasDatosTrabajo';
import { formatearFecha, formatearNumero } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { ETIQUETA_EJECUTOR, ETIQUETA_ESTADO_TRABAJO, ETIQUETA_TIPO_TRABAJO } from '@/tipos/ordenTrabajo';
import type { Material } from '@/tipos/material';
import { CLASE_ESTADO } from './estado';

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

  const { data: yo } = useUsuarioActual();
  const reasignar = useReasignarOrdenTrabajo();
  const puedeReasignar = puede(P.TRABAJOS_ASIGNAR) && orden?.estado === 'ABIERTA';
  const { data: asignables } = useAsignables(puedeReasignar);

  /**
   * El trabajo es de quien lo tiene asignado. Los demás ven la orden entera
   * —saber qué pasa en la planta es de todos— pero no pueden cargarle
   * materiales ni cerrarla. El backend lo vuelve a comprobar; esto es no
   * ofrecer botones que van a dar error.
   */
  const esMia = !!yo && orden?.asignadoAId === yo.id;
  const editable = orden?.estado === 'ABIERTA' && puede(P.TRABAJOS_EDITAR) && esMia;

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

  return (
    <Modal
      titulo={orden ? `Orden ${orden.numero}` : 'Orden de trabajo'}
      abierto
      tamano="ancho"
      onCerrar={onCerrar}
    >
      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {orden && (
        <div className="formulario-modal">
          <div className="fila-acciones">
            <span className={CLASE_ESTADO[orden.estado]}>
              {ETIQUETA_ESTADO_TRABAJO[orden.estado]}
            </span>
            <span className="texto-suave">{ETIQUETA_TIPO_TRABAJO[orden.tipo]}</span>
            {orden.estado !== 'ANULADA' && <ImprimirOrdenTrabajo orden={orden} />}
          </div>

          <h3 className="subtitulo-form">{orden.titulo}</h3>
          {orden.descripcion && <p>{orden.descripcion}</p>}

          <p className="texto-suave texto-chico">
            Abierta el {formatearFecha(orden.abiertaEn)}
            {orden.abiertaPorNombre ? ` por ${orden.abiertaPorNombre}` : ''}
            {orden.equipoNombre ? ` · Equipo: ${orden.equipoNombre}` : ''}
          </p>

          <p>
            <span className="texto-suave">Asignada a: </span>
            <strong>{orden.asignadoANombre ?? '—'}</strong>
            {esMia && <span className="texto-suave"> (vos)</span>}
          </p>

          {editable && <MandarATaller orden={orden} />}
          {!editable && orden.estado === 'ABIERTA' && orden.ejecutor === 'EXTERNO' && (
            <p>
              <span className="texto-suave">Se manda a: </span>
              <strong>{orden.proveedorNombre}</strong>
            </p>
          )}

          {/* Dicho de frente, para que nadie se quede buscando el botón. */}
          {!esMia && orden.estado === 'ABIERTA' && (
            <p className="aviso-escaneo es-error">
              Este trabajo es de {orden.asignadoANombre ?? 'otra persona'}. Podés verlo, pero lo
              termina quien lo tiene a cargo.
            </p>
          )}

          {puedeReasignar && (
            <label className="campo">
              Pasarle el trabajo a otra persona
              <div className="fila-acciones">
                <select value={nuevoAsignado} onChange={(e) => setNuevoAsignado(e.target.value)}>
                  <option value="">Elegí a quién</option>
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
              {reasignar.error && <MensajeError error={reasignar.error} />}
            </label>
          )}

          {/* Relacionar la máquina después: es el caso del administrador que
              revisa una orden que cargó mantenimiento sin equipo. */}
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

          <h3 className="subtitulo-form">Materiales usados</h3>

          {editable && (
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
                disabled={!material || cantidad === undefined || cantidad <= 0 || usar.isPending}
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
              Todavía no se cargó ningún material. Lo que cargues acá sale del pañol de verdad.
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

          {orden.estado === 'CERRADA' && (
            <>
              <h3 className="subtitulo-form">Qué se hizo</h3>
              <p>{orden.resolucion}</p>
              {(orden.ejecutor === 'EXTERNO' ||
                orden.costoManoObra !== null ||
                orden.horasParada !== null) && (
                <p className="texto-chico">
                  {orden.ejecutor === 'EXTERNO'
                    ? `${ETIQUETA_EJECUTOR.EXTERNO}${orden.proveedorNombre ? `: ${orden.proveedorNombre}` : ''}`
                    : ETIQUETA_EJECUTOR.INTERNO}
                  {orden.costoManoObra !== null &&
                    ` · Mano de obra $${formatearNumero(orden.costoManoObra)}`}
                  {orden.horasParada !== null &&
                    ` · ${formatearNumero(orden.horasParada)} horas parada`}
                </p>
              )}
              <p className="texto-suave texto-chico">
                Cerrada el {orden.cerradaEn ? formatearFecha(orden.cerradaEn) : '—'}
                {orden.cerradaPorNombre ? ` por ${orden.cerradaPorNombre}` : ''}
              </p>
            </>
          )}

          {orden.estado === 'ANULADA' && (
            <>
              <p className="texto-suave">Anulada: {orden.motivoAnulacion}</p>

              {/* Borrar de verdad, y solo acá: una orden anulada nunca movió
                  stock, así que no deja ninguna salida huérfana. El backend
                  vuelve a comprobarlo, esto es solo no ofrecer lo imposible. */}
              {puede(P.TRABAJOS_ELIMINAR) && (
                <div className="acciones">
                  {eliminar.error && <MensajeError error={eliminar.error} />}
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
                </div>
              )}
            </>
          )}

          {editable && (
            <>
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
              {cerrarOrden.error && <MensajeError error={cerrarOrden.error} />}
              {anular.error && <MensajeError error={anular.error} />}
              <div className="acciones">
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
                <button
                  type="button"
                  className="btn btn-primario"
                  disabled={
                    cerrarOrden.isPending || resolucion.trim() === '' || faltaElProveedor(masDatos)
                  }
                  onClick={() => cerrarOrden.mutate({ id, resolucion, ...paraEnviar(masDatos) })}
                >
                  {cerrarOrden.isPending ? 'Cerrando…' : 'Cerrar orden'}
                </button>
              </div>
            </>
          )}

          {orden.estado === 'CERRADA' && puede(P.TRABAJOS_EDITAR) && esMia && (
            <div className="acciones">
              <button
                type="button"
                className="btn"
                disabled={reabrir.isPending}
                onClick={() => reabrir.mutate(id)}
              >
                Reabrir
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
