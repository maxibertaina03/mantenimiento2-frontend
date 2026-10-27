import { Check, ChevronRight, CircleCheck, Clock, PencilLine } from 'lucide-react';
import { useState } from 'react';
import { useCompletarTarea } from '@/api/calendario';
import { vencio } from '@/lib/diaDeTarea';
import { encabezadoTarea } from '@/lib/tareas';
import type { Tarea } from '@/tipos/tarea';
import { CompletarTarea } from './CompletarTarea';
import { MensajeError } from './Estados';
import { Modal } from './Modal';
import { PostergarTarea } from './PostergarTarea';

/** Lo que dice la orden de trabajo de una tarea cerrada con el atajo. */
export const SIN_NOVEDAD = 'Sin novedad';

/** «hoy», o el día corto: «14 oct». */
function cuando(iso: string): string {
  const fecha = new Date(iso);
  const hoy = new Date();
  const esHoy =
    fecha.getUTCFullYear() === hoy.getFullYear() &&
    fecha.getUTCMonth() === hoy.getMonth() &&
    fecha.getUTCDate() === hoy.getDate();
  if (esHoy) return 'hoy';
  return fecha
    .toLocaleDateString('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'short' })
    .replace('.', '');
}

/**
 * Hacer las tareas de corrido, desde el celular: dos toques por tarea.
 *
 * Se abre sobre una tarea y muestra en grande la máquina y qué hay que hacer.
 * «Hecha, sin novedad» la cierra al instante (su orden de trabajo dice «Sin
 * novedad»); si hubo algo —se usaron materiales, apareció un problema— «Hubo
 * algo» abre el formulario completo. Al cerrarla aparece la siguiente
 * pendiente, para hacer la recorrida sin volver a la lista.
 *
 * Antes, cada purga diaria obligaba a abrir el formulario y escribir qué se
 * hizo, aunque fuera siempre «sin novedad».
 */
export function HacerTareas({
  tareas,
  inicialId,
  onCerrar,
}: {
  /** Las pendientes, en el orden en que se recorren. Con una sola, no hay «siguiente». */
  tareas: Tarea[];
  inicialId: string;
  onCerrar: () => void;
}) {
  // Una foto de la lista al abrir: mientras se recorre, la de la pantalla se
  // va actualizando y no tiene que mover el orden de la recorrida.
  const [cola] = useState(tareas);
  const [actualId, setActualId] = useState<string | null>(inicialId);
  const [resueltas, setResueltas] = useState<Set<string>>(new Set());
  const [ultimaHecha, setUltimaHecha] = useState<Tarea | null>(null);
  const [vista, setVista] = useState<'hoja' | 'completo' | 'postergar'>('hoja');
  const completar = useCompletarTarea();

  const actual = cola.find((t) => t.id === actualId) ?? null;
  const posicion = actual ? cola.indexOf(actual) : -1;
  const pendientes = cola.filter((t) => !resueltas.has(t.id));

  /** La siguiente sin resolver después de la actual, dando la vuelta si hace falta. */
  const siguienteDe = (id: string, yaResueltas: Set<string>): Tarea | null => {
    const desde = cola.findIndex((t) => t.id === id);
    for (let i = 1; i <= cola.length; i++) {
      const t = cola[(desde + i) % cola.length];
      if (!yaResueltas.has(t.id) && t.id !== id) return t;
    }
    return null;
  };

  /** Queda resuelta (hecha o postergada) y se pasa a la siguiente. */
  const avanzar = (resuelta: Tarea, hecha: boolean) => {
    const nuevas = new Set(resueltas).add(resuelta.id);
    setResueltas(nuevas);
    if (hecha) setUltimaHecha(resuelta);
    setVista('hoja');
    // Con una sola tarea (desde el calendario o servicios), al terminarla se cierra.
    if (cola.length === 1) {
      onCerrar();
      return;
    }
    setActualId(siguienteDe(resuelta.id, nuevas)?.id ?? null);
  };

  const sinNovedad = () => {
    if (!actual) return;
    completar.mutate(
      { id: actual.id, resolucion: SIN_NOVEDAD },
      { onSuccess: () => avanzar(actual, true) },
    );
  };

  /** Saltear: dejarla para después de la recorrida, sin tocarla. */
  const saltear = () => {
    if (!actual) return;
    setUltimaHecha(null);
    setActualId(siguienteDe(actual.id, resueltas)?.id ?? actual.id);
  };

  if (actual && vista === 'completo') {
    return (
      <CompletarTarea
        tarea={actual}
        onHecha={() => avanzar(actual, true)}
        onCerrar={() => setVista('hoja')}
      />
    );
  }
  if (actual && vista === 'postergar') {
    return (
      <PostergarTarea
        tarea={actual}
        onPostergada={() => avanzar(actual, false)}
        onCerrar={() => setVista('hoja')}
      />
    );
  }

  const listo = ultimaHecha && (
    <p className="hoja-tarea-listo" role="status">
      <CircleCheck className="icono" aria-hidden />
      Listo: {encabezadoTarea(ultimaHecha).principal} quedó hecha.
    </p>
  );

  if (!actual) {
    return (
      <Modal titulo="Recorrida terminada" abierto onCerrar={onCerrar}>
        <div className="hoja-tarea">
          {listo}
          <p className="hoja-tarea-fin">No quedan tareas pendientes.</p>
          <div className="hoja-tarea-botones">
            <button type="button" className="btn btn-primario btn-grande" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const { principal, secundario } = encabezadoTarea(actual);
  const vencida = vencio(actual.fecha);
  const titulo = cola.length > 1 ? `Tarea ${posicion + 1} de ${cola.length}` : 'Dar por hecha';

  return (
    <Modal titulo={titulo} abierto onCerrar={onCerrar}>
      <div className="hoja-tarea">
        {listo}

        <div className="hoja-tarea-que">
          <strong className="hoja-tarea-principal">{principal}</strong>
          {secundario && <span className="hoja-tarea-secundario">{secundario}</span>}
          <span className="hoja-tarea-datos">
            <span className={vencida ? 'badge badge-error' : 'badge'}>
              {vencida ? `Vencida · era ${cuando(actual.fecha)}` : `Para ${cuando(actual.fecha)}`}
            </span>
            {actual.asignadoANombre && (
              <span className="texto-suave texto-chico">{actual.asignadoANombre}</span>
            )}
          </span>
          {actual.descripcion && actual.descripcion !== secundario && (
            <span className="texto-suave">{actual.descripcion}</span>
          )}
        </div>

        {completar.error && <MensajeError error={completar.error} />}

        <div className="hoja-tarea-botones">
          <button
            type="button"
            className="btn btn-primario btn-grande"
            disabled={completar.isPending}
            onClick={sinNovedad}
          >
            <Check className="icono" aria-hidden />
            {completar.isPending ? 'Guardando…' : 'Hecha, sin novedad'}
          </button>
          <button
            type="button"
            className="btn btn-grande"
            disabled={completar.isPending}
            onClick={() => setVista('completo')}
          >
            <PencilLine className="icono" aria-hidden />
            Hubo algo / usé materiales
          </button>
          <div className="hoja-tarea-secundarios">
            {/* Lo vencido no se posterga: se hace. */}
            {!vencida && (
              <button
                type="button"
                className="btn btn-fantasma"
                disabled={completar.isPending}
                onClick={() => setVista('postergar')}
              >
                <Clock className="icono" aria-hidden />
                Postergar
              </button>
            )}
            {pendientes.length > 1 && (
              <button
                type="button"
                className="btn btn-fantasma"
                disabled={completar.isPending}
                onClick={saltear}
              >
                Saltear
                <ChevronRight className="icono" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
