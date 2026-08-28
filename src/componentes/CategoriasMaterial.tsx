import { useState } from 'react';
import {
  useActualizarCategoria,
  useCategorias,
  useCrearCategoria,
  useEliminarCategoria,
} from '@/api/categorias';
import { AccionesFila } from './AccionesFila';
import { Cargando, EstadoVacio, MensajeError } from './Estados';
import { Modal } from './Modal';
import type { Categoria } from '@/tipos/categoria';

/**
 * Administración de las categorías de materiales.
 *
 * El backend ya tenía el CRUD completo, pero no había pantalla: la única forma
 * de crear una era el atajo dentro del alta de material, y editarlas o
 * eliminarlas no se podía.
 */
export function CategoriasMaterial({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const { data: categorias, isLoading, error } = useCategorias();
  const eliminar = useEliminarCategoria();
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [creando, setCreando] = useState(false);

  const borrar = async (c: Categoria) => {
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return;
    await eliminar.mutateAsync(c.id);
  };

  return (
    <Modal titulo="Categorías de materiales" abierto={abierto} tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p className="texto-suave">
          Sirven para agrupar los materiales y filtrar el listado.
        </p>

        {isLoading && <Cargando />}
        {error && <MensajeError error={error} />}
        {eliminar.error && <MensajeError error={eliminar.error} />}

        {categorias && categorias.length === 0 && (
          <EstadoVacio>Todavía no hay categorías.</EstadoVacio>
        )}

        {categorias && categorias.length > 0 && (
          <div className="tabla-scroll tabla-cards-contenedor">
            <table className="tabla tabla-cards">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categorias.map((c) => (
                  <tr key={c.id}>
                    <td data-etiqueta="Categoría">
                      <strong>{c.nombre}</strong>
                    </td>
                    <td data-etiqueta="Descripción" className="texto-suave">
                      {c.descripcion || '—'}
                    </td>
                    <td className="celda-acciones">
                      <AccionesFila
                        descripcion={`la categoría ${c.nombre}`}
                        onEditar={() => setEditando(c)}
                        onEliminar={() => borrar(c)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="texto-suave texto-chico">
          Una categoría que tenga materiales asociados no se puede eliminar: primero hay que
          moverlos a otra.
        </p>

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            Cerrar
          </button>
          <button className="btn btn-primario" onClick={() => setCreando(true)}>
            + Nueva categoría
          </button>
        </div>
      </div>

      {(creando || editando) && (
        <FormularioCategoria
          categoria={editando ?? undefined}
          alCerrar={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}
    </Modal>
  );
}

function FormularioCategoria({
  categoria,
  alCerrar,
}: {
  categoria?: Categoria;
  alCerrar: () => void;
}) {
  const esEdicion = categoria !== undefined;
  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? '');

  const crear = useCrearCategoria();
  const actualizar = useActualizarCategoria();
  const guardando = crear.isPending || actualizar.isPending;
  const error = crear.error ?? actualizar.error;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (esEdicion) {
      await actualizar.mutateAsync({
        id: categoria.id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
      });
    } else {
      await crear.mutateAsync(nombre.trim());
    }
    alCerrar();
  };

  return (
    <Modal
      titulo={esEdicion ? `Editar ${categoria.nombre}` : 'Nueva categoría'}
      abierto
      onCerrar={alCerrar}
    >
      <form onSubmit={enviar} className="formulario-modal">
        <label>
          Nombre *
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            minLength={2}
            placeholder="Bulonería"
            autoFocus
          />
        </label>

        <label>
          Descripción
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional"
          />
        </label>

        {error && <MensajeError error={error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear categoría'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
