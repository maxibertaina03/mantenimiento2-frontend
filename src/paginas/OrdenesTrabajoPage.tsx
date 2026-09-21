import { useEffect, useState } from 'react';
import { useUsuarioActual } from '@/api/usuarios';
import {
  useAnularOrdenTrabajo,
  useAsignables,
  useCerrarOrdenTrabajo,
  useCrearOrdenTrabajo,
  useEditarOrdenTrabajo,
  useEliminarOrdenTrabajo,
  useOrdenesTrabajo,
  useOrdenTrabajo,
  useQuitarMaterialUsado,
  useReabrirOrdenTrabajo,
  useReasignarOrdenTrabajo,
  useUsarMaterial,
} from '@/api/ordenesTrabajo';
import { CampoNumero } from '@/componentes/CampoNumero';
import { ComboEquipo } from '@/componentes/ComboEquipo';
import { ComboMaterial } from '@/componentes/ComboMaterial';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { formatearFecha, formatearNumero } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import {
  ESTADOS_ORDEN_TRABAJO,
  ETIQUETA_ESTADO_TRABAJO,
  ETIQUETA_TIPO_TRABAJO,
  TIPOS_TRABAJO,
} from '@/tipos/ordenTrabajo';
import type { EstadoOrdenTrabajo, TipoTrabajo } from '@/tipos/ordenTrabajo';
import type { Material } from '@/tipos/material';

const LIMITE = 20;

const CLASE_ESTADO: Record<EstadoOrdenTrabajo, string> = {
  ABIERTA: 'badge badge-aviso',
  CERRADA: 'badge badge-ok',
  ANULADA: 'badge badge-error',
};

/**
 * Órdenes de trabajo: para qué se usó lo que salió del pañol.
 *
 * Antes una salida por trabajo era una fila de stock con una nota suelta y ahí
 * terminaba el rastro. Acá el trabajo, lo que se usó y la máquina quedan juntos.
 */
export function OrdenesTrabajoPage() {
  const puede = usePuede();
  const [pagina, setPagina] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<EstadoOrdenTrabajo | ''>('');
  const [tipo, setTipo] = useState<TipoTrabajo | ''>('');
  const [modalAlta, setModalAlta] = useState(false);
  const [ordenAbierta, setOrdenAbierta] = useState<string | null>(null);
  const [soloMias, setSoloMias] = useState(false);
  const { data: yo } = useUsuarioActual();

  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(buscar);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading, error, isFetching } = useOrdenesTrabajo(pagina, LIMITE, {
    buscar: busqueda,
    estado: estado || undefined,
    tipo: tipo || undefined,
    asignadoAId: soloMias ? (yo?.id ?? undefined) : undefined,
  });

  const ordenes = data?.datos ?? [];
  const abiertas = ordenes.filter((o) => o.estado === 'ABIERTA').length;

  return (
    <div className="pagina">
      <div className="cabecera-pagina">
        <div>
          <h1>Órdenes de trabajo</h1>
          <p className="texto-suave">
            Para qué se usó lo que salió del pañol: qué se hizo, sobre qué máquina y con qué
            materiales.
          </p>
        </div>
        {puede(P.TRABAJOS_EDITAR) && (
          <div className="fila-acciones">
            <button className="btn btn-primario" onClick={() => setModalAlta(true)}>
              + Nueva orden
            </button>
          </div>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="tarjetas-resumen">
          <div className="tarjeta-resumen">
            <span className="tarjeta-numero">{data.total}</span>
            <span className="texto-suave">órdenes</span>
          </div>
          {abiertas > 0 && (
            <div className="tarjeta-resumen">
              <span className="tarjeta-numero">{abiertas}</span>
              <span className="texto-suave">abiertas en esta página</span>
            </div>
          )}
        </div>
      )}

      <div className="buscador">
        <input
          type="search"
          inputMode="search"
          placeholder="🔍 Buscar por número o por lo que se hizo…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        {isFetching && <span className="texto-suave">buscando…</span>}
      </div>

      <div className="grilla-filtros">
        <select
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value as EstadoOrdenTrabajo | '');
            setPagina(1);
          }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_ORDEN_TRABAJO.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO_TRABAJO[e]}
            </option>
          ))}
        </select>
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as TipoTrabajo | '');
            setPagina(1);
          }}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          {TIPOS_TRABAJO.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO_TRABAJO[t]}
            </option>
          ))}
        </select>
        {/* Lo primero que quiere ver cualquiera al entrar: qué le toca a él. */}
        {yo && (
          <label className="casilla">
            <input
              type="checkbox"
              checked={soloMias}
              onChange={(e) => {
                setSoloMias(e.target.checked);
                setPagina(1);
              }}
            />
            Solo las mías
          </label>
        )}
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {data && ordenes.length === 0 && (
        <EstadoVacio>
          Todavía no hay órdenes de trabajo. Abrí una cuando arranques una reparación y cargale
          los materiales que vayas usando.
        </EstadoVacio>
      )}

      {ordenes.length > 0 && (
        <div className="tabla-scroll tabla-cards-contenedor">
          <table className="tabla tabla-cards">
            <thead>
              <tr>
                <th>Número</th>
                <th>Trabajo</th>
                <th>Tipo</th>
                <th>Asignada a</th>
                <th>Equipo</th>
                <th>Materiales</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => (
                <tr key={o.id}>
                  <td data-etiqueta="Número">
                    <strong>{o.numero}</strong>
                    <div className="texto-suave texto-chico">{formatearFecha(o.abiertaEn)}</div>
                  </td>
                  <td data-etiqueta="Trabajo">{o.titulo}</td>
                  <td data-etiqueta="Tipo">{ETIQUETA_TIPO_TRABAJO[o.tipo]}</td>
                  <td data-etiqueta="Asignada a">
                    {o.asignadoANombre ?? '—'}
                    {yo && o.asignadoAId === yo.id && (
                      <span className="texto-suave texto-chico"> (vos)</span>
                    )}
                  </td>
                  <td data-etiqueta="Equipo">{o.equipoNombre ?? '—'}</td>
                  <td data-etiqueta="Materiales">
                    {o.materiales.length === 0 ? '—' : `${o.materiales.length}`}
                  </td>
                  <td data-etiqueta="Estado">
                    <span className={CLASE_ESTADO[o.estado]}>
                      {ETIQUETA_ESTADO_TRABAJO[o.estado]}
                    </span>
                  </td>
                  <td className="celda-acciones">
                    <button className="btn btn-sm" onClick={() => setOrdenAbierta(o.id)}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > LIMITE && (
        <div className="paginado">
          <button className="btn" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </button>
          <span className="texto-suave">
            Página {pagina} de {Math.ceil(data.total / LIMITE)}
          </span>
          <button
            className="btn"
            disabled={pagina >= Math.ceil(data.total / LIMITE)}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}

      <ModalNuevaOrden abierto={modalAlta} onCerrar={() => setModalAlta(false)} />

      {ordenAbierta && (
        <ModalDetalleOrden id={ordenAbierta} onCerrar={() => setOrdenAbierta(null)} />
      )}
    </div>
  );
}

// ─────────────────────── Abrir una orden ───────────────────────

function ModalNuevaOrden({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const puede = usePuede();
  const crear = useCrearOrdenTrabajo();
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoTrabajo>('CORRECTIVO');
  const [descripcion, setDescripcion] = useState('');
  const [equipo, setEquipo] = useState<{ id: string; nombre: string } | null>(null);
  /** Vacío quiere decir "para mí": el backend lo resuelve así. */
  const [asignadoA, setAsignadoA] = useState('');
  const { data: asignables } = useAsignables(abierto);

  const limpiar = () => {
    setTitulo('');
    setTipo('CORRECTIVO');
    setDescripcion('');
    setEquipo(null);
    setAsignadoA('');
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    await crear.mutateAsync({
      titulo,
      tipo,
      descripcion: descripcion || undefined,
      equipoId: equipo?.id ?? undefined,
      asignadoAId: asignadoA || undefined,
    });
    limpiar();
    onCerrar();
  };

  return (
    <Modal titulo="Nueva orden de trabajo" abierto={abierto} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <label className="campo">
          ¿Qué pasó, o para qué es el trabajo? *
          <input
            type="text"
            value={titulo}
            maxLength={200}
            required
            placeholder="Perdida en la bomba de recibo"
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>

        <label className="campo">
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTrabajo)}>
            {TIPOS_TRABAJO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO_TRABAJO[t]}
              </option>
            ))}
          </select>
        </label>

        {/* Si no se elige a nadie queda para uno mismo, que es el caso de
            abrirse una orden propia. Elegir a otro es el caso del encargado
            que reparte el trabajo. */}
        <label className="campo">
          Asignar a
          <select value={asignadoA} onChange={(e) => setAsignadoA(e.target.value)}>
            <option value="">Para mí</option>
            {(asignables ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>

        {/* El equipo solo lo puede elegir quien ve equipos. Mantenimiento
            todavía no tiene ese módulo: carga la orden sin máquina, contándolo
            en el título, y después un administrador la relaciona. */}
        {puede(P.EQUIPOS_VER) && (
          <label className="campo">
            Equipo (opcional)
            <ComboEquipo onCambio={setEquipo} />
          </label>
        )}

        <label className="campo">
          Detalle (opcional)
          <textarea
            rows={3}
            value={descripcion}
            maxLength={2000}
            placeholder="Lo que se vio, desde cuándo, qué se probó"
            onChange={(e) => setDescripcion(e.target.value)}
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
            disabled={crear.isPending || titulo.trim() === ''}
          >
            {crear.isPending ? 'Abriendo…' : 'Abrir orden'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────── Detalle ───────────────────────

function ModalDetalleOrden({ id, onCerrar }: { id: string; onCerrar: () => void }) {
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
                  disabled={cerrarOrden.isPending || resolucion.trim() === ''}
                  onClick={() => cerrarOrden.mutate({ id, resolucion })}
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
