import { useState } from 'react';
import { useCategorias, useCrearCategoria } from '@/api/categorias';
import { useCrearMaterial } from '@/api/materiales';
import { useUnidadesMedida } from '@/api/unidadesMedida';
import { MensajeError } from './Estados';
import { Modal } from './Modal';
import type { Material } from '@/tipos/material';

/**
 * Alta rápida de un material desde donde haga falta elegir uno.
 *
 * Nace de la orden de compra: es normal comprar algo que nunca se compró, y
 * mandar a la persona a la pantalla de Materiales le haría perder la orden que
 * venía cargando.
 *
 * Pide solo lo indispensable —nombre, categoría y unidad—. El stock mínimo y
 * las notas se completan después desde la ficha; exigirlos acá sería frenar a
 * alguien que está en el medio de otra tarea.
 */
export function NuevoMaterialRapido({
  nombreInicial,
  onCreado,
  onCerrar,
}: {
  /** El texto que se buscó y no apareció: casi siempre es el nombre buscado. */
  nombreInicial: string;
  onCreado: (material: Material) => void;
  onCerrar: () => void;
}) {
  const { data: categorias } = useCategorias();
  const { data: unidades } = useUnidadesMedida(true);
  const crear = useCrearMaterial();
  const crearCategoria = useCrearCategoria();

  const [nombre, setNombre] = useState(nombreInicial);
  const [categoriaId, setCategoriaId] = useState('');
  const [unidadId, setUnidadId] = useState('');
  const [modoNuevaCat, setModoNuevaCat] = useState(false);
  const [nombreCat, setNombreCat] = useState('');

  const crearNuevaCategoria = () => {
    const limpio = nombreCat.trim();
    if (!limpio) return;
    crearCategoria.mutate(limpio, {
      onSuccess: (cat) => {
        setCategoriaId(cat.id); // queda elegida
        setNombreCat('');
        setModoNuevaCat(false);
      },
    });
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const material = await crear.mutateAsync({
      nombre: nombre.trim(),
      categoriaId,
      unidadId,
    });
    onCreado(material);
  };

  return (
    <Modal titulo="Nuevo material" abierto onCerrar={onCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <p className="texto-suave texto-chico">
          Se crea con stock 0. El stock se carga después con un movimiento o al recibir la orden.
        </p>

        <label>
          Nombre *
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            minLength={2}
            autoFocus
          />
        </label>

        <label>
          Categoría *
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            required
            disabled={modoNuevaCat}
          >
            <option value="">Elegí una categoría…</option>
            {(categorias ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        {modoNuevaCat ? (
          <>
            <div className="acciones-envio">
              <input
                autoFocus
                placeholder="Nombre de la nueva categoría"
                value={nombreCat}
                onChange={(e) => setNombreCat(e.target.value)}
                onKeyDown={(e) => {
                  // Enter acá crearía la orden entera si no se frena.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    crearNuevaCategoria();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-primario"
                onClick={crearNuevaCategoria}
                disabled={crearCategoria.isPending}
              >
                {crearCategoria.isPending ? '…' : 'Crear'}
              </button>
              <button type="button" className="btn" onClick={() => setModoNuevaCat(false)}>
                Cancelar
              </button>
            </div>
            {crearCategoria.error && <MensajeError error={crearCategoria.error} />}
          </>
        ) : (
          <button type="button" className="boton-enlace" onClick={() => setModoNuevaCat(true)}>
            ＋ Crear una categoría nueva
          </button>
        )}

        <label>
          Unidad *
          <select value={unidadId} onChange={(e) => setUnidadId(e.target.value)} required>
            <option value="">Elegí una unidad…</option>
            {(unidades ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} ({u.simbolo})
              </option>
            ))}
          </select>
        </label>

        {crear.error && <MensajeError error={crear.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={crear.isPending}>
            {crear.isPending ? 'Creando…' : 'Crear y usar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
