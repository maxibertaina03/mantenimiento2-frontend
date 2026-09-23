import { useState } from 'react';
import { useCambiarRutina, useCrearRutina, useRutinas } from '@/api/calendario';
import { useAsignables } from '@/api/ordenesTrabajo';
import { Cargando, MensajeError } from './Estados';
import { Modal } from './Modal';
import { comoSeRepite } from '@/tipos/tarea';

/**
 * Las tareas que se repiten.
 *
 * "Revisar la presión de la caldera todas las mañanas" se carga una vez acá y
 * el calendario la reparte sola. Es la diferencia entre que una rutina se haga
 * y que se olvide.
 */
export function RutinasDeTareas({ onCerrar }: { onCerrar: () => void }) {
  const [verTodas, setVerTodas] = useState(false);
  const { data: rutinas, isLoading, error } = useRutinas(verTodas);
  const { data: asignables } = useAsignables();
  const crear = useCrearRutina();
  const cambiar = useCambiarRutina();

  const [titulo, setTitulo] = useState('');
  const [cadaDias, setCadaDias] = useState('1');
  const [desde, setDesde] = useState(() => new Date().toISOString().slice(0, 10));
  const [asignadoA, setAsignadoA] = useState('');

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    await crear.mutateAsync({
      titulo,
      cadaDias: Number(cadaDias),
      desde,
      asignadoAId: asignadoA || undefined,
    });
    setTitulo('');
  };

  return (
    <Modal titulo="Tareas que se repiten" abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <form onSubmit={enviar} className="panel alta-renglon">
          <label className="alta-renglon-material">
            Qué hay que hacer
            <input
              type="text"
              value={titulo}
              maxLength={200}
              required
              placeholder="Revisar presion de caldera"
              onChange={(e) => setTitulo(e.target.value)}
            />
          </label>
          <label>
            Cada cuántos días
            <input
              type="number"
              min={1}
              value={cadaDias}
              onChange={(e) => setCadaDias(e.target.value)}
            />
          </label>
          <label>
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label>
            Quién
            <select value={asignadoA} onChange={(e) => setAsignadoA(e.target.value)}>
              <option value="">Sin repartir</option>
              {(asignables ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="btn btn-primario alta-renglon-boton"
            disabled={crear.isPending || titulo.trim() === ''}
          >
            + Agregar
          </button>
        </form>

        {crear.error && <MensajeError error={crear.error} />}
        {cambiar.error && <MensajeError error={cambiar.error} />}
        {isLoading && <Cargando />}
        {error && <MensajeError error={error} />}

        <label className="casilla">
          <input
            type="checkbox"
            checked={verTodas}
            onChange={(e) => setVerTodas(e.target.checked)}
          />
          Ver también las apagadas
        </label>

        {rutinas && rutinas.length === 0 && (
          <p className="texto-suave">
            Todavía no hay ninguna. Una rutina se carga una vez y el calendario la reparte sola.
          </p>
        )}

        <ul className="lista-simple">
          {(rutinas ?? []).map((r) => (
            <li key={r.id}>
              <strong>{r.titulo}</strong>
              <div className="texto-suave texto-chico">
                {comoSeRepite(r.cadaDias)}
                {r.asignadoANombre ? ` · ${r.asignadoANombre}` : ' · sin repartir'}
                {r.equipoNombre ? ` · ${r.equipoNombre}` : ''}
                {!r.activa && ' · apagada'}
              </div>
              <button
                type="button"
                className="btn btn-sm"
                disabled={cambiar.isPending}
                onClick={() => cambiar.mutate({ id: r.id, activa: !r.activa })}
              >
                {r.activa ? 'Apagar' : 'Encender'}
              </button>
            </li>
          ))}
        </ul>

        <p className="texto-suave texto-chico">
          Apagar una rutina deja de generar tareas nuevas. Las que ya están en el calendario
          siguen, y se cancelan una por una si no se van a hacer.
        </p>

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
