import { Link } from 'react-router-dom';
import { useMisTareas } from '@/api/calendario';
import { P, usePuede } from '@/lib/permisos';
import { Cargando, MensajeError } from './Estados';

/** El día, en palabras cortas. */
function cuando(iso: string): string {
  const dia = new Date(iso);
  const hoy = new Date();
  const mismoDia =
    dia.getUTCFullYear() === hoy.getFullYear() &&
    dia.getUTCMonth() === hoy.getMonth() &&
    dia.getUTCDate() === hoy.getDate();

  if (mismoDia) return 'hoy';
  return dia.toLocaleDateString('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

/**
 * Lo que cada uno tiene que hacer, en la primera pantalla.
 *
 * Es el aviso de verdad. El correo puede rebotar —hoy las casillas de la
 * empresa rebotan— pero esto se ve siempre que alguien entre al sistema, que es
 * lo que hace todos los días.
 *
 * Incluye lo que venció y no se hizo. Esconderlo no lo resuelve: lo deja
 * pendiente y además invisible.
 */
export function MisTareasDeHoy() {
  const puede = usePuede();
  // Un hook no se puede llamar condicionalmente, así que la consulta se apaga.
  const habilitado = puede(P.TAREAS_VER);
  const { data, isLoading, error } = useMisTareas(habilitado);

  if (!habilitado) return null;

  const tareas = data ?? [];
  // Si no tiene nada pendiente, no se muestra una tarjeta vacía diciéndolo:
  // ocupa lugar para no decir nada.
  if (!isLoading && !error && tareas.length === 0) return null;

  const hoy = new Date();
  const vencidas = tareas.filter((t) => new Date(t.fecha) < new Date(hoy.toDateString()));

  return (
    <div className="panel">
      <div className="cabecera-historial">
        <h2>Lo que tenés que hacer</h2>
        <Link to="/calendario" className="btn btn-chico">
          Ver el calendario
        </Link>
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {vencidas.length > 0 && (
        <p className="aviso-escaneo es-error">
          {vencidas.length === 1
            ? 'Una de estas ya venció.'
            : `${vencidas.length} de estas ya vencieron.`}
        </p>
      )}

      <ul className="lista-simple">
        {tareas.map((t) => (
          <li key={t.id}>
            <strong>{t.titulo}</strong>
            <div className="texto-suave texto-chico">
              {cuando(t.fecha)}
              {t.equipoNombre ? ` · ${t.equipoNombre}` : ''}
              {t.descripcion ? ` · ${t.descripcion}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
