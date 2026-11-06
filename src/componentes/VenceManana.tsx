import { AlarmClock, Check } from 'lucide-react';
import { useState } from 'react';
import { useCalendario } from '@/api/calendario';
import { useUsuarioActual } from '@/api/usuarios';
import { HacerTareas } from '@/componentes/HacerTareas';
import { PostergarTarea } from '@/componentes/PostergarTarea';
import { P, usePuede } from '@/lib/permisos';
import { encabezadoTarea, esDeTodosLosDias } from '@/lib/tareas';
import type { Tarea } from '@/tipos/tarea';

/** Mañana, como AAAA-MM-DD del día de la planta. */
function manana(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/**
 * El aviso del día anterior: lo que vence mañana, a quien le toca (o a todos,
 * si no tiene responsable).
 *
 * Lo de un plan o una rutina que pasa su día sin hacerse ni postergarse queda
 * incompleto y ya no se hace. Este es el momento de postergarlo si no se va a
 * llegar, o de adelantarlo. Lo de todos los días (las purgas diarias) va en
 * una línea: avisar cada purga, cada día, sería ruido que nadie lee.
 */
export function VenceManana() {
  const puede = usePuede();
  const { data: yo } = useUsuarioActual();
  const habilitado = puede(P.TAREAS_VER);
  const dia = manana();
  const { data } = useCalendario(dia, dia, undefined, habilitado);
  const [postergando, setPostergando] = useState<Tarea | null>(null);
  const [haciendo, setHaciendo] = useState<Tarea | null>(null);
  const puedeHacerlas = puede(P.TAREAS_EDITAR);

  if (!habilitado || !data || !yo) return null;
  const mias = data.tareas.filter(
    (t) =>
      t.estado === 'PENDIENTE' &&
      (t.planId !== null || t.rutinaId !== null) &&
      (t.asignadoAId === null || t.asignadoAId === yo.id),
  );
  if (mias.length === 0) return null;
  const importantes = mias.filter((t) => !esDeTodosLosDias(t));
  const diarias = mias.filter(esDeTodosLosDias);

  return (
    <section className="panel panel-lista vence-manana" aria-label="Vence mañana">
      <div className="panel-cabecera">
        <h2>
          <AlarmClock className="icono" aria-hidden />
          Vence mañana
          <span className="badge badge-aviso">{mias.length}</span>
        </h2>
      </div>
      <p className="texto-suave texto-chico">
        Si mañana no se hace ni se posterga, queda <strong>incompleta</strong> y el plan pasa a
        la próxima fecha.
      </p>
      {importantes.length > 0 && (
        <ul className="lista-tareas">
          {importantes.map((t) => {
            const { principal, secundario } = encabezadoTarea(t);
            return (
              <li key={t.id} className="fila-tarea-hoy">
                <span className="tarea-que">
                  <strong>{principal}</strong>
                  <span className="texto-suave texto-chico">
                    {secundario}
                    {t.asignadoAId === null && ' · sin responsable: la puede hacer cualquiera'}
                  </span>
                </span>
                {puedeHacerlas && (
                  <span className="fila-acciones">
                    <button
                      type="button"
                      className="btn btn-fantasma btn-sm"
                      onClick={() => setPostergando(t)}
                    >
                      Postergar
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setHaciendo(t)}>
                      <Check className="icono" aria-hidden />
                      Hacerla ya
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {diarias.length > 0 && (
        <p className="texto-suave texto-chico">
          Y {diarias.length === 1 ? 'una de todos los días' : `${diarias.length} de todos los días`}{' '}
          ({[...new Set(diarias.map((t) => encabezadoTarea(t).principal))].slice(0, 4).join(', ')}
          {diarias.length > 4 ? '…' : ''}).
        </p>
      )}
      {postergando && (
        <PostergarTarea tarea={postergando} onCerrar={() => setPostergando(null)} />
      )}
      {haciendo && (
        <HacerTareas tareas={[haciendo]} inicialId={haciendo.id} onCerrar={() => setHaciendo(null)} />
      )}
    </section>
  );
}
