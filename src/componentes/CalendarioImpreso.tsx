import { colorDeTarea } from '@/lib/coloresUsuario';
import { DIAS, MESES, aIso, semanasDe, textoDia, textoSemana } from '@/lib/fechasCalendario';
import type { Tarea } from '@/tipos/tarea';

export type ModoImpresion = { tipo: 'semana'; semana: number } | { tipo: 'mes' };

export interface PersonaReferencia {
  id: string;
  nombre: string;
  color: string;
}

/**
 * Las tareas de un día, juntas por título, en el orden en que aparecen.
 *
 * Los días cargados son casi siempre la misma tarea en muchas máquinas: ocho
 * «Purga». En el papel van una vez, con un renglón corto por máquina, y entran
 * en la hoja en vez de pasar a otra.
 */
export function agruparPorTitulo(tareas: Tarea[]): { titulo: string; tareas: Tarea[] }[] {
  const grupos = new Map<string, Tarea[]>();
  for (const t of tareas) grupos.set(t.titulo, [...(grupos.get(t.titulo) ?? []), t]);
  return [...grupos].map(([titulo, delGrupo]) => ({ titulo, tareas: delGrupo }));
}

/** Cuántos títulos entran en una casilla del resumen del mes. */
const TITULOS_EN_EL_RESUMEN = 2;

/**
 * El calendario en papel. Solo se ve al imprimir.
 *
 * La grilla de la pantalla en papel no servía: un día con muchas purgas
 * estiraba su semana, y el mes salía en cuatro hojas desparejas, con semanas
 * cortadas entre una hoja y otra. Acá hay dos hojas pensadas para el papel:
 *
 * - **Semana**: los siete días en una hoja apaisada, con todas las tareas y una
 *   casilla para tildar a mano. Es la hoja del taller.
 * - **Mes**: el mes resumido en una hoja, y después la lista día por día.
 *
 * Las canceladas no salen: en el papel solo confunden. Las hechas salen
 * tachadas, salvo que se pida solo lo que falta.
 */
export function CalendarioImpreso({
  modo,
  ancla,
  dias,
  porDia,
  colores,
  personas,
  soloPendientes,
  hoy = new Date(),
}: {
  modo: ModoImpresion;
  ancla: Date;
  dias: Date[];
  porDia: Map<string, Tarea[]>;
  colores: Map<string, string>;
  personas: PersonaReferencia[];
  soloPendientes: boolean;
  /** Para la fecha de impresión; se pasa en los tests. */
  hoy?: Date;
}) {
  const tareasDe = (dia: Date) =>
    (porDia.get(aIso(dia)) ?? []).filter((t) =>
      soloPendientes ? t.estado === 'PENDIENTE' : t.estado !== 'CANCELADA',
    );

  const pie = (
    <p className="impreso-pie">
      Impreso el {hoy.toLocaleDateString('es-AR')}
      {soloPendientes ? ' · solo lo que falta hacer' : ''}
    </p>
  );

  const referencias = personas.length > 0 && (
    <div className="impreso-referencias">
      {personas.map((p) => (
        <span key={p.id} className="impreso-referencia">
          <span className="impreso-marca" style={{ background: p.color }} />
          {p.nombre}
        </span>
      ))}
      <span className="impreso-referencia">
        <span className="impreso-marca impreso-marca-sin-asignar" />
        sin repartir
      </span>
    </div>
  );

  const renglon = (t: Tarea) => {
    const { color, sinAsignar } = colorDeTarea(t.asignadoAId, colores);
    const hecha = t.estado === 'HECHA';
    const donde = t.equipoNombre ?? t.equipoItNombre;
    return (
      <li
        key={t.id}
        className={[
          'impreso-tarea',
          hecha ? 'impreso-hecha' : '',
          sinAsignar ? 'impreso-sin-asignar' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ borderLeftColor: color }}
      >
        <span className="impreso-casilla" aria-hidden="true">
          {hecha ? '☑' : '☐'}
        </span>
        <span className="impreso-tarea-texto">
          <strong>{t.titulo}</strong>
          <span className="impreso-tarea-datos">
            {[donde, t.asignadoANombre ?? 'sin repartir'].filter(Boolean).join(' · ')}
          </span>
        </span>
      </li>
    );
  };

  /** Un renglón corto, dentro de un grupo: el título ya está arriba. */
  const subrenglon = (t: Tarea) => {
    const { color, sinAsignar } = colorDeTarea(t.asignadoAId, colores);
    const hecha = t.estado === 'HECHA';
    return (
      <li
        key={t.id}
        className={[
          'impreso-tarea',
          'impreso-sub',
          hecha ? 'impreso-hecha' : '',
          sinAsignar ? 'impreso-sin-asignar' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ borderLeftColor: color }}
      >
        <span className="impreso-casilla" aria-hidden="true">
          {hecha ? '☑' : '☐'}
        </span>
        <span className="impreso-tarea-datos">
          {[t.equipoNombre ?? t.equipoItNombre, t.asignadoANombre ?? 'sin repartir']
            .filter(Boolean)
            .join(' · ')}
        </span>
      </li>
    );
  };

  const lista = (tareas: Tarea[]) => (
    <ul className="impreso-lista">
      {agruparPorTitulo(tareas).map((g) =>
        g.tareas.length === 1 ? (
          renglon(g.tareas[0])
        ) : (
          <li key={g.titulo} className="impreso-grupo">
            <span className="impreso-grupo-titulo">
              <strong>{g.titulo}</strong>
              <span className="impreso-cantidad">{g.tareas.length}</span>
            </span>
            <ul className="impreso-lista impreso-sublista">{g.tareas.map(subrenglon)}</ul>
          </li>
        ),
      )}
    </ul>
  );

  if (modo.tipo === 'semana') {
    const semana = semanasDe(dias)[modo.semana] ?? semanasDe(dias)[0];
    return (
      <section className="solo-imprimir impreso impreso-semana" aria-label="Calendario impreso">
        <h2 className="impreso-titulo">
          Semana {textoSemana(semana)} de {semana[6].getFullYear()}
        </h2>
        {referencias}
        <div className="impreso-semana-grilla">
          {semana.map((dia, i) => {
            const tareas = tareasDe(dia);
            return (
              <div key={aIso(dia)} className="impreso-dia">
                <div className="impreso-dia-cabecera">
                  {DIAS[i]} {dia.getDate()}
                  {tareas.length > 0 && <span className="impreso-cantidad">{tareas.length}</span>}
                </div>
                {lista(tareas)}
              </div>
            );
          })}
        </div>
        {pie}
      </section>
    );
  }

  const diasConTareas = dias
    .filter((d) => d.getMonth() === ancla.getMonth())
    .map((d) => ({ dia: d, tareas: tareasDe(d) }))
    .filter((x) => x.tareas.length > 0);

  return (
    <section className="solo-imprimir impreso impreso-mes" aria-label="Calendario impreso">
      <div className="impreso-hoja">
        <h2 className="impreso-titulo">
          Tareas de {MESES[ancla.getMonth()]} de {ancla.getFullYear()}
        </h2>
        {referencias}
        <div className="impreso-mes-grilla">
          {DIAS.map((d) => (
            <div key={d} className="impreso-mes-cabecera">
              {d}
            </div>
          ))}
          {dias.map((dia) => {
            const delMes = dia.getMonth() === ancla.getMonth();
            const tareas = delMes ? tareasDe(dia) : [];
            return (
              <div
                key={aIso(dia)}
                className={delMes ? 'impreso-mes-dia' : 'impreso-mes-dia impreso-otro-mes'}
              >
                <div className="impreso-mes-numero">
                  {dia.getDate()}
                  {tareas.length > 0 && (
                    <span className="impreso-cantidad">
                      {tareas.length === 1 ? '1 tarea' : `${tareas.length} tareas`}
                    </span>
                  )}
                </div>
                {tareas.slice(0, TITULOS_EN_EL_RESUMEN).map((t) => (
                  <div
                    key={t.id}
                    className={
                      t.estado === 'HECHA'
                        ? 'impreso-mes-titulo impreso-hecha'
                        : 'impreso-mes-titulo'
                    }
                    style={{ borderLeftColor: colorDeTarea(t.asignadoAId, colores).color }}
                  >
                    {t.titulo}
                  </div>
                ))}
                {tareas.length > TITULOS_EN_EL_RESUMEN && (
                  <div className="impreso-mes-mas">
                    +{tareas.length - TITULOS_EN_EL_RESUMEN} más
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {pie}
      </div>

      {diasConTareas.length > 0 && (
        <div className="impreso-hoja impreso-por-dia">
          <h2 className="impreso-titulo">
            Día por día · {MESES[ancla.getMonth()]} de {ancla.getFullYear()}
          </h2>
          <div className="impreso-por-dia-columnas">
            {diasConTareas.map(({ dia, tareas }) => (
              <div key={aIso(dia)} className="impreso-por-dia-bloque">
                <h3 className="impreso-por-dia-titulo">
                  {textoDia(dia)}
                  <span className="impreso-cantidad">{tareas.length}</span>
                </h3>
                {lista(tareas)}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
