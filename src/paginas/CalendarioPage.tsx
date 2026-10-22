import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  Repeat,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { flushSync } from 'react-dom';
import { useAsignarTarea, useCalendario, useCancelarTarea } from '@/api/calendario';
import { useAsignables } from '@/api/ordenesTrabajo';
import { colorDeTarea, coloresPorPersona } from '@/lib/coloresUsuario';
import { useUsuarios } from '@/api/usuarios';
import { useUsuarioActual } from '@/api/usuarios';
import { CalendarioImpreso, type ModoImpresion } from '@/componentes/CalendarioImpreso';
import { CompletarTarea } from '@/componentes/CompletarTarea';
import { PostergarTarea } from '@/componentes/PostergarTarea';
import { vencio } from '@/lib/diaDeTarea';
import { encabezadoTarea, esRutina } from '@/lib/tareas';
import { formatearFechaSola } from '@/lib/formato';
import { ElegirImpresion } from '@/componentes/ElegirImpresion';
import { NuevaTarea } from '@/componentes/NuevaTarea';
import { RutinasDeTareas } from '@/componentes/RutinasDeTareas';
import { Cargando, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { DIAS, MESES, aIso, diasDelMes, semanasDe } from '@/lib/fechasCalendario';
import { P, usePuede } from '@/lib/permisos';
import { ETIQUETA_ESTADO_TAREA } from '@/tipos/tarea';
import type { Tarea } from '@/tipos/tarea';

/**
 * Cuántas tareas se muestran en la casilla antes de resumir el resto.
 *
 * Sin tope, un solo día con seis tareas estira toda la semana y deja los otros
 * seis días como huecos enormes. Con tope, las casillas quedan parejas y el
 * calendario se lee de un vistazo, que es para lo que sirve.
 *
 * El papel tiene su propia vista, con todas las tareas: `CalendarioImpreso`.
 */
const TAREAS_VISIBLES = 3;

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

  // Las rutinas de todos los días van en su propia pestaña: mezcladas con los
  // services y lo programado a mano, una tarea importante se perdía entre
  // diez «Purga». Se recuerda en la dirección (?vista=rutinas).
  const [params, setParams] = useSearchParams();
  const vista: 'tareas' | 'rutinas' = params.get('vista') === 'rutinas' ? 'rutinas' : 'tareas';
  const cambiarVista = (v: 'tareas' | 'rutinas') =>
    setParams(
      (actual) => {
        const nuevos = new URLSearchParams(actual);
        if (v === 'rutinas') nuevos.set('vista', 'rutinas');
        else nuevos.delete('vista');
        return nuevos;
      },
      { replace: true },
    );

  const [ancla, setAncla] = useState(() => new Date());
  const [soloMias, setSoloMias] = useState(false);
  const [tareaAbierta, setTareaAbierta] = useState<Tarea | null>(null);
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
  /** El día cuyo detalle se está mirando, con todas sus tareas. */
  const [diaDetalle, setDiaDetalle] = useState<string | null>(null);
  const [verRutinas, setVerRutinas] = useState(false);
  const [eligiendoImpresion, setEligiendoImpresion] = useState(false);
  /**
   * Lo que se está imprimiendo. La hoja de papel solo existe mientras tanto:
   * dibujada siempre, duplicaría cada tarea en la página.
   */
  const [impresion, setImpresion] = useState<{
    modo: ModoImpresion;
    soloPendientes: boolean;
    /** Elegido desde el botón: hay que abrir el diálogo de la impresora. */
    abrirDialogo: boolean;
  } | null>(null);

  const dias = useMemo(() => diasDelMes(ancla), [ancla]);
  const semanas = useMemo(() => semanasDe(dias), [dias]);

  // Ctrl+P sin pasar por el botón: sale el mes. Se dibuja en el acto
  // (flushSync), antes de que el navegador arme la hoja. Al terminar de
  // imprimir, por donde se haya entrado, la hoja de papel se va.
  useEffect(() => {
    const antes = () =>
      flushSync(() =>
        setImpresion(
          (actual) => actual ?? { modo: { tipo: 'mes' }, soloPendientes: false, abrirDialogo: false },
        ),
      );
    const despues = () => setImpresion(null);
    window.addEventListener('beforeprint', antes);
    window.addEventListener('afterprint', despues);
    return () => {
      window.removeEventListener('beforeprint', antes);
      window.removeEventListener('afterprint', despues);
    };
  }, []);

  // Elegido desde el botón: se espera a que React dibuje la hoja y recién ahí
  // se abre el diálogo de la impresora.
  useEffect(() => {
    if (!impresion?.abrirDialogo) return;
    const cuadro = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(cuadro);
  }, [impresion]);
  const desde = aIso(dias[0]);
  const hasta = aIso(dias[dias.length - 1]);

  const { data, isLoading, error } = useCalendario(
    desde,
    hasta,
    soloMias ? (yo?.id ?? undefined) : undefined,
  );
  const cancelar = useCancelarTarea();
  const { data: asignables } = useAsignables(puede(P.TAREAS_ASIGNAR));

  // El padron, solo para repartir los colores sin que se repitan. Quien no
  // puede listarlo igual ve colores: `colorDeTarea` cae al color por id.
  const { data: padron } = useUsuarios(1, 100, puede(P.USUARIOS_ADMINISTRAR));
  const colores = useMemo(
    () => coloresPorPersona(padron?.datos ?? []),
    [padron],
  );

  /** Las tareas de la pestaña abierta. Las cuentas de abajo usan solo estas. */
  const tareasDeLaVista = useMemo(
    () => (data?.tareas ?? []).filter((t) => esRutina(t) === (vista === 'rutinas')),
    [data, vista],
  );
  /** Cuántas pendientes hay en cada pestaña, para mostrarlo en la solapa. */
  const pendientesPorVista = useMemo(() => {
    const pend = (data?.tareas ?? []).filter((t) => t.estado === 'PENDIENTE');
    return {
      tareas: pend.filter((t) => !esRutina(t)).length,
      rutinas: pend.filter((t) => esRutina(t)).length,
    };
  }, [data]);

  /** Las tareas de cada día, para no recorrer la lista entera por casilla. */
  const porDia = useMemo(() => {
    const mapa = new Map<string, Tarea[]>();
    for (const t of tareasDeLaVista) {
      const clave = t.fecha.slice(0, 10);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(t);
    }
    return mapa;
  }, [tareasDeLaVista]);

  /** La referencia lleva solo a quien tenga algo este mes: si no, son nombres sueltos. */
  const personasConTareas = useMemo(() => {
    const nombres = new Map<string, string>();
    for (const t of tareasDeLaVista) {
      if (t.asignadoAId) nombres.set(t.asignadoAId, t.asignadoANombre ?? 'sin nombre');
    }
    return [...nombres.entries()]
      .map(([id, nombre]) => ({ id, nombre, color: colorDeTarea(id, colores).color }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [tareasDeLaVista, colores]);

  const hayHuerfanas = tareasDeLaVista.some((t) => !t.asignadoAId);

  const mover = (meses: number) => {
    const siguiente = new Date(ancla);
    siguiente.setMonth(ancla.getMonth() + meses);
    setAncla(siguiente);
  };

  const hoy = aIso(new Date());
  const pendientes = tareasDeLaVista.filter((t) => t.estado === 'PENDIENTE');
  const sinRepartir = pendientes.filter((t) => t.asignadoAId === null);

  return (
    <div className="pagina">
      <div className="cabecera-pagina no-imprimir">
        <div>
          <h1>Calendario</h1>
          <p className="texto-suave">
            {vista === 'rutinas'
              ? 'Lo que se repite todos los días, aparte para que no tape lo importante.'
              : 'Los services que vencen y lo que se programó a mano, cada cosa con su responsable.'}
          </p>
        </div>
        <div className="fila-acciones">
          {puede(P.TAREAS_EDITAR) && (
            <>
              {vista === 'rutinas' && (
                <button className="btn" onClick={() => setVerRutinas(true)}>
                  <Repeat className="icono" aria-hidden />
                  Administrar rutinas
                </button>
              )}
              <button className="btn btn-primario" onClick={() => setDiaElegido(hoy)}>
                <Plus className="icono" aria-hidden />
                Nueva tarea
              </button>
            </>
          )}
          <button className="btn" onClick={() => setEligiendoImpresion(true)}>
            <Printer className="icono" aria-hidden />
            Imprimir
          </button>
        </div>
      </div>

      <div className="solapas no-imprimir" role="tablist" aria-label="Qué ver en el calendario">
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'tareas'}
          className={`solapa ${vista === 'tareas' ? 'activa' : ''}`}
          onClick={() => cambiarVista('tareas')}
        >
          <Wrench className="icono" aria-hidden />
          Services y tareas
          {pendientesPorVista.tareas > 0 && (
            <span className="contador-pestana">{pendientesPorVista.tareas}</span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'rutinas'}
          className={`solapa ${vista === 'rutinas' ? 'activa' : ''}`}
          onClick={() => cambiarVista('rutinas')}
        >
          <Repeat className="icono" aria-hidden />
          Rutinas diarias
          {pendientesPorVista.rutinas > 0 && (
            <span className="contador-pestana">{pendientesPorVista.rutinas}</span>
          )}
        </button>
      </div>

      <div className="barra-calendario no-imprimir">
        <button className="btn btn-sm" onClick={() => mover(-1)}>
          <ChevronLeft className="icono" aria-hidden />
          Anterior
        </button>
        <strong>
          {MESES[ancla.getMonth()]} de {ancla.getFullYear()}
        </strong>
        <button className="btn btn-sm" onClick={() => mover(1)}>
          Siguiente
          <ChevronRight className="icono" aria-hidden />
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

      {personasConTareas.length > 0 && (
        <div className="calendario-referencias no-imprimir">
          {personasConTareas.map((p) => (
            <span className="calendario-referencia" key={p.id}>
              <span className="calendario-marca" style={{ background: p.color }} />
              {p.nombre}
            </span>
          ))}
          {hayHuerfanas && (
            <span className="calendario-referencia">
              <span className="calendario-marca calendario-marca-sin-asignar" />
              sin repartir
            </span>
          )}
        </div>
      )}

      {/* La pantalla. El papel tiene su propia vista, más abajo. */}
      <div className="calendario no-imprimir">
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
                tareas.length > 0 ? 'con-tareas' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              // Doble clic sobre la casilla abre el día entero. Es un atajo,
              // no el único camino: el "+N más" hace lo mismo y se ve, que es
              // lo que encuentra quien no sabe que el atajo existe.
              onDoubleClick={() => tareas.length > 0 && setDiaDetalle(iso)}
            >
              <div className="calendario-numero">
                <span>
                  {/* Solo se ve en la agenda del celular, donde los días van
                      uno debajo del otro y no hay encabezado de columnas. */}
                  <span className="calendario-dia-semana">{DIAS[(dia.getDay() + 6) % 7]}</span>
                  {dia.getDate()}
                </span>
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

              {tareas.slice(0, TAREAS_VISIBLES).map((t) => (
                <TareaEnCalendario
                  key={t.id}
                  tarea={t}
                  colores={colores}
                  onAbrir={() => setTareaAbierta(t)}
                />
              ))}

              {tareas.length > TAREAS_VISIBLES && (
                <button
                  className="calendario-mas no-imprimir"
                  onClick={() => setDiaDetalle(iso)}
                >
                  +{tareas.length - TAREAS_VISIBLES} más
                </button>
              )}

            </div>
          );
        })}
      </div>

      {impresion && (
        <CalendarioImpreso
          modo={impresion.modo}
          soloPendientes={impresion.soloPendientes}
          ancla={ancla}
          dias={dias}
          porDia={porDia}
          colores={colores}
          personas={personasConTareas}
        />
      )}

      {eligiendoImpresion && (
        <ElegirImpresion
          semanas={semanas}
          onCerrar={() => setEligiendoImpresion(false)}
          onImprimir={(modo, soloPendientes) => {
            setEligiendoImpresion(false);
            setImpresion({ modo, soloPendientes, abrirDialogo: true });
          }}
        />
      )}

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

      {diaDetalle && (
        <TareasDelDia
          fecha={diaDetalle}
          tareas={porDia.get(diaDetalle) ?? []}
          colores={colores}
          onAbrirTarea={(t) => {
            setDiaDetalle(null);
            setTareaAbierta(t);
          }}
          onCerrar={() => setDiaDetalle(null)}
        />
      )}

      {verRutinas && <RutinasDeTareas onCerrar={() => setVerRutinas(false)} />}
    </div>
  );
}

// ─────────────────────── Una tarea en el calendario ───────────────────────

/**
 * Una tarea en la casilla del día o en la ventana del día entero.
 *
 * Primero el equipo y abajo qué hay que hacerle: «Compresor 1» y debajo
 * «Purga · Facundo». Con el título arriba se leía «Purga, Purga, Purga…» y no
 * se sabía de qué máquina era cada una sin acercarse.
 */
function TareaEnCalendario({
  tarea: t,
  colores,
  onAbrir,
}: {
  tarea: Tarea;
  colores: Map<string, string>;
  onAbrir: () => void;
}) {
  const { color, sinAsignar } = colorDeTarea(t.asignadoAId, colores);
  const { principal, secundario } = encabezadoTarea(t);
  return (
    <button
      className={[
        'calendario-tarea',
        `estado-${t.estado.toLowerCase()}`,
        sinAsignar ? 'sin-asignar' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ borderLeftColor: color }}
      onClick={onAbrir}
    >
      <span className="calendario-tarea-titulo">{principal}</span>
      <span className="texto-suave texto-chico">
        {secundario && (
          <>
            <span className="calendario-tarea-que">{secundario}</span>
            {' · '}
          </>
        )}
        {t.asignadoANombre ?? 'sin repartir'}
      </span>
    </button>
  );
}

// ─────────────────────── Detalle de una tarea ───────────────────────

/**
 * Todas las tareas de un día.
 *
 * La casilla del calendario muestra las primeras y resume el resto: acá están
 * todas, con lugar para leerlas. Se abre con doble clic en el día o desde el
 * "+N más".
 */
function TareasDelDia({
  fecha,
  tareas,
  colores,
  onAbrirTarea,
  onCerrar,
}: {
  fecha: string;
  tareas: Tarea[];
  colores: Map<string, string>;
  onAbrirTarea: (t: Tarea) => void;
  onCerrar: () => void;
}) {
  const dia = new Date(`${fecha}T00:00:00`);
  const pendientes = tareas.filter((t) => t.estado === 'PENDIENTE').length;

  return (
    <Modal
      titulo={`${dia.getDate()} de ${MESES[dia.getMonth()]} de ${dia.getFullYear()}`}
      abierto
      onCerrar={onCerrar}
    >
      <div className="formulario-modal">
        <p className="texto-suave texto-chico">
          {tareas.length === 1 ? 'Una tarea' : `${tareas.length} tareas`}
          {pendientes > 0 && `, ${pendientes} sin hacer`}.
        </p>

        <div className="lista-tareas-dia">
          {tareas.map((t) => (
            <TareaEnCalendario
              key={t.id}
              tarea={t}
              colores={colores}
              onAbrir={() => onAbrirTarea(t)}
            />
          ))}
        </div>

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}

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
  const [postergando, setPostergando] = useState(false);
  const cancelar = useCancelarTarea();
  const asignar = useAsignarTarea();
  const [nuevoDuenio, setNuevoDuenio] = useState('');

  // La suya, o una que no es de nadie. La de otro se ve y no se toca.
  const esMia = !!yo && (tarea.asignadoAId === null || tarea.asignadoAId === yo.id);
  const sePuedeHacer = tarea.estado === 'PENDIENTE' && puede(P.TAREAS_EDITAR) && esMia;

  if (completando) {
    return <CompletarTarea tarea={tarea} onCerrar={onCerrar} />;
  }
  if (postergando) {
    return <PostergarTarea tarea={tarea} onCerrar={onCerrar} />;
  }
  // Lo vencido no se posterga: se hace.
  const sePuedePostergar =
    tarea.estado === 'PENDIENTE' && puede(P.TAREAS_EDITAR) && !vencio(tarea.fecha);

  return (
    <Modal titulo={tarea.titulo} abierto onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p className="texto-suave">
          {new Date(tarea.fecha).toLocaleDateString('es-AR', { timeZone: 'UTC' })} ·{' '}
          {ETIQUETA_ESTADO_TAREA[tarea.estado]}
          {tarea.equipoNombre ? ` · ${tarea.equipoNombre}` : ''}
          {tarea.equipoItNombre ? ` · ${tarea.equipoItNombre}` : ''}
        </p>

        {tarea.descripcion && <p>{tarea.descripcion}</p>}

        {(tarea.postergaciones ?? []).length > 0 && (
          <ul className="lista-postergaciones texto-chico">
            {(tarea.postergaciones ?? []).map((p, i) => (
              <li key={i}>
                Postergada del {formatearFechaSola(p.desde)} al {formatearFechaSola(p.hasta)}
                {p.usuarioNombre ? ` por ${p.usuarioNombre}` : ''}: {p.motivo}
              </li>
            ))}
          </ul>
        )}

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
          {sePuedePostergar && (
            <button type="button" className="btn" onClick={() => setPostergando(true)}>
              Postergar
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
