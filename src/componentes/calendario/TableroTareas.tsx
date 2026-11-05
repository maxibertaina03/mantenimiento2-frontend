import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useState } from 'react';
import { useSoltarTarea, useTablero, useTomarTarea } from '@/api/calendario';
import { useUsuarioActual } from '@/api/usuarios';
import { Cargando, MensajeError } from '@/componentes/Estados';
import { HacerTareas } from '@/componentes/HacerTareas';
import { colorDeTarea } from '@/lib/coloresUsuario';
import { vencio } from '@/lib/diaDeTarea';
import { P, usePuede } from '@/lib/permisos';
import { encabezadoTarea } from '@/lib/tareas';
import type { AlcanceTablero, Tablero, Tarea } from '@/tipos/tarea';

type Columna = keyof Tablero;

const COLUMNAS: { id: Columna; titulo: string; vacia: string }[] = [
  { id: 'pendientes', titulo: 'Pendiente', vacia: 'Nada pendiente.' },
  { id: 'enProceso', titulo: 'En proceso', vacia: 'Nadie tomó nada todavía.' },
  { id: 'hechas', titulo: 'Listo', vacia: 'Todavía no se terminó nada.' },
];

const columnaDe = (t: Tarea): Columna =>
  t.estado === 'EN_PROCESO' ? 'enProceso' : t.estado === 'HECHA' ? 'hechas' : 'pendientes';

/** «10:42» si es de hoy; si no, «12 oct». */
function cuando(iso: string): string {
  const f = new Date(iso);
  const hoy = new Date();
  if (f.toDateString() === hoy.toDateString()) {
    return f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  return f.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');
}

const diaCorto = (iso: string) =>
  new Date(iso)
    .toLocaleDateString('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'short' })
    .replace('.', '');

/**
 * El tablero del calendario: Pendiente → En proceso → Listo.
 *
 * El calendario dice cuándo hay que hacer cada cosa; el tablero, en qué está
 * cada uno ahora. Se arrastra la tarjeta (con el mouse, el dedo o el teclado)
 * o se usa «Mover a…», que en el celular es lo cómodo:
 *
 * - a En proceso: «estoy en esto». Si no era de nadie, queda a tu nombre.
 * - a Pendiente: se suelta.
 * - a Listo: se cierra como siempre («Hecha, sin novedad» o «Hubo algo»), así
 *   cada tarea terminada sigue dejando su orden de trabajo y sus materiales.
 *
 * Cada uno mueve las suyas y las que no son de nadie; el encargado, todas.
 * Las rutinas de todos los días no están: se cierran de corrido desde Hoy.
 */
export function TableroTareas({ colores }: { colores: Map<string, string> }) {
  const puede = usePuede();
  const { data: yo } = useUsuarioActual();
  const [alcance, setAlcance] = useState<AlcanceTablero>('hoy');
  const [soloMias, setSoloMias] = useState(false);
  const [columnaVisible, setColumnaVisible] = useState<Columna>('pendientes');
  const [cerrando, setCerrando] = useState<Tarea | null>(null);
  const { data, isLoading, error } = useTablero(alcance);
  const tomar = useTomarTarea();
  const soltar = useSoltarTarea();

  const sensores = useSensors(
    // Un clic no es arrastrar: hay que moverlo un poco. En el celular, dejar
    // el dedo apoyado un instante, así deslizar la pantalla sigue andando.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const puedeTodas = puede(P.TAREAS_ASIGNAR);
  const puedeMover = (t: Tarea) =>
    puede(P.TAREAS_EDITAR) &&
    t.estado !== 'HECHA' &&
    (puedeTodas || t.asignadoAId === null || t.asignadoAId === yo?.id);

  const mover = (t: Tarea, destino: Columna) => {
    if (destino === columnaDe(t) || !puedeMover(t)) return;
    if (destino === 'hechas') setCerrando(t);
    else if (destino === 'enProceso') tomar.mutate(t);
    else soltar.mutate(t);
  };

  const todas = data ? [...data.pendientes, ...data.enProceso, ...data.hechas] : [];
  const alSoltar = ({ active, over }: DragEndEvent) => {
    const tarea = todas.find((t) => t.id === active.id);
    if (tarea && over) mover(tarea, over.id as Columna);
  };

  const filtrar = (lista: Tarea[]) =>
    soloMias && yo ? lista.filter((t) => t.asignadoAId === yo.id || t.asignadoAId === null) : lista;

  if (cerrando) {
    return <HacerTareas tareas={[cerrando]} inicialId={cerrando.id} onCerrar={() => setCerrando(null)} />;
  }

  return (
    <section className="tablero" aria-label="Tablero de tareas">
      <div className="tablero-barra">
        <div className="atajos-filtro" role="group" aria-label="Período">
          {(['hoy', 'semana'] as const).map((a) => (
            <button
              key={a}
              type="button"
              className={`chip-periodo${alcance === a ? ' activo' : ''}`}
              aria-pressed={alcance === a}
              onClick={() => setAlcance(a)}
            >
              {a === 'hoy' ? 'Hoy' : 'Esta semana'}
            </button>
          ))}
        </div>
        {yo && (
          <label className="casilla">
            <input type="checkbox" checked={soloMias} onChange={(e) => setSoloMias(e.target.checked)} />
            Solo las mías
          </label>
        )}
        <span className="texto-suave texto-chico">
          Pendiente incluye lo atrasado. Arrastrá las tarjetas o usá «Mover a…».
        </span>
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {tomar.error && <MensajeError error={tomar.error} />}
      {soltar.error && <MensajeError error={soltar.error} />}

      {data && (
        <>
          {/* En el celular se ve una columna por vez. */}
          <div className="tablero-solapas" role="tablist" aria-label="Columna">
            {COLUMNAS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={columnaVisible === c.id}
                className={`solapa ${columnaVisible === c.id ? 'activa' : ''}`}
                onClick={() => setColumnaVisible(c.id)}
              >
                {c.titulo} <span className="contador-pestana">{filtrar(data[c.id]).length}</span>
              </button>
            ))}
          </div>

          <DndContext sensors={sensores} onDragEnd={alSoltar}>
            <div className="tablero-columnas">
              {COLUMNAS.map((c) => (
                <ColumnaTablero
                  key={c.id}
                  id={c.id}
                  titulo={c.titulo}
                  vacia={c.vacia}
                  visibleEnMovil={columnaVisible === c.id}
                  tareas={filtrar(data[c.id])}
                  colores={colores}
                  puedeMover={puedeMover}
                  onMover={mover}
                />
              ))}
            </div>
          </DndContext>
        </>
      )}
    </section>
  );
}

function ColumnaTablero({
  id,
  titulo,
  vacia,
  visibleEnMovil,
  tareas,
  colores,
  puedeMover,
  onMover,
}: {
  id: Columna;
  titulo: string;
  vacia: string;
  visibleEnMovil: boolean;
  tareas: Tarea[];
  colores: Map<string, string>;
  puedeMover: (t: Tarea) => boolean;
  onMover: (t: Tarea, destino: Columna) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={[
        'tablero-columna',
        `tablero-${id}`,
        isOver ? 'encima' : '',
        visibleEnMovil ? 'visible-movil' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={titulo}
    >
      <h2 className="tablero-columna-titulo">
        {titulo} <span className="contador-pestana">{tareas.length}</span>
      </h2>
      {tareas.length === 0 && <p className="texto-suave texto-chico">{vacia}</p>}
      {tareas.map((t) => (
        <TarjetaTarea
          key={t.id}
          tarea={t}
          colores={colores}
          movible={puedeMover(t)}
          onMover={(destino) => onMover(t, destino)}
        />
      ))}
    </div>
  );
}

function TarjetaTarea({
  tarea: t,
  colores,
  movible,
  onMover,
}: {
  tarea: Tarea;
  colores: Map<string, string>;
  movible: boolean;
  onMover: (destino: Columna) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: t.id,
    disabled: !movible,
  });
  const { color } = colorDeTarea(t.asignadoAId, colores);
  const { principal, secundario } = encabezadoTarea(t);
  const columna = columnaDe(t);
  const atrasada = t.estado === 'PENDIENTE' && vencio(t.fecha);

  return (
    <article
      ref={setNodeRef}
      className={[
        'tablero-tarjeta',
        movible ? 'movible' : '',
        isDragging ? 'arrastrando' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        borderLeftColor: color,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      title={
        movible
          ? undefined
          : t.estado === 'HECHA'
            ? 'Ya está hecha.'
            : `Es de ${t.asignadoANombre}: la mueve quien la tiene a cargo, o el encargado.`
      }
      {...attributes}
      {...listeners}
    >
      <strong className="tablero-tarjeta-titulo">{principal}</strong>
      {secundario && <span className="texto-chico">{secundario}</span>}
      <span className="texto-suave texto-chico">
        {t.asignadoANombre ?? 'Sin repartir'}
        {' · '}
        {atrasada ? (
          <span className="texto-alerta">Atrasada, era del {diaCorto(t.fecha)}</span>
        ) : (
          diaCorto(t.fecha)
        )}
      </span>
      {t.estado === 'EN_PROCESO' && t.enProcesoDesde && (
        <span className="tablero-en-proceso texto-chico">En proceso desde {cuando(t.enProcesoDesde)}</span>
      )}
      {t.estado === 'HECHA' && t.ordenTrabajoNumero && (
        <span className="texto-suave texto-chico">{t.ordenTrabajoNumero}</span>
      )}
      {movible && (
        <select
          className="tablero-mover"
          aria-label={`Mover «${principal}» a`}
          value=""
          // Que tocar el desplegable no empiece a arrastrar la tarjeta.
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => onMover(e.target.value as Columna)}
        >
          <option value="" disabled>
            Mover a…
          </option>
          {COLUMNAS.filter((c) => c.id !== columna).map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>
      )}
    </article>
  );
}
