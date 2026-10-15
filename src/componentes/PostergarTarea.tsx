import { useState } from 'react';
import { usePostergarTarea } from '@/api/calendario';
import { formatearFechaSola } from '@/lib/formato';
import type { Tarea } from '@/tipos/tarea';
import { MensajeError } from './Estados';
import { Modal } from './Modal';

/** El día siguiente, como `AAAA-MM-DD`. */
function diaSiguiente(fechaIso: string): string {
  const d = new Date(`${fechaIso.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Postergar una tarea que todavía no venció: «la vamos a hacer, pero unos días
 * más tarde». Se elige el día y se cuenta por qué; queda registrado.
 *
 * Los límites los pone el servidor y los explica si se pasa: no puede pasar de
 * la vez siguiente que toca esa misma tarea. Si es de un plan, el service se
 * mueve con ella, y si cae un día que no se trabaja pasa al siguiente.
 */
export function PostergarTarea({ tarea, onCerrar }: { tarea: Tarea; onCerrar: () => void }) {
  const postergar = usePostergarTarea();
  const minimo = diaSiguiente(tarea.fecha);
  const [fecha, setFecha] = useState(minimo);
  const [motivo, setMotivo] = useState('');

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await postergar.mutateAsync({ id: tarea.id, fecha, motivo: motivo.trim() });
      onCerrar();
    } catch {
      // El rechazo se muestra abajo, con el límite que corresponde.
    }
  };

  return (
    <Modal titulo={`Postergar · ${tarea.titulo}`} abierto onCerrar={onCerrar}>
      <form className="formulario-modal" onSubmit={confirmar}>
        <p className="texto-suave">
          Tocaba el <strong>{formatearFechaSola(tarea.fecha)}</strong>
          {tarea.fechaOriginal && ` (al principio, el ${formatearFechaSola(tarea.fechaOriginal)})`}
          {tarea.equipoNombre ? ` · ${tarea.equipoNombre}` : ''}.
        </p>

        <div className="grilla-2">
          <label className="campo">
            ¿Para qué día? *
            <input
              type="date"
              value={fecha}
              min={minimo}
              required
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          <label className="campo">
            ¿Por qué? *
            <input
              value={motivo}
              maxLength={300}
              required
              placeholder="Ej: falta el repuesto, se para la línea el jueves"
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
        </div>

        <p className="texto-suave texto-chico">
          {tarea.planId
            ? 'Es de un plan de mantenimiento: el service se corre a ese día y no figura vencido. '
            : ''}
          Se puede postergar hasta antes de la vez siguiente que toca. Queda registrado quién la
          postergó y por qué.
        </p>

        {postergar.error && <MensajeError error={postergar.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primario"
            disabled={postergar.isPending || motivo.trim().length < 3 || fecha < minimo}
          >
            {postergar.isPending ? 'Postergando…' : 'Postergar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
