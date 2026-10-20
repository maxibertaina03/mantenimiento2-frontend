import { CalendarDays, Check, Clock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMisTareas } from '@/api/calendario';
import { vencio } from '@/lib/diaDeTarea';
import { P, usePuede } from '@/lib/permisos';
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
 */
export function MisTareasDeHoy() {
  const puede = usePuede();
  // Un hook no se puede llamar condicionalmente, así que la consulta se apaga.
  const habilitado = puede(P.TAREAS_VER);
  const { data, isLoading, error } = useMisTareas(habilitado);
  const [completando, setCompletando] = useState<Tarea | null>(null);
  const [postergando, setPostergando] = useState<Tarea | null>(null);
  const [todas, setTodas] = useState(false);
  const puedeHacerlas = puede(P.TAREAS_EDITAR);

  if (!habilitado) return null;

  const tareas = data ?? [];
  // Si no tiene nada pendiente, no se muestra una tarjeta vacía diciéndolo:
  // ocupa lugar para no decir nada.
  if (!isLoading && !error && tareas.length === 0) return null;

  const vencidas = tareas.filter((t) => vencio(t.fecha));
  // Las primeras, para que la pantalla de entrada no se haga larga; el resto, a pedido.
  const visibles = todas ? tareas : tareas.slice(0, TAREAS_A_LA_VISTA);

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
            tareas.length > 0 && <span className="badge">{tareas.length}</span>
          )}
        </h2>
        <Link to="/calendario" className="btn btn-fantasma btn-sm">
          <CalendarDays className="icono" aria-hidden />
          Calendario
        </Link>
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      <ul className="lista-tareas">
        {visibles.map((t) => {
          const vencida = vencio(t.fecha);
          const { dia, mes, esHoy } = partesDeFecha(t.fecha);
          return (
            <li key={t.id} className="fila-tarea-hoy">
              <span
                className={`cuadro-fecha ${vencida ? 'vencida' : esHoy ? 'hoy' : ''}`}
                title={vencida ? 'Ya venció' : undefined}
              >
                <b>{esHoy ? 'Hoy' : dia}</b>
                {!esHoy && <small>{mes}</small>}
              </span>
              <span className="tarea-que">
                <strong>{t.titulo}</strong>
                <span className="texto-suave texto-chico">
                  {t.equipoNombre ?? t.descripcion ?? ''}
                  {t.equipoNombre && t.descripcion ? ` · ${t.descripcion}` : ''}
                  {t.fechaOriginal && (
                    <span className="tarea-postergada">
                      <Clock className="icono" aria-hidden /> postergada, era el{' '}
                      {cuando(t.fechaOriginal)}
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
              {puedeHacerlas && (
                <span className="fila-acciones">
                  {/* Lo vencido no se posterga: se hace. */}
                  {!vencida && (
                    <button
                      type="button"
                      className="btn btn-fantasma btn-sm"
                      onClick={() => setPostergando(t)}
                    >
                      Postergar
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label="Darla por hecha"
                    onClick={() => setCompletando(t)}
                  >
                    <Check className="icono" aria-hidden />
                    Hecha
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {tareas.length > TAREAS_A_LA_VISTA && (
        <div className="panel-pie">
          <button
            type="button"
            className="btn btn-fantasma btn-sm"
            onClick={() => setTodas((v) => !v)}
          >
            {todas ? 'Ver menos' : `Ver las ${tareas.length}`}
          </button>
        </div>
      )}

      {completando && <CompletarTarea tarea={completando} onCerrar={() => setCompletando(null)} />}
      {postergando && <PostergarTarea tarea={postergando} onCerrar={() => setPostergando(null)} />}
    </section>
  );
}
