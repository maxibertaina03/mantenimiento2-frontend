import { useState } from 'react';
import { useCategorias, useCrearCategoria } from '@/api/categorias';
import { useActualizarMaterial, useCrearMaterial } from '@/api/materiales';
import { useUnidadesMedida } from '@/api/unidadesMedida';
import { CampoNumero } from './CampoNumero';
import { MensajeError } from './Estados';
import type { CrearMaterialInput, Material } from '@/tipos/material';

/**
 * Alta y edición de un material.
 *
 * Vive acá y no adentro del listado porque lo usan dos pantallas: el listado,
 * para crear y editar, y la ficha, para editar el material que se está mirando.
 * Quien escanea el QR de un estante cae en la ficha, y ahí tiene que poder
 * corregir el stock mínimo o las notas sin volver al listado a buscarlo.
 */
export function FormularioMaterial({
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
