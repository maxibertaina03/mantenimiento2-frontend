import { CalendarDays, Check, ChevronDown, Clock, Repeat } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMisTareas } from '@/api/calendario';
import { vencio } from '@/lib/diaDeTarea';
import { P, usePuede } from '@/lib/permisos';
import { encabezadoTarea, esDeTodosLosDias } from '@/lib/tareas';
import type { Tarea } from '@/tipos/tarea';
import { CompletarTarea } from './CompletarTarea';
import { PostergarTarea } from './PostergarTarea';
import { Cargando, MensajeError } from './Estados';

/** Cuántas tareas se ven sin tocar «Ver todas». */
const TAREAS_A_LA_VISTA = 4;

/** El día del mes y el mes corto, para el cuadradito de la fecha. */
function partesDeFecha(iso: string): { dia: string; mes: string; esHoy: boolean } {
  const fecha = new Date(iso);
  const hoy = new Date();
  const esHoy =
    fecha.getUTCFullYear() === hoy.getFullYear() &&
    fecha.getUTCMonth() === hoy.getMonth() &&
    fecha.getUTCDate() === hoy.getDate();
  return {
    dia: String(fecha.getUTCDate()),
    mes: fecha.toLocaleDateString('es-AR', { timeZone: 'UTC', month: 'short' }).replace('.', ''),
    esHoy,
  };
}

/** El día, en palabras cortas: «hoy» o «14 oct». */
function cuando(iso: string): string {
  const { dia, mes, esHoy } = partesDeFecha(iso);
  return esHoy ? 'hoy' : `${dia} ${mes}`;
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
 *
 * Lo de todos los días (las purgas diarias, las rutinas) va junto en un solo
 * renglón que se despliega. Listadas una por una ocupaban la pantalla, y un service o una
 * tarea importante quedaba perdido entre ellas.
 */
export function MisTareasDeHoy() {
  const puede = usePuede();
  // Un hook no se puede llamar condicionalmente, así que la consulta se apaga.
  const habilitado = puede(P.TAREAS_VER);
  const { data, isLoading, error } = useMisTareas(habilitado);
  const [completando, setCompletando] = useState<Tarea | null>(null);
  const [postergando, setPostergando] = useState<Tarea | null>(null);
  const [todas, setTodas] = useState(false);
  const [rutinasAbiertas, setRutinasAbiertas] = useState(false);
  const puedeHacerlas = puede(P.TAREAS_EDITAR);

  if (!habilitado) return null;

  const tareas = data ?? [];
  // Si no tiene nada pendiente, no se muestra una tarjeta vacía diciéndolo:
  // ocupa lugar para no decir nada.
  if (!isLoading && !error && tareas.length === 0) return null;

  const importantes = tareas.filter((t) => !esDeTodosLosDias(t));
  const rutinas = tareas.filter(esDeTodosLosDias);
  const rutinasAtrasadas = rutinas.filter((t) => !partesDeFecha(t.fecha).esHoy).length;
  const vencidas = importantes.filter((t) => vencio(t.fecha));
  // Las primeras, para que la pantalla de entrada no se haga larga; el resto, a pedido.
  const visibles = todas ? importantes : importantes.slice(0, TAREAS_A_LA_VISTA);

  const fila = (t: Tarea) => (
    <FilaTarea
      key={t.id}
      tarea={t}
      puedeHacerla={puedeHacerlas}
      onPostergar={() => setPostergando(t)}
      onCompletar={() => setCompletando(t)}
    />
  );

  return (
    <section className="panel panel-lista">
      <div className="panel-cabecera">
        <h2>
          Lo que hay que hacer
          {vencidas.length > 0 ? (
            <span className="badge badge-error">
              {vencidas.length === 1 ? '1 vencida' : `${vencidas.length} vencidas`}
            </span>
          ) : (
            importantes.length > 0 && <span className="badge">{importantes.length}</span>
          )}
        </h2>
        <Link to="/calendario" className="btn btn-fantasma btn-sm">
          <CalendarDays className="icono" aria-hidden />
          Calendario
        </Link>
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {importantes.length > 0 && <ul className="lista-tareas">{visibles.map(fila)}</ul>}

      {importantes.length > TAREAS_A_LA_VISTA && (
        <div className="panel-pie">
          <button
            type="button"
            className="btn btn-fantasma btn-sm"
            onClick={() => setTodas((v) => !v)}
          >
            {todas ? 'Ver menos' : `Ver las ${importantes.length}`}
          </button>
        </div>
      )}

      {rutinas.length > 0 && (
        <div className="grupo-rutinas">
          <button
            type="button"
            className="grupo-rutinas-cabecera"
            aria-expanded={rutinasAbiertas}
            onClick={() => setRutinasAbiertas((v) => !v)}
          >
            <span className="grupo-rutinas-icono" aria-hidden>
              <Repeat />
            </span>
            <span className="tarea-que">
              <strong>Tareas de todos los días</strong>
              <span className="texto-suave texto-chico">
                {rutinas.length === 1 ? '1 pendiente' : `${rutinas.length} pendientes`}
                {rutinasAtrasadas > 0 &&
                  ` · ${rutinasAtrasadas === 1 ? '1 es' : `${rutinasAtrasadas} son`} de días anteriores`}
              </span>
            </span>
            <ChevronDown className={`icono flecha-grupo ${rutinasAbiertas ? 'abierta' : ''}`} />
          </button>
          {rutinasAbiertas && <ul className="lista-tareas lista-rutinas">{rutinas.map(fila)}</ul>}
        </div>
      )}

      {completando && <CompletarTarea tarea={completando} onCerrar={() => setCompletando(null)} />}
      {postergando && <PostergarTarea tarea={postergando} onCerrar={() => setPostergando(null)} />}
    </section>
  );
}

/** Un renglón: la fecha en un cuadradito, primero el equipo y abajo la tarea. */
function FilaTarea({
  tarea: t,
  puedeHacerla,
  onPostergar,
  onCompletar,
}: {
  tarea: Tarea;
  puedeHacerla: boolean;
  onPostergar: () => void;
  onCompletar: () => void;
}) {
  const vencida = vencio(t.fecha);
  const { dia, mes, esHoy } = partesDeFecha(t.fecha);
  const { principal, secundario } = encabezadoTarea(t);
  return (
    <li className="fila-tarea-hoy">
      <span
        className={`cuadro-fecha ${vencida ? 'vencida' : esHoy ? 'hoy' : ''}`}
        title={vencida ? 'Ya venció' : undefined}
      >
        <b>{esHoy ? 'Hoy' : dia}</b>
        {!esHoy && <small>{mes}</small>}
      </span>
      <span className="tarea-que">
        <strong>{principal}</strong>
        <span className="texto-suave texto-chico">
          {[...new Set([secundario, t.descripcion].filter(Boolean))].join(' · ')}
          {t.fechaOriginal && (
            <span className="tarea-postergada">
              <Clock className="icono" aria-hidden /> postergada, era el {cuando(t.fechaOriginal)}
            </span>
          )}
        </span>
        {/* Sin responsable la puede hacer cualquiera: se dice, para que
            nadie piense que la ve por error. */}
        {t.asignadoAId === null && (
          <span className="etiqueta etiqueta-sin-responsable">
            Sin responsable: la puede hacer cualquiera
          </span>
        )}
      </span>
      {puedeHacerla && (
        <span className="fila-acciones">
          {/* Lo vencido no se posterga: se hace. */}
          {!vencida && (
            <button type="button" className="btn btn-fantasma btn-sm" onClick={onPostergar}>
              Postergar
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm"
            aria-label="Darla por hecha"
            onClick={onCompletar}
          >
            <Check className="icono" aria-hidden />
            Hecha
          </button>
        </span>
      )}
    </li>
  );
}
