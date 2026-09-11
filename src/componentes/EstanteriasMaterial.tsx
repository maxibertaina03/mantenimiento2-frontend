import { useState } from 'react';
import {
  useActualizarEstanteria,
  useCrearEstanteria,
  useEliminarEstanteria,
  useEstanterias,
  type Estanteria,
} from '@/api/estanterias';
import { Cargando, EstadoVacio, MensajeError } from './Estados';
import { Modal } from './Modal';

/**
 * Las estanterías del depósito.
 *
 * Van como lista y no como texto libre por lo mismo que las unidades: si cada
 * uno escribe «Estantería A», «estanteria a» y «Est. A», la pregunta «qué hay
 * en la estantería A» deja de tener una sola respuesta.
 *
 * Las filas no se cargan acá: son un número que se escribe en cada material.
 * Un número ya es un dato analizable, y cargar cada fila de cada estantería
 * sería trabajo sin ninguna garantía a cambio.
 */
export function EstanteriasMaterial({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const { data, isLoading, error } = useEstanterias();
  const crear = useCrearEstanteria();
  const actualizar = useActualizarEstanteria();
  const eliminar = useEliminarEstanteria();
  const [nombre, setNombre] = useState('');

  const agregar = async () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    await crear.mutateAsync({ nombre: limpio });
    setNombre('');
  };

  const borrar = async (e: Estanteria) => {
    if (!confirm(`¿Eliminar la estantería "${e.nombre}"?`)) return;
    await eliminar.mutateAsync(e.id);
  };

  const estanterias = data ?? [];

  return (
    <Modal titulo="Estanterías del depósito" abierto={abierto} tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p className="texto-suave texto-chico">
          Cargá acá las estanterías una sola vez. Después, en cada material elegís la estantería y
          escribís el número de fila.
        </p>

        <div className="alta-rapida">
          <input
            value={nombre}
            placeholder="Nueva estantería. Por ejemplo: Estantería A"
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void agregar();
              }
            }}
          />
          <button
            className="btn btn-primario"
            onClick={agregar}
            disabled={!nombre.trim() || crear.isPending}
          >
            {crear.isPending ? 'Agregando…' : '+ Agregar'}
          </button>
        </div>

        {crear.error && <MensajeError error={crear.error} />}
        {eliminar.error && <MensajeError error={eliminar.error} />}

        {isLoading && <Cargando />}
        {error && <MensajeError error={error} />}

        {data && estanterias.length === 0 && (
          <EstadoVacio>Todavía no hay ninguna estantería cargada.</EstadoVacio>
        )}

        {estanterias.length > 0 && (
          <ul className="lista-catalogo">
            {estanterias.map((e) => (
              <li key={e.id} className={e.activo ? undefined : 'inactivo'}>
                <span>
                  {e.nombre}
                  {!e.activo && <span className="texto-suave texto-chico"> · desactivada</span>}
                </span>
                <span className="acciones-catalogo">
                  <span className="texto-suave texto-chico">
                    {e.materiales === 0 ? 'vacía' : `${e.materiales} material(es)`}
                  </span>
                  <button
                    className="btn btn-chico"
                    onClick={() => actualizar.mutate({ id: e.id, activo: !e.activo })}
                  >
                    {e.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  {/* Solo se borra lo que está vacío: si tiene materiales, lo
                      correcto es desactivarla, que la saca del desplegable sin
                      dejar sin ubicación a los que ya están ahí. */}
                  {e.materiales === 0 && (
                    <button className="btn btn-chico" onClick={() => borrar(e)}>
                      Eliminar
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
