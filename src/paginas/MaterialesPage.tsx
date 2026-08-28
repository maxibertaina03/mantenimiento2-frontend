import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCategorias, useCrearCategoria } from '@/api/categorias';
import {
  obtenerTodosLosMateriales,
  useActualizarMaterial,
  useCrearMaterial,
  useEliminarMaterial,
  useMateriales,
} from '@/api/materiales';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { AccionesFila } from '@/componentes/AccionesFila';
import { CategoriasMaterial } from '@/componentes/CategoriasMaterial';
import { UnidadesMedida } from '@/componentes/UnidadesMedida';
import { useUnidadesMedida } from '@/api/unidadesMedida';
import { CampoNumero } from '@/componentes/CampoNumero';
import { Modal } from '@/componentes/Modal';
import { descargarCsv, generarCsv, sufijoFechaArchivo } from '@/lib/csv';
import { exportarPdf } from '@/lib/pdf';
import { formatearNumero } from '@/lib/formato';
import type { CrearMaterialInput, Material } from '@/tipos/material';

const LIMITE = 20;

/** Unidades que se ofrecen aunque todavía no las use ningún material. */
export function MaterialesPage() {
  const navegar = useNavigate();
  const eliminar = useEliminarMaterial();
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
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Material | null>(null);
  const [modalCategorias, setModalCategorias] = useState(false);
  const [modalUnidades, setModalUnidades] = useState(false);
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
          <button className="btn" onClick={() => setModalCategorias(true)}>
            ⚙ Categorías
          </button>
          <button className="btn" onClick={() => setModalUnidades(true)}>
            ⚙ Unidades
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

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {eliminar.error && <MensajeError error={eliminar.error} />}

      {data && (
        <div className="tabla-scroll tabla-cards-contenedor">
        <table className="tabla tabla-cards">
          <thead>
            <tr>
              <th>Material</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th className="num">Stock actual</th>
              <th className="num">Stock mínimo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.datos.map((m) => (
              <tr
                key={m.id}
                className="fila-clickeable"
                onClick={() => navegar(`/materiales/${m.id}`)}
              >
                <td data-etiqueta="Material">
                  <Link to={`/materiales/${m.id}`} onClick={(e) => e.stopPropagation()}>
                    {m.nombre}
                  </Link>
                </td>
                <td data-etiqueta="Categoría">{m.categoriaNombre ?? '—'}</td>
                <td data-etiqueta="Unidad">{m.unidad || '—'}</td>
                <td className="num" data-etiqueta="Stock actual">
                  {formatearNumero(m.stockActual)}
                </td>
                <td className="num" data-etiqueta="Stock mínimo">
                  {formatearNumero(m.stockMinimo)}
                </td>
                <td data-etiqueta="Estado">
                  {m.bajoStock ? (
                    <span className="badge badge-bajo">Bajo stock</span>
                  ) : (
                    <span className="texto-suave">OK</span>
                  )}
                </td>
                {/* stopPropagation: los botones no deben navegar al detalle. */}
                <td className="celda-acciones" onClick={(e) => e.stopPropagation()}>
                  <AccionesFila
                    descripcion={m.nombre}
                    onVer={() => navegar(`/materiales/${m.id}`)}
                    onEditar={() => setEditando(m)}
                    onEliminar={() => {
                      if (confirm(`¿Eliminar el material "${m.nombre}"?`)) eliminar.mutate(m.id);
                    }}
                  />
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

      <Modal
        titulo={editando ? `Editar ${editando.nombre}` : 'Nuevo material'}
        abierto={modalAbierto || editando !== null}
        onCerrar={() => {
          setModalAbierto(false);
          setEditando(null);
        }}
      >
        {/* key: remonta el formulario al cambiar de material, para que no
            conserve los valores del anterior. */}
        <FormularioMaterial
          key={editando?.id ?? 'nuevo'}
          material={editando ?? undefined}
          onListo={() => {
            setModalAbierto(false);
            setEditando(null);
          }}
        />
      </Modal>

      <CategoriasMaterial
        abierto={modalCategorias}
        onCerrar={() => setModalCategorias(false)}
      />

      <UnidadesMedida abierto={modalUnidades} onCerrar={() => setModalUnidades(false)} />
    </>
  );
}

/**
 * Mismo formulario para dar de alta y para editar. Mantener dos copias
 * garantizaba que se desincronizaran al agregar un campo.
 */
function FormularioMaterial({
  onListo,
  material,
}: {
  onListo: () => void;
  /** Si viene, el formulario edita ese material en vez de crear uno nuevo. */
  material?: Material;
}) {
  const esEdicion = material !== undefined;
  const { data: categorias } = useCategorias();
  // soloActivas: las unidades dadas de baja no se ofrecen para cargar nuevas.
  const { data: unidades } = useUnidadesMedida(true);
  const crear = useCrearMaterial();
  const actualizar = useActualizarMaterial(material?.id ?? '');
  const crearCategoria = useCrearCategoria();
  const guardando = crear.isPending || actualizar.isPending;
  const errorGuardar = crear.error ?? actualizar.error;
  const [form, setForm] = useState<CrearMaterialInput>({
    nombre: material?.nombre ?? '',
    categoriaId: material?.categoriaId ?? '',
    unidadId: material?.unidadId ?? '',
    stockMinimo: material?.stockMinimo ?? 0,
    notas: material?.notas ?? undefined,
  });
  // Alta rápida de categoría desde el mismo formulario.
  const [modoNuevaCat, setModoNuevaCat] = useState(false);
  const [nombreCat, setNombreCat] = useState('');

  const crearNuevaCategoria = () => {
    const nombre = nombreCat.trim();
    if (!nombre) return;
    crearCategoria.mutate(nombre, {
      onSuccess: (cat) => {
        setForm((f) => ({ ...f, categoriaId: cat.id })); // la dejamos seleccionada
        setNombreCat('');
        setModoNuevaCat(false);
      },
    });
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const datos = { ...form, stockMinimo: Number(form.stockMinimo) || 0 };
    if (esEdicion) await actualizar.mutateAsync(datos);
    else await crear.mutateAsync(datos);
    onListo();
  };

  return (
    <form onSubmit={enviar}>
      {errorGuardar && <MensajeError error={errorGuardar} />}

      <div className="campo">
        <label>Nombre</label>
        <input
          required
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
      </div>

      <div className="grilla-2">
        <div className="campo campo-ancho">
          <label>Categoría</label>
          {!modoNuevaCat ? (
            <div className="campo-con-boton">
              <select
                required
                value={form.categoriaId}
                onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
              >
                <option value="" disabled>
                  Elegí una categoría
                </option>
                {categorias?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setModoNuevaCat(true)}
                title="Crear una categoría nueva"
              >
                + Nueva
              </button>
            </div>
          ) : (
            <>
              <div className="campo-con-boton">
                <input
                  autoFocus
                  placeholder="Nombre de la nueva categoría"
                  value={nombreCat}
                  onChange={(e) => setNombreCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      crearNuevaCategoria();
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-primario btn-sm"
                  onClick={crearNuevaCategoria}
                  disabled={crearCategoria.isPending}
                >
                  {crearCategoria.isPending ? '…' : 'Crear'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setModoNuevaCat(false);
                    setNombreCat('');
                  }}
                >
                  Cancelar
                </button>
              </div>
              {crearCategoria.error && <MensajeError error={crearCategoria.error} />}
            </>
          )}
        </div>
        <div className="campo">
          <label>Unidad *</label>
          {/* Desplegable del catálogo, no texto libre: si cada uno escribiera la
              suya, "lt", "Lt" y "litros" volverían a ser tres unidades y los
              reportes por unidad no cerrarían. */}
          <select
            required
            value={form.unidadId}
            onChange={(e) => setForm({ ...form, unidadId: e.target.value })}
          >
            <option value="">Elegí una unidad…</option>
            {(unidades ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} ({u.simbolo})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="campo">
        <label>Stock mínimo (umbral de alerta)</label>
        <CampoNumero
          min={0}
          step="0.001"
          valor={form.stockMinimo}
          onCambio={(v) => setForm({ ...form, stockMinimo: v })}
        />
      </div>

      <p className="texto-suave" style={{ fontSize: '0.8rem' }}>
        El stock inicial es 0. Se carga registrando movimientos.
      </p>

      <div className="acciones">
        <button type="button" className="btn" onClick={onListo}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primario" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear material'}
        </button>
      </div>
    </form>
  );
}
