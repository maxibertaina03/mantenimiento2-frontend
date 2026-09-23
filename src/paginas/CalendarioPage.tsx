import { useMemo, useState } from 'react';
import { useAsignarTarea, useCalendario, useCancelarTarea } from '@/api/calendario';
import { useAsignables } from '@/api/ordenesTrabajo';
import { useUsuarioActual } from '@/api/usuarios';
import { CompletarTarea } from '@/componentes/CompletarTarea';
import { NuevaTarea } from '@/componentes/NuevaTarea';
import { RutinasDeTareas } from '@/componentes/RutinasDeTareas';
import { Cargando, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { P, usePuede } from '@/lib/permisos';
import { ETIQUETA_ESTADO_TAREA } from '@/tipos/tarea';
import type { Tarea } from '@/tipos/tarea';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** El día en ISO, sin hora y sin que el huso lo corra un día. */
function aIso(fecha: Date): string {
  return new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * Los días que se dibujan en la grilla de un mes.
 *
 * Siempre semanas completas de lunes a domingo, aunque el mes empiece un
 * jueves: una grilla con huecos al principio se lee mal y se imprime peor.
 */
function diasDelMes(ancla: Date): Date[] {
  const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
  // getDay() da 0 para domingo; acá la semana arranca el lunes.
  const corrimiento = (primero.getDay() + 6) % 7;
  const inicio = new Date(primero);
  inicio.setDate(primero.getDate() - corrimiento);

  const dias: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    dias.push(d);
  }
  // Se recortan las semanas enteras que ya quedaron fuera del mes.
  while (dias.length > 35 && dias[35].getMonth() !== ancla.getMonth()) dias.length = 35;
  return dias;
}

/**
 * El calendario: qué hay que hacer, cuándo y quién.
 *
 * Junta tres cosas en una sola lista: los services que vencen según el plan de
 * cada máquina, las rutinas que se repiten, y lo que alguien programó a mano.
 * Las tres son tareas, así que se ven y se completan igual.
 */
export function CalendarioPage() {
  const puede = usePuede();
  const { data: yo } = useUsuarioActual();

  const [ancla, setAncla] = useState(() => new Date());
  const [soloMias, setSoloMias] = useState(false);
  const [tareaAbierta, setTareaAbierta] = useState<Tarea | null>(null);
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
  const [verRutinas, setVerRutinas] = useState(false);

  const dias = useMemo(() => diasDelMes(ancla), [ancla]);
  const desde = aIso(dias[0]);
  const hasta = aIso(dias[dias.length - 1]);

  const { data, isLoading, error } = useCalendario(
    desde,
    hasta,
    soloMias ? (yo?.id ?? undefined) : undefined,
  );
  const cancelar = useCancelarTarea();
  const { data: asignables } = useAsignables(puede(P.TAREAS_ASIGNAR));

  /** Las tareas de cada día, para no recorrer la lista entera por casilla. */
  const porDia = useMemo(() => {
    const mapa = new Map<string, Tarea[]>();
    for (const t of data?.tareas ?? []) {
      const clave = t.fecha.slice(0, 10);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(t);
    }
    return mapa;
  }, [data]);

  const mover = (meses: number) => {
    const siguiente = new Date(ancla);
    siguiente.setMonth(ancla.getMonth() + meses);
    setAncla(siguiente);
  };

  const hoy = aIso(new Date());
  const pendientes = (data?.tareas ?? []).filter((t) => t.estado === 'PENDIENTE');
  const sinRepartir = pendientes.filter((t) => t.asignadoAId === null);

  return (
    <div className="pagina">
      <div className="cabecera-pagina no-imprimir">
        <div>
          <h1>Calendario</h1>
          <p className="texto-suave">
            Los services que vencen, las rutinas del día y lo que se programó a mano. Todo junto,
            y cada cosa con su responsable.
          </p>
        </div>
        <div className="fila-acciones">
          {puede(P.TAREAS_EDITAR) && (
            <>
              <button className="btn" onClick={() => setVerRutinas(true)}>
                ↻ Rutinas
              </button>
              <button className="btn btn-primario" onClick={() => setDiaElegido(hoy)}>
                + Nueva tarea
              </button>
            </>
          )}
          <button className="btn" onClick={() => window.print()}>
            🖨 Imprimir
          </button>
        </div>
      </div>

      <div className="barra-calendario no-imprimir">
        <button className="btn btn-sm" onClick={() => mover(-1)}>
          ← Anterior
        </button>
        <strong>
          {MESES[ancla.getMonth()]} de {ancla.getFullYear()}
        </strong>
        <button className="btn btn-sm" onClick={() => mover(1)}>
          Siguiente →
        </button>
        <button className="btn btn-sm" onClick={() => setAncla(new Date())}>
          Hoy
        </button>

        {yo && (
          <label className="casilla">
            <input
              type="checkbox"
              checked={soloMias}
              onChange={(e) => setSoloMias(e.target.checked)}
            />
            Solo las mías
          </label>
        )}
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {cancelar.error && <MensajeError error={cancelar.error} />}

      {sinRepartir.length > 0 && (
        <p className="aviso-escaneo es-error no-imprimir">
          {sinRepartir.length === 1
            ? 'Hay una tarea sin repartir en este mes.'
            : `Hay ${sinRepartir.length} tareas sin repartir en este mes.`}{' '}
          Mientras no tengan responsable, todos suponen que las hace otro.
        </p>
      )}

      {/* El encabezado del mes para el papel: en pantalla ya está arriba. */}
      <h2 className="solo-imprimir">
        Tareas de {MESES[ancla.getMonth()]} de {ancla.getFullYear()}
      </h2>

      <div className="calendario">
        {DIAS.map((d) => (
          <div className="calendario-cabecera" key={d}>
            {d}
          </div>
        ))}

        {dias.map((dia) => {
          const iso = aIso(dia);
          const delMes = dia.getMonth() === ancla.getMonth();
          const tareas = porDia.get(iso) ?? [];

          return (
            <div
              key={iso}
              className={[
                'calendario-dia',
                delMes ? '' : 'otro-mes',
                iso === hoy ? 'es-hoy' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="calendario-numero">
                <span>{dia.getDate()}</span>
                {puede(P.TAREAS_EDITAR) && delMes && (
                  <button
                    className="calendario-agregar no-imprimir"
                    title="Programar una tarea este día"
                    onClick={() => setDiaElegido(iso)}
                  >
                    +
                  </button>
                )}
              </div>

              {tareas.map((t) => (
                <button
                  key={t.id}
                  className={`calendario-tarea estado-${t.estado.toLowerCase()}`}
                  onClick={() => setTareaAbierta(t)}
                >
                  <span className="calendario-tarea-titulo">{t.titulo}</span>
                  <span className="texto-suave texto-chico">
                    {t.asignadoANombre ?? 'sin repartir'}
                    {t.equipoNombre ? ` · ${t.equipoNombre}` : ''}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {tareaAbierta && (
        <DetalleTarea
          tarea={tareaAbierta}
          asignables={asignables ?? []}
          onCerrar={() => setTareaAbierta(null)}
        />
      )}

      {diaElegido && (
        <NuevaTarea fecha={diaElegido} onCerrar={() => setDiaElegido(null)} />
      )}

      {verRutinas && <RutinasDeTareas onCerrar={() => setVerRutinas(false)} />}
    </div>
  );
}

// ─────────────────────── Detalle de una tarea ───────────────────────

function DetalleTarea({
  tarea,
  asignables,
  onCerrar,
}: {
  tarea: Tarea;
  asignables: { id: string; nombre: string }[];
  onCerrar: () => void;
}) {
  const puede = usePuede();
  const { data: yo } = useUsuarioActual();
  const [completando, setCompletando] = useState(false);
  const cancelar = useCancelarTarea();
  const asignar = useAsignarTarea();
  const [nuevoDuenio, setNuevoDuenio] = useState('');

  // La suya, o una que no es de nadie. La de otro se ve y no se toca.
  const esMia = !!yo && (tarea.asignadoAId === null || tarea.asignadoAId === yo.id);
  const sePuedeHacer = tarea.estado === 'PENDIENTE' && puede(P.TAREAS_EDITAR) && esMia;

  if (completando) {
    return <CompletarTarea tarea={tarea} onCerrar={onCerrar} />;
  }

  return (
    <Modal titulo={tarea.titulo} abierto onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p className="texto-suave">
          {new Date(tarea.fecha).toLocaleDateString('es-AR', { timeZone: 'UTC' })} ·{' '}
          {ETIQUETA_ESTADO_TAREA[tarea.estado]}
          {tarea.equipoNombre ? ` · ${tarea.equipoNombre}` : ''}
        </p>

        {tarea.descripcion && <p>{tarea.descripcion}</p>}

        {tarea.planNombre && (
          <p className="texto-suave texto-chico">
            Sale del plan de mantenimiento «{tarea.planNombre}». Al darla por hecha, la próxima
            fecha del plan corre sola.
          </p>
        )}
        {tarea.rutinaTitulo && (
          <p className="texto-suave texto-chico">Se repite: «{tarea.rutinaTitulo}».</p>
        )}

        <p>
          <span className="texto-suave">Asignada a: </span>
          <strong>{tarea.asignadoANombre ?? 'nadie todavía'}</strong>
          {esMia && tarea.asignadoAId && <span className="texto-suave"> (vos)</span>}
        </p>

        {tarea.ordenTrabajoNumero && (
          <p className="texto-suave texto-chico">
            Quedó registrada como la orden de trabajo {tarea.ordenTrabajoNumero}.
          </p>
        )}

        {tarea.estado === 'PENDIENTE' && !esMia && (
          <p className="aviso-escaneo es-error">
            Esta tarea es de {tarea.asignadoANombre}. Podés verla, pero la hace quien la tiene a
            cargo.
          </p>
        )}

        {tarea.estado === 'PENDIENTE' && puede(P.TAREAS_ASIGNAR) && (
          <label className="campo">
            Darle la tarea a alguien
            <div className="fila-acciones">
              <select value={nuevoDuenio} onChange={(e) => setNuevoDuenio(e.target.value)}>
                <option value="">Elegí a quién</option>
                {asignables
                  .filter((u) => u.id !== tarea.asignadoAId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!nuevoDuenio || asignar.isPending}
                onClick={() =>
                  asignar.mutate(
                    { id: tarea.id, asignadoAId: nuevoDuenio },
                    { onSuccess: onCerrar },
                  )
                }
              >
                {asignar.isPending ? 'Asignando…' : 'Asignar'}
              </button>
            </div>
            {asignar.error && <MensajeError error={asignar.error} />}
          </label>
        )}

        <div className="acciones">
          {tarea.estado === 'PENDIENTE' && puede(P.TAREAS_EDITAR) && (
            <button
              type="button"
              className="btn btn-peligro"
              disabled={cancelar.isPending}
              onClick={() => {
                if (!confirm('¿Sacar esta tarea del calendario?')) return;
                cancelar.mutate(tarea.id, { onSuccess: onCerrar });
              }}
            >
              Cancelar tarea
            </button>
          )}
          {sePuedeHacer && (
            <button
              type="button"
              className="btn btn-primario"
              onClick={() => setCompletando(true)}
            >
              Darla por hecha
            </button>
          )}
          <button type="button" className="btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
