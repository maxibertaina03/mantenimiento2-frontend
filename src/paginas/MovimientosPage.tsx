import { useState } from 'react';
import { useMateriales } from '@/api/materiales';
import { obtenerTodosLosMovimientos, useMovimientos } from '@/api/movimientos';
import { BadgeMovimiento } from '@/componentes/BadgeMovimiento';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { descargarCsv, generarCsv, sufijoFechaArchivo } from '@/lib/csv';
import { formatearFecha, formatearNumero } from '@/lib/formato';
import {
  MOTIVOS_MOVIMIENTO,
  TIPOS_MOVIMIENTO,
  type FiltrosMovimientos,
  type Movimiento,
  type MotivoMovimiento,
  type TipoMovimiento,
} from '@/tipos/movimiento';

const LIMITE = 20;

export function MovimientosPage() {
  const { data: materiales } = useMateriales(1, 100);

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

  const exportar = async () => {
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
        m.cantidad,
        m.proveedorNombre ?? '',
        m.usuarioNombre ?? '',
        m.referenciaTrabajo ?? '',
        m.notas ?? '',
      ]);
      descargarCsv(`movimientos_${sufijoFechaArchivo()}.csv`, generarCsv(encabezados, filas));
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
        <button className="btn btn-primario" onClick={exportar} disabled={exportando}>
          {exportando ? 'Exportando…' : '⬇ Exportar CSV'}
        </button>
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
                </tr>
              ))}
            </tbody>
          </table>

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
    </>
  );
}
