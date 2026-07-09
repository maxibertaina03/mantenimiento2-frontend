import { useState } from 'react';
import { useMateriales } from '@/api/materiales';
import {
  obtenerTodosLosMovimientos,
  useActualizarMovimiento,
  useEdicionesMovimiento,
  useMovimientos,
} from '@/api/movimientos';
import { useUsuarioActual } from '@/api/usuarios';
import { BadgeMovimiento } from '@/componentes/BadgeMovimiento';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { descargarCsv, generarCsv, sufijoFechaArchivo } from '@/lib/csv';
import { exportarPdf } from '@/lib/pdf';
import { formatearFecha, formatearNumero, isoADatetimeLocal } from '@/lib/formato';
import {
  MOTIVOS_MOVIMIENTO,
  MOTIVOS_POR_TIPO,
  TIPOS_MOVIMIENTO,
  type ActualizarMovimientoInput,
  type FiltrosMovimientos,
  type Movimiento,
  type MotivoMovimiento,
  type TipoMovimiento,
} from '@/tipos/movimiento';

const LIMITE = 20;

export function MovimientosPage() {
  const { data: materiales } = useMateriales(1, 100);
  const { data: usuarioActual } = useUsuarioActual();

  // Modales de edición y de auditoría.
  const [editando, setEditando] = useState<Movimiento | null>(null);
  const [viendo, setViendo] = useState<Movimiento | null>(null);

  // Puede editar quien registró el movimiento o un admin.
  const puedeEditar = (m: Movimiento) =>
    !!usuarioActual && (m.usuarioId === usuarioActual.id || usuarioActual.rol === 'ADMIN');

  // Estado de filtros + paginación.
  const [materialId, setMaterialId] = useState('');
  const [tipo, setTipo] = useState<TipoMovimiento | ''>('');
  const [motivo, setMotivo] = useState<MotivoMovimiento | ''>('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState<string | null>(null);

  // Construye los filtros para la API (fechaHasta inclusiva hasta fin del día).
  const filtros = (): FiltrosMovimientos => ({
    materialId: materialId || undefined,
    tipo: tipo || undefined,
    motivo: motivo || undefined,
    fechaDesde: fechaDesde || undefined,
    fechaHasta: fechaHasta ? `${fechaHasta}T23:59:59.999` : undefined,
  });

  const { data, isLoading, error, isFetching } = useMovimientos({ ...filtros(), pagina, limite: LIMITE });

  const enFiltro = <T,>(setter: (v: T) => void) => (v: T) => {
    setPagina(1); // al cambiar un filtro, volvemos a la primera página
    setter(v);
  };

  const limpiar = () => {
    setMaterialId('');
    setTipo('');
    setMotivo('');
    setFechaDesde('');
    setFechaHasta('');
    setPagina(1);
  };

  // Resumen legible de los filtros activos (para el subtítulo del PDF).
  const resumenFiltros = (): string => {
    const partes: string[] = [];
    if (materialId) partes.push(`Material: ${materiales?.datos.find((m) => m.id === materialId)?.nombre ?? materialId}`);
    if (tipo) partes.push(`Tipo: ${tipo}`);
    if (motivo) partes.push(`Motivo: ${motivo}`);
    if (fechaDesde) partes.push(`Desde: ${fechaDesde}`);
    if (fechaHasta) partes.push(`Hasta: ${fechaHasta}`);
    return partes.length ? partes.join(' · ') : 'Sin filtros';
  };

  const exportar = async (formato: 'csv' | 'pdf') => {
    setErrorExport(null);
    setExportando(true);
    try {
      const todos = await obtenerTodosLosMovimientos(filtros());
      const encabezados = [
        'Fecha',
        'Material',
        'Tipo',
        'Motivo',
        'Cantidad',
        'Proveedor',
        'Usuario',
        'Referencia',
        'Notas',
      ];
      const filas = todos.map((m) => [
        formatearFecha(m.fecha),
        m.materialNombre ?? m.materialId,
        m.tipo,
        m.motivo,
        formatearNumero(m.cantidad),
        m.proveedorNombre ?? '',
        m.usuarioNombre ?? '',
        m.referenciaTrabajo ?? '',
        m.notas ?? '',
      ]);

      if (formato === 'csv') {
        descargarCsv(`movimientos_${sufijoFechaArchivo()}.csv`, generarCsv(encabezados, filas));
      } else {
        await exportarPdf({
          titulo: 'Historial de movimientos',
          subtitulo: `${todos.length} movimiento(s) · ${resumenFiltros()}`,
          encabezados,
          filas,
          nombreArchivo: `movimientos_${sufijoFechaArchivo()}.pdf`,
          orientacion: 'landscape',
          columnaTipo: 2,
        });
      }
    } catch (e) {
      setErrorExport(e instanceof Error ? e.message : 'No se pudo exportar.');
    } finally {
      setExportando(false);
    }
  };

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / LIMITE)) : 1;

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Historial de movimientos</h1>
        <div className="fila-acciones">
          <button className="btn" onClick={() => exportar('csv')} disabled={exportando}>
            {exportando ? 'Exportando…' : '⬇ CSV'}
          </button>
          <button className="btn btn-primario" onClick={() => exportar('pdf')} disabled={exportando}>
            {exportando ? 'Exportando…' : '⬇ PDF'}
          </button>
        </div>
      </div>

      {errorExport && <MensajeError error={new Error(errorExport)} />}

      {/* ── Filtros ── */}
      <div className="panel">
        <div className="grilla-filtros">
          <div className="campo">
            <label>Material</label>
            <select value={materialId} onChange={(e) => enFiltro(setMaterialId)(e.target.value)}>
              <option value="">Todos</option>
              {materiales?.datos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Tipo</label>
            <select
              value={tipo}
              onChange={(e) => enFiltro(setTipo)(e.target.value as TipoMovimiento | '')}
            >
              <option value="">Todos</option>
              {TIPOS_MOVIMIENTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Motivo</label>
            <select
              value={motivo}
              onChange={(e) => enFiltro(setMotivo)(e.target.value as MotivoMovimiento | '')}
            >
              <option value="">Todos</option>
              {MOTIVOS_MOVIMIENTO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => enFiltro(setFechaDesde)(e.target.value)}
            />
          </div>
          <div className="campo">
            <label>Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => enFiltro(setFechaHasta)(e.target.value)}
            />
          </div>
          <div className="campo" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn" onClick={limpiar}>
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {data && data.datos.length === 0 && (
        <EstadoVacio>No hay movimientos para los filtros seleccionados.</EstadoVacio>
      )}

      {data && data.datos.length > 0 && (
        <>
          <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Material</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th className="num">Cantidad</th>
                <th>Proveedor</th>
                <th>Usuario</th>
                <th>Referencia</th>
                <th>Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.datos.map((m: Movimiento) => (
                <tr key={m.id}>
                  <td>{formatearFecha(m.fecha)}</td>
                  <td>{m.materialNombre ?? '—'}</td>
                  <td>
                    <BadgeMovimiento tipo={m.tipo} />
                  </td>
                  <td>{m.motivo}</td>
                  <td className="num">{formatearNumero(m.cantidad)}</td>
                  <td>{m.proveedorNombre ?? '—'}</td>
                  <td>{m.usuarioNombre ?? '—'}</td>
                  <td>{m.referenciaTrabajo ?? '—'}</td>
                  <td>{m.notas ?? '—'}</td>
                  <td>
                    <div className="fila-acciones">
                      {m.editado && (
                        <button
                          className="btn btn-sm"
                          onClick={() => setViendo(m)}
                          title="Ver historial de cambios"
                        >
                          ✎ editado
                        </button>
                      )}
                      {puedeEditar(m) && (
                        <button className="btn btn-sm" onClick={() => setEditando(m)}>
                          Editar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* ── Paginación ── */}
          <div className="acciones" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="texto-suave">
              {data.total} movimiento(s){isFetching ? ' · actualizando…' : ''}
            </span>
            <div className="fila-acciones">
              <button
                className="btn btn-sm"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                ← Anterior
              </button>
              <span className="texto-suave" style={{ padding: '0 0.5rem' }}>
                Página {pagina} de {totalPaginas}
              </span>
              <button
                className="btn btn-sm"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente →
              </button>
            </div>
          </div>
        </>
      )}

      <Modal
        titulo="Editar movimiento"
        abierto={!!editando}
        onCerrar={() => setEditando(null)}
      >
        {editando && (
          <FormularioEdicion movimiento={editando} onListo={() => setEditando(null)} />
        )}
      </Modal>

      <Modal
        titulo="Historial de cambios"
        abierto={!!viendo}
        onCerrar={() => setViendo(null)}
      >
        {viendo && <Auditoria movimiento={viendo} />}
      </Modal>
    </>
  );
}

const ETIQUETAS: Record<string, string> = {
  tipo: 'Tipo',
  motivo: 'Motivo',
  cantidad: 'Cantidad',
  fecha: 'Fecha',
  proveedorId: 'Proveedor',
  referenciaTrabajo: 'Referencia',
  notas: 'Notas',
};

/** Formulario de edición de un movimiento (exige motivo del cambio). */
function FormularioEdicion({ movimiento, onListo }: { movimiento: Movimiento; onListo: () => void }) {
  const actualizar = useActualizarMovimiento();
  const [tipo, setTipo] = useState<TipoMovimiento>(movimiento.tipo);
  const [motivo, setMotivo] = useState<MotivoMovimiento>(movimiento.motivo);
  const [cantidad, setCantidad] = useState<number>(movimiento.cantidad);
  const [fechaLocal, setFechaLocal] = useState(isoADatetimeLocal(movimiento.fecha));
  const [referencia, setReferencia] = useState(movimiento.referenciaTrabajo ?? '');
  const [notas, setNotas] = useState(movimiento.notas ?? '');
  const [motivoEdicion, setMotivoEdicion] = useState('');

  const motivosDisponibles = MOTIVOS_POR_TIPO[tipo];

  const cambiarTipo = (nuevo: TipoMovimiento) => {
    setTipo(nuevo);
    if (!MOTIVOS_POR_TIPO[nuevo].includes(motivo)) setMotivo(MOTIVOS_POR_TIPO[nuevo][0]);
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const input: ActualizarMovimientoInput = {
      tipo,
      motivo,
      cantidad: Number(cantidad),
      fecha: fechaLocal ? new Date(fechaLocal).toISOString() : undefined,
      referenciaTrabajo: referencia || undefined,
      notas: notas || undefined,
      motivoEdicion: motivoEdicion.trim(),
    };
    actualizar.mutate({ id: movimiento.id, input }, { onSuccess: onListo });
  };

  return (
    <form onSubmit={enviar}>
      {actualizar.error && <MensajeError error={actualizar.error} />}
      <p className="texto-suave" style={{ marginTop: 0, fontSize: '0.85rem' }}>
        Material: <strong>{movimiento.materialNombre}</strong> (al editar se recalcula su stock)
      </p>

      <div className="grilla-2">
        <div className="campo">
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => cambiarTipo(e.target.value as TipoMovimiento)}>
            {TIPOS_MOVIMIENTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Motivo</label>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoMovimiento)}>
            {motivosDisponibles.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grilla-2">
        <div className="campo">
          <label>Cantidad{tipo === 'AJUSTE' && ' (stock absoluto)'}</label>
          <input
            type="number"
            min={0}
            step="0.001"
            required
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
          />
        </div>
        <div className="campo">
          <label>Fecha</label>
          <input
            type="datetime-local"
            value={fechaLocal}
            onChange={(e) => setFechaLocal(e.target.value)}
          />
        </div>
      </div>

      <div className="campo">
        <label>Referencia de trabajo</label>
        <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="OT-1001" />
      </div>
      <div className="campo">
        <label>Notas</label>
        <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>

      <div className="campo">
        <label>Motivo del cambio (obligatorio)</label>
        <textarea
          rows={2}
          required
          minLength={3}
          value={motivoEdicion}
          onChange={(e) => setMotivoEdicion(e.target.value)}
          placeholder="Ej: Cargué 100 por error, eran 60"
        />
      </div>

      <div className="acciones">
        <button type="button" className="btn" onClick={onListo}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primario" disabled={actualizar.isPending}>
          {actualizar.isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

/** Muestra el historial de ediciones (auditoría) de un movimiento. */
function Auditoria({ movimiento }: { movimiento: Movimiento }) {
  const { data, isLoading, error } = useEdicionesMovimiento(movimiento.id, true);

  if (isLoading) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  if (!data || data.length === 0)
    return <p className="texto-suave">Este movimiento no tiene ediciones.</p>;

  return (
    <div>
      {data.map((ed) => {
        const campos = Object.keys(ed.cambios.despues).filter(
          (k) => String(ed.cambios.antes[k]) !== String(ed.cambios.despues[k]),
        );
        return (
          <div key={ed.id} className="panel" style={{ marginBottom: '0.75rem' }}>
            <div className="texto-suave" style={{ fontSize: '0.8rem' }}>
              {formatearFecha(ed.creadoEn)} · {ed.usuarioNombre ?? 'usuario desconocido'}
            </div>
            <p style={{ margin: '0.35rem 0' }}>
              <strong>Motivo:</strong> {ed.motivo}
            </p>
            {campos.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {campos.map((k) => (
                  <li key={k} style={{ fontSize: '0.85rem' }}>
                    {ETIQUETAS[k] ?? k}: <span className="texto-suave">{String(ed.cambios.antes[k] ?? '—')}</span>{' '}
                    → <strong>{String(ed.cambios.despues[k] ?? '—')}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="texto-suave" style={{ fontSize: '0.85rem' }}>
                Sin cambios en los datos.
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
