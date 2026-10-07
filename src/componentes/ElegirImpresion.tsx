import { useState } from 'react';
import { semanaInicial, textoSemana } from '@/lib/fechasCalendario';
import type { ModoImpresion } from './CalendarioImpreso';
import { Modal } from './Modal';

/**
 * Qué imprimir del calendario: una semana, para el taller, o el mes entero.
 *
 * Solo ofrece las semanas del mes que se está mirando: son las que ya están
 * cargadas, así que imprimir no espera a nadie.
 */
export function ElegirImpresion({
  semanas,
  hoy = new Date(),
  onImprimir,
  onCerrar,
}: {
  semanas: Date[][];
  hoy?: Date;
  onImprimir: (modo: ModoImpresion, soloPendientes: boolean) => void;
  onCerrar: () => void;
}) {
  const [tipo, setTipo] = useState<'semana' | 'mes'>('semana');
  const [semana, setSemana] = useState(() => semanaInicial(semanas, hoy));
  const [soloPendientes, setSoloPendientes] = useState(false);

  return (
    <Modal titulo="Imprimir el calendario" abierto onCerrar={onCerrar}>
      <form
        className="formulario-modal"
        onSubmit={(e) => {
          e.preventDefault();
          onImprimir(tipo === 'mes' ? { tipo: 'mes' } : { tipo: 'semana', semana }, soloPendientes);
        }}
      >
        <fieldset className="elegir-impresion">
          <legend className="texto-suave texto-chico">¿Qué querés imprimir?</legend>

          <label className="elegir-impresion-opcion">
            <input
              type="radio"
              name="tipo-impresion"
              checked={tipo === 'semana'}
              onChange={() => setTipo('semana')}
            />
            <span>
              <strong>Una semana</strong>
              <span className="texto-suave texto-chico">
                {' '}
                · una hoja, con todas las tareas y una casilla para tildar
              </span>
            </span>
          </label>
          {tipo === 'semana' && (
            <select
              aria-label="Semana"
              className="elegir-impresion-semana"
              value={semana}
              onChange={(e) => setSemana(Number(e.target.value))}
            >
              {semanas.map((s, i) => (
                <option key={i} value={i}>
                  Semana {textoSemana(s)}
                </option>
              ))}
            </select>
          )}

          <label className="elegir-impresion-opcion">
            <input
              type="radio"
              name="tipo-impresion"
              checked={tipo === 'mes'}
              onChange={() => setTipo('mes')}
            />
            <span>
              <strong>El mes entero</strong>
              <span className="texto-suave texto-chico">
                {' '}
                · el mes resumido en una hoja, y después la lista día por día
              </span>
            </span>
          </label>
        </fieldset>

        <label className="elegir-impresion-opcion">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
          />
          Solo lo que falta hacer (sin las ya hechas)
        </label>

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario">
            🖨 Imprimir
          </button>
        </div>
      </form>
    </Modal>
  );
}
