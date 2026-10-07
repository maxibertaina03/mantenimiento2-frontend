import { useEffect, useState } from 'react';
import { useUsuarioActual } from '@/api/usuarios';
import { useOrdenesTrabajo } from '@/api/ordenesTrabajo';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { formatearFecha } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { ESTADOS_ORDEN_TRABAJO, ETIQUETA_ESTADO_TRABAJO, ETIQUETA_TIPO_TRABAJO, TIPOS_TRABAJO } from '@/tipos/ordenTrabajo';
import type { EstadoOrdenTrabajo, TipoTrabajo } from '@/tipos/ordenTrabajo';
import { CLASE_ESTADO } from '@/componentes/ordenesTrabajo/estado';
import { ModalNuevaOrden } from '@/componentes/ordenesTrabajo/ModalNuevaOrden';
import { ModalDetalleOrden } from '@/componentes/ordenesTrabajo/ModalDetalleOrden';

const LIMITE = 20;

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
