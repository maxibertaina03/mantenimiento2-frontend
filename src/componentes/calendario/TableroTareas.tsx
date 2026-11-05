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
import { useSolicitud } from '@/api/solicitudes';
import { useUsuarioActual } from '@/api/usuarios';
import { Cargando, MensajeError } from '@/componentes/Estados';
import { HacerTareas } from '@/componentes/HacerTareas';
import { ModalDetalleOrden } from '@/componentes/ordenesTrabajo/ModalDetalleOrden';
import { DetalleSolicitud } from '@/componentes/solicitudes/DetalleSolicitud';
import { colorDeTarea } from '@/lib/coloresUsuario';
import { vencio } from '@/lib/diaDeTarea';
import { P, usePuede } from '@/lib/permisos';
import { encabezadoTarea } from '@/lib/tareas';
import type {
  AlcanceTablero,
  OrdenEnTablero,
  SolicitudEnTablero,
  Tarea,
} from '@/tipos/tarea';

type Columna = 'pendientes' | 'enProceso' | 'hechas';

const COLUMNAS: { id: Columna; titulo: string; vacia: string }[] = [
  { id: 'pendientes', titulo: 'Pendiente', vacia: 'Nada pendiente.' },
  { id: 'enProceso', titulo: 'En proceso', vacia: 'Nadie tomó nada todavía.' },
  { id: 'hechas', titulo: 'Listo', vacia: 'Todavía no se terminó nada.' },
];

/**
 * Una tarjeta del tablero: una tarea del calendario, una orden de trabajo o
 * una solicitud de un sector. Cada una se mueve a su manera.
 */
type Item =
  | { tipo: 'tarea'; clave: string; columna: Columna; tarea: Tarea }
  | { tipo: 'orden'; clave: string; columna: Columna; orden: OrdenEnTablero }
  | { tipo: 'solicitud'; clave: string; columna: Columna; solicitud: SolicitudEnTablero };

/** Lo que se abre al mover una orden o una solicitud. */
type Abierto =
  | { tipo: 'cerrarTarea'; tarea: Tarea }
  | { tipo: 'orden'; id: string }
  | { tipo: 'solicitud'; id: string; accion: 'orden' | 'resolver' | null };

const columnaDeTarea = (t: Tarea): Columna =>
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
 * cada uno ahora. Junta tres cosas:
 *
 * - las tareas del calendario (sin las rutinas de todos los días): a En
 *   proceso se toman, a Pendiente se sueltan, a Listo se cierran como siempre;
 * - las órdenes de trabajo abiertas, en En proceso: a Listo abre la orden para
 *   cerrarla contando qué se hizo;
 * - las solicitudes que mandaron los sectores, en Pendiente (para quien las
 *   revisa): a En proceso se genera su orden de trabajo; a Listo, se resuelve
 *   sin orden.
 *
 * Se arrastra (mouse, dedo o teclado) o se usa «Mover a…». Cada uno mueve lo
 * suyo y lo que no es de nadie; el encargado, todo.
 */
export function TableroTareas({ colores }: { colores: Map<string, string> }) {
  const puede = usePuede();
  const { data: yo } = useUsuarioActual();
  const [alcance, setAlcance] = useState<AlcanceTablero>('hoy');
  const [soloMias, setSoloMias] = useState(false);
  const [columnaVisible, setColumnaVisible] = useState<Columna>('pendientes');
  const [abierto, setAbierto] = useState<Abierto | null>(null);
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
  const esMia = (asignadoAId: string | null) =>
    asignadoAId === null || asignadoAId === yo?.id;

  /** Adónde se puede llevar cada tarjeta. Vacío: no se mueve. */
  const destinos = (item: Item): Columna[] => {
    if (item.tipo === 'tarea') {
      const t = item.tarea;
      const laMueve =
        puede(P.TAREAS_EDITAR) && t.estado !== 'HECHA' && (puedeTodas || esMia(t.asignadoAId));
      return laMueve ? COLUMNAS.map((c) => c.id).filter((c) => c !== item.columna) : [];
    }
    if (item.tipo === 'orden') {
      // Una orden abierta solo se cierra; reabrirla se hace desde la orden.
      return item.columna === 'enProceso' && puede(P.TRABAJOS_EDITAR) ? ['hechas'] : [];
    }
    if (!puede(P.SOLICITUDES_GESTIONAR)) return [];
    return puede(P.TRABAJOS_EDITAR) ? ['enProceso', 'hechas'] : ['hechas'];
  };

  const mover = (item: Item, destino: Columna) => {
    if (!destinos(item).includes(destino)) return;
    if (item.tipo === 'tarea') {
      if (destino === 'hechas') setAbierto({ tipo: 'cerrarTarea', tarea: item.tarea });
      else if (destino === 'enProceso') tomar.mutate(item.tarea);
      else soltar.mutate(item.tarea);
    } else if (item.tipo === 'orden') {
      setAbierto({ tipo: 'orden', id: item.orden.id });
    } else {
      setAbierto({
        tipo: 'solicitud',
        id: item.solicitud.id,
        accion: destino === 'enProceso' ? 'orden' : 'resolver',
      });
    }
  };

  const items: Item[] = data
    ? [
        ...(data.solicitudesNuevas ?? []).map((s) => ({
          tipo: 'solicitud' as const,
          clave: `s:${s.id}`,
          columna: 'pendientes' as const,
          solicitud: s,
        })),
        ...[...data.pendientes, ...data.enProceso, ...data.hechas].map((t) => ({
          tipo: 'tarea' as const,
          clave: `t:${t.id}`,
          columna: columnaDeTarea(t),
          tarea: t,
        })),
        ...(data.ordenesAbiertas ?? []).map((o) => ({
          tipo: 'orden' as const,
          clave: `o:${o.id}`,
          columna: 'enProceso' as const,
          orden: o,
        })),
        ...(data.ordenesCerradas ?? []).map((o) => ({
          tipo: 'orden' as const,
          clave: `o:${o.id}`,
          columna: 'hechas' as const,
          orden: o,
        })),
      ]
    : [];

  const visibles = items.filter((item) => {
    if (!soloMias || !yo) return true;
    if (item.tipo === 'tarea') return esMia(item.tarea.asignadoAId);
    if (item.tipo === 'orden') return item.orden.asignadoAId === yo.id;
    // Las solicitudes no son de nadie todavía: «solo las mías» las esconde.
    return false;
  });
  const deColumna = (c: Columna) => visibles.filter((i) => i.columna === c);

  const alSoltar = ({ active, over }: DragEndEvent) => {
    const item = items.find((i) => i.clave === active.id);
    if (item && over) mover(item, over.id as Columna);
  };

  if (abierto?.tipo === 'cerrarTarea') {
    return (
      <HacerTareas
        tareas={[abierto.tarea]}
        inicialId={abierto.tarea.id}
        onCerrar={() => setAbierto(null)}
      />
    );
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
                {c.titulo} <span className="contador-pestana">{deColumna(c.id).length}</span>
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
                  items={deColumna(c.id)}
                  colores={colores}
                  destinos={destinos}
                  onMover={mover}
                  onAbrir={(item) =>
                    item.tipo === 'orden'
                      ? setAbierto({ tipo: 'orden', id: item.orden.id })
                      : item.tipo === 'solicitud'
                        ? setAbierto({ tipo: 'solicitud', id: item.solicitud.id, accion: null })
                        : undefined
                  }
                />
              ))}
            </div>
          </DndContext>
        </>
      )}

      {abierto?.tipo === 'orden' && (
        <ModalDetalleOrden id={abierto.id} onCerrar={() => setAbierto(null)} />
      )}
      {abierto?.tipo === 'solicitud' && (
        <SolicitudAbierta
          id={abierto.id}
          accion={abierto.accion}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </section>
  );
}

/** La solicitud completa (con fotos), pedida al abrirla desde el tablero. */
function SolicitudAbierta({
  id,
  accion,
  onCerrar,
}: {
  id: string;
  accion: 'orden' | 'resolver' | null;
  onCerrar: () => void;
}) {
  const { data, error } = useSolicitud(id);
  if (error) return <MensajeError error={error} />;
  if (!data) return null;
  return <DetalleSolicitud solicitud={data} accionInicial={accion} onCerrar={onCerrar} />;
}

function ColumnaTablero({
  id,
  titulo,
  vacia,
  visibleEnMovil,
  items,
  colores,
  destinos,
  onMover,
  onAbrir,
}: {
  id: Columna;
  titulo: string;
  vacia: string;
  visibleEnMovil: boolean;
  items: Item[];
  colores: Map<string, string>;
  destinos: (item: Item) => Columna[];
  onMover: (item: Item, destino: Columna) => void;
  onAbrir: (item: Item) => void;
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
        {titulo} <span className="contador-pestana">{items.length}</span>
      </h2>
      {items.length === 0 && <p className="texto-suave texto-chico">{vacia}</p>}
      {items.map((item) => (
        <Tarjeta
          key={item.clave}
          item={item}
          colores={colores}
          destinos={destinos(item)}
          onMover={(destino) => onMover(item, destino)}
          onAbrir={() => onAbrir(item)}
        />
      ))}
    </div>
  );
}

/** Lo que dice cada tarjeta, según qué es. */
function contenido(item: Item, colores: Map<string, string>) {
  if (item.tipo === 'tarea') {
    const t = item.tarea;
    const { principal, secundario } = encabezadoTarea(t);
    const atrasada = t.estado === 'PENDIENTE' && vencio(t.fecha);
    return {
      titulo: principal,
      color: colorDeTarea(t.asignadoAId, colores).color,
      cuerpo: (
        <>
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
            <span className="tablero-en-proceso texto-chico">
              En proceso desde {cuando(t.enProcesoDesde)}
            </span>
          )}
          {t.estado === 'HECHA' && t.ordenTrabajoNumero && (
            <span className="texto-suave texto-chico">{t.ordenTrabajoNumero}</span>
          )}
        </>
      ),
      ayuda:
        t.estado === 'HECHA'
          ? 'Ya está hecha.'
          : `Es de ${t.asignadoANombre}: la mueve quien la tiene a cargo, o el encargado.`,
    };
  }
  if (item.tipo === 'orden') {
    const o = item.orden;
    return {
      titulo: o.sobre ?? o.titulo,
      color: colorDeTarea(o.asignadoAId, colores).color,
      etiqueta: o.numero,
      cuerpo: (
        <>
          {o.sobre && <span className="texto-chico">{o.titulo}</span>}
          <span className="texto-suave texto-chico">
            {o.asignadoANombre ?? 'Sin asignar'}
            {o.cerradaEn
              ? ` · cerrada ${cuando(o.cerradaEn)}`
              : ` · abierta desde ${cuando(o.abiertaEn)}`}
          </span>
          {o.tallerNombre && (
            <span className="tablero-en-proceso texto-chico">En taller: {o.tallerNombre}</span>
          )}
          {o.solicitudNumero && (
            <span className="texto-suave texto-chico">
              De la solicitud {o.solicitudNumero}
              {o.urgencia === 'URGENTE' && <span className="texto-alerta"> · urgente</span>}
            </span>
          )}
        </>
      ),
      ayuda: o.cerradaEn ? 'Ya está cerrada.' : 'La cierra quien la tiene a cargo.',
    };
  }
  const s = item.solicitud;
  return {
    titulo: s.equipoNombre ?? s.sectorNombre,
    color: s.urgencia === 'URGENTE' ? '#dc2626' : '#9ca3af',
    etiqueta: s.numero,
    cuerpo: (
      <>
        <span className="texto-chico tablero-solicitud-texto">{s.descripcion}</span>
        <span className="texto-suave texto-chico">
          {s.equipoNombre ? `${s.sectorNombre} · ` : ''}
          {s.solicitadaPorNombre ?? 'Un sector'} · {cuando(s.creadoEn)}
        </span>
        {s.urgencia === 'URGENTE' && (
          <span className="texto-alerta texto-chico">Urgente / máquina parada</span>
        )}
      </>
    ),
    ayuda: 'La revisa quien gestiona las solicitudes.',
  };
}

function Tarjeta({
  item,
  colores,
  destinos,
  onMover,
  onAbrir,
}: {
  item: Item;
  colores: Map<string, string>;
  destinos: Columna[];
  onMover: (destino: Columna) => void;
  onAbrir: () => void;
}) {
  const movible = destinos.length > 0;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.clave,
    disabled: !movible,
  });
  const { titulo, color, etiqueta, cuerpo, ayuda } = contenido(item, colores);
  const abrible = item.tipo !== 'tarea';

  return (
    <article
      ref={setNodeRef}
      className={[
        'tablero-tarjeta',
        `tablero-tarjeta-${item.tipo}`,
        movible ? 'movible' : '',
        isDragging ? 'arrastrando' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        borderLeftColor: color,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      title={movible ? undefined : ayuda}
      {...attributes}
      {...listeners}
    >
      {etiqueta && (
        <span className="tablero-tarjeta-etiqueta texto-chico">
          {item.tipo === 'orden' ? 'Orden ' : 'Solicitud '}
          {etiqueta}
        </span>
      )}
      <strong className="tablero-tarjeta-titulo">{titulo}</strong>
      {cuerpo}
      <span className="tablero-tarjeta-acciones">
        {movible && (
          <select
            className="tablero-mover"
            aria-label={`Mover «${titulo}» a`}
            value=""
            // Que tocar el desplegable no empiece a arrastrar la tarjeta.
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onChange={(e) => onMover(e.target.value as Columna)}
          >
            <option value="" disabled>
              Mover a…
            </option>
            {COLUMNAS.filter((c) => destinos.includes(c.id)).map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        )}
        {abrible && (
          <button
            type="button"
            className="btn-enlace texto-chico"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onAbrir}
          >
            Ver
          </button>
        )}
      </span>
    </article>
  );
}
