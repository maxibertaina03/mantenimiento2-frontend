import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCategorias } from '@/api/categorias';
import {
  obtenerTodosLosMateriales,
  useCrearMaterial,
  useMateriales,
  useMaterialesBajoStock,
} from '@/api/materiales';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { descargarCsv, generarCsv, sufijoFechaArchivo } from '@/lib/csv';
import { exportarPdf } from '@/lib/pdf';
import { formatearNumero } from '@/lib/formato';
import type { CrearMaterialInput } from '@/tipos/material';

const LIMITE = 20;

export function MaterialesPage() {
  const [buscar, setBuscar] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [pagina, setPagina] = useState(1);

  // Debounce: esperamos 300ms tras dejar de tipear antes de pedir a la API.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaDebounced(buscar);
      setPagina(1); // al cambiar la búsqueda volvemos a la primera página
    }, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading, error, isFetching } = useMateriales(pagina, LIMITE, busquedaDebounced);
  const { data: bajoStock } = useMaterialesBajoStock();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState<string | null>(null);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / LIMITE)) : 1;

  const exportar = async (formato: 'csv' | 'pdf') => {
    setErrorExport(null);
    setExportando(true);
    try {
      const todos = await obtenerTodosLosMateriales();
      const encabezados = [
        'Material',
        'Categoría',
        'Unidad',
        'Stock actual',
        'Stock mínimo',
        'Bajo stock',
        'Notas',
      ];
      const filas = todos.map((m) => [
        m.nombre,
        m.categoriaNombre ?? '',
        m.unidad,
        formatearNumero(m.stockActual),
        formatearNumero(m.stockMinimo),
        m.bajoStock ? 'SÍ' : 'NO',
        m.notas ?? '',
      ]);

      if (formato === 'csv') {
        descargarCsv(`materiales_stock_${sufijoFechaArchivo()}.csv`, generarCsv(encabezados, filas));
      } else {
        const bajos = todos.filter((m) => m.bajoStock).length;
        await exportarPdf({
          titulo: 'Materiales en stock',
          subtitulo: `${todos.length} material(es)`,
          encabezados,
          filas,
          nombreArchivo: `materiales_stock_${sufijoFechaArchivo()}.pdf`,
          orientacion: 'landscape',
          resaltarFilas: todos.map((m) => m.bajoStock),
          leyenda: bajos > 0 ? `⚠ ${bajos} bajo stock (resaltados)` : 'Todo OK',
        });
      }
    } catch (e) {
      setErrorExport(e instanceof Error ? e.message : 'No se pudo exportar.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Materiales</h1>
        <div className="fila-acciones">
          <button className="btn" onClick={() => exportar('csv')} disabled={exportando}>
            {exportando ? 'Exportando…' : '⬇ CSV'}
          </button>
          <button className="btn" onClick={() => exportar('pdf')} disabled={exportando}>
            {exportando ? 'Exportando…' : '⬇ PDF'}
          </button>
          <button className="btn btn-primario" onClick={() => setModalAbierto(true)}>
            + Nuevo material
          </button>
        </div>
      </div>

      {/* Buscador rápido por nombre */}
      <div className="buscador">
        <input
          type="search"
          inputMode="search"
          placeholder="🔍 Buscar material por nombre…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          autoFocus
        />
        {isFetching && <span className="texto-suave">buscando…</span>}
      </div>

      {errorExport && <MensajeError error={new Error(errorExport)} />}

      {bajoStock && bajoStock.length > 0 && (
        <div className="alerta alerta-aviso">
          ⚠️ <strong>{bajoStock.length}</strong> material(es) por debajo del stock mínimo:{' '}
          {bajoStock.map((m) => m.nombre).join(', ')}.
        </div>
      )}

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {data && (
        <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>Material</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th className="num">Stock actual</th>
              <th className="num">Stock mínimo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.datos.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link to={`/materiales/${m.id}`}>{m.nombre}</Link>
                </td>
                <td>{m.categoriaNombre ?? '—'}</td>
                <td>{m.unidad || '—'}</td>
                <td className="num">{formatearNumero(m.stockActual)}</td>
                <td className="num">{formatearNumero(m.stockMinimo)}</td>
                <td>
                  {m.bajoStock ? (
                    <span className="badge badge-bajo">Bajo stock</span>
                  ) : (
                    <span className="texto-suave">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {data && data.datos.length === 0 && (
        <EstadoVacio>
          {busquedaDebounced
            ? `No se encontraron materiales para «${busquedaDebounced}».`
            : 'No hay materiales cargados todavía.'}
        </EstadoVacio>
      )}

      {/* Paginación */}
      {data && data.total > LIMITE && (
        <div className="acciones" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="texto-suave">{data.total} material(es)</span>
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
      )}

      <Modal titulo="Nuevo material" abierto={modalAbierto} onCerrar={() => setModalAbierto(false)}>
        <FormularioMaterial onListo={() => setModalAbierto(false)} />
      </Modal>
    </>
  );
}

function FormularioMaterial({ onListo }: { onListo: () => void }) {
  const { data: categorias } = useCategorias();
  const crear = useCrearMaterial();
  const [form, setForm] = useState<CrearMaterialInput>({
    nombre: '',
    categoriaId: '',
    unidad: 'u',
    stockMinimo: 0,
  });

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    crear.mutate(
      { ...form, stockMinimo: Number(form.stockMinimo) || 0 },
      { onSuccess: onListo },
    );
  };

  return (
    <form onSubmit={enviar}>
      {crear.error && <MensajeError error={crear.error} />}

      <div className="campo">
        <label>Nombre</label>
        <input
          required
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
      </div>

      <div className="grilla-2">
        <div className="campo">
          <label>Categoría</label>
          <select
            required
            value={form.categoriaId}
            onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
          >
            <option value="" disabled>
              Elegí una categoría…
            </option>
            {categorias?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Unidad</label>
          <input
            required
            value={form.unidad}
            onChange={(e) => setForm({ ...form, unidad: e.target.value })}
            placeholder="u, kg, m, lt…"
          />
        </div>
      </div>

      <div className="campo">
        <label>Stock mínimo (umbral de alerta)</label>
        <input
          type="number"
          min={0}
          step="0.001"
          value={form.stockMinimo}
          onChange={(e) => setForm({ ...form, stockMinimo: Number(e.target.value) })}
        />
      </div>

      <p className="texto-suave" style={{ fontSize: '0.8rem' }}>
        El stock inicial es 0. Se carga registrando movimientos.
      </p>

      <div className="acciones">
        <button type="button" className="btn" onClick={onListo}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primario" disabled={crear.isPending}>
          {crear.isPending ? 'Guardando…' : 'Crear material'}
        </button>
      </div>
    </form>
  );
}
