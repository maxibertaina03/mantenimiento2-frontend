import { useCategorias } from '@/api/categorias';
import { useUnidadesMedida } from '@/api/unidadesMedida';
import { CampoNumero } from './CampoNumero';
import type { FiltrosMateriales as Filtros } from '@/api/materiales';

/** Cuántos filtros están puestos: sirve para avisar que el listado está acotado. */
export function contarFiltros(f: Filtros): number {
  return [
    f.categoriaId,
    f.unidadId,
    f.stockMin,
    f.stockMax,
    f.bajoStock || undefined,
    f.sinUnidad || undefined,
  ].filter((v) => v !== undefined && v !== '').length;
}

/**
 * Filtros del listado de materiales.
 *
 * El filtrado y el orden los resuelve el backend, no el navegador: son 870
 * materiales y traerlos todos para ordenarlos acá rompería la paginación —
 * ordenaría solo la página que se está viendo.
 */
export function FiltrosMateriales({
  filtros,
  onCambio,
}: {
  filtros: Filtros;
  onCambio: (f: Filtros) => void;
}) {
  const { data: categorias } = useCategorias();
  const { data: unidades } = useUnidadesMedida();

  const cambiar = (parcial: Partial<Filtros>) => onCambio({ ...filtros, ...parcial });
  const puestos = contarFiltros(filtros);

  return (
    <div className="panel filtros-materiales">
      <div className="filtros-grilla">
        <label>
          Categoría
          <select
            value={filtros.categoriaId ?? ''}
            onChange={(e) => cambiar({ categoriaId: e.target.value || undefined })}
          >
            <option value="">Todas</option>
            {(categorias ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Unidad
          <select
            value={filtros.sinUnidad ? 'SIN' : (filtros.unidadId ?? '')}
            onChange={(e) => {
              const v = e.target.value;
              // Son excluyentes: pedir una unidad Y "sin unidad" a la vez
              // devolvería siempre vacío sin explicar por qué.
              cambiar(
                v === 'SIN'
                  ? { sinUnidad: true, unidadId: undefined }
                  : { sinUnidad: false, unidadId: v || undefined },
              );
            }}
          >
            <option value="">Todas</option>
            {(unidades ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} ({u.simbolo})
              </option>
            ))}
            <option value="SIN">— Sin unidad cargada —</option>
          </select>
        </label>

        <label>
          Stock desde
          <CampoNumero
            min={0}
            step="0.001"
            placeholder="cualquiera"
            valor={filtros.stockMin}
            onCambio={(v) => cambiar({ stockMin: v })}
          />
        </label>

        <label>
          Stock hasta
          <CampoNumero
            min={0}
            step="0.001"
            placeholder="cualquiera"
            valor={filtros.stockMax}
            onCambio={(v) => cambiar({ stockMax: v })}
          />
        </label>

        <label>
          Ordenar por
          <select
            value={filtros.ordenarPor ?? 'nombre'}
            onChange={(e) => cambiar({ ordenarPor: e.target.value as Filtros['ordenarPor'] })}
          >
            <option value="nombre">Nombre</option>
            <option value="stock">Stock</option>
            <option value="categoria">Categoría</option>
            <option value="unidad">Unidad</option>
          </select>
        </label>

        <label>
          Orden
          <select
            value={filtros.direccion ?? 'asc'}
            onChange={(e) => cambiar({ direccion: e.target.value as 'asc' | 'desc' })}
          >
            <option value="asc">Ascendente (menor primero)</option>
            <option value="desc">Descendente (mayor primero)</option>
          </select>
        </label>
      </div>

      <div className="filtros-pie">
        <label className="filtro-check">
          <input
            type="checkbox"
            checked={filtros.bajoStock ?? false}
            onChange={(e) => cambiar({ bajoStock: e.target.checked })}
          />
          Solo los que están bajo su stock mínimo
        </label>

        {puestos > 0 && (
          <button className="btn btn-chico" onClick={() => onCambio({ buscar: filtros.buscar })}>
            ✕ Limpiar filtros ({puestos})
          </button>
        )}
      </div>
    </div>
  );
}
