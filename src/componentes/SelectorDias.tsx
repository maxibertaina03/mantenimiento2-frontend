import { useId } from 'react';
import { LUNES_A_VIERNES, ORDEN_SEMANA, TODOS_LOS_DIAS, describirDias } from '@/lib/diasDeTrabajo';

const LETRA: Record<number, string> = { 1: 'L', 2: 'M', 3: 'M', 4: 'J', 5: 'V', 6: 'S', 0: 'D' };
const NOMBRE: Record<number, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
  0: 'domingo',
};

/**
 * Qué días de la semana se trabaja: L M M J V S D.
 *
 * La planta no trabaja sábados ni domingos, y una tarea diaria tiene que
 * saltarlos. Cada plan y cada rutina dice los suyos; por defecto, de lunes a
 * viernes.
 */
export function SelectorDias({
  dias,
  onCambio,
}: {
  dias: number[];
  onCambio: (dias: number[]) => void;
}) {
  const id = useId();
  const alternar = (d: number) => {
    const nuevo = dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d];
    // Nunca vacío: un plan que no se hace ningún día no tiene sentido.
    if (nuevo.length > 0) onCambio([...nuevo].sort((a, b) => a - b));
  };
  const igual = (a: readonly number[]) =>
    a.length === dias.length && a.every((d) => dias.includes(d));

  return (
    <div className="selector-dias" role="group" aria-labelledby={id}>
      <span id={id} className="selector-dias-titulo">
        ¿Qué días se hace?
      </span>
      <div className="selector-dias-fila">
        {ORDEN_SEMANA.map((d) => (
          <button
            key={d}
            type="button"
            className={dias.includes(d) ? 'dia-semana activo' : 'dia-semana'}
            aria-pressed={dias.includes(d)}
            aria-label={NOMBRE[d]}
            title={NOMBRE[d]}
            onClick={() => alternar(d)}
          >
            {LETRA[d]}
          </button>
        ))}
        <span className="selector-dias-atajos">
          <button
            type="button"
            className={igual(LUNES_A_VIERNES) ? 'btn btn-chico btn-primario' : 'btn btn-chico'}
            onClick={() => onCambio([...LUNES_A_VIERNES])}
          >
            Lunes a viernes
          </button>
          <button
            type="button"
            className={igual(TODOS_LOS_DIAS) ? 'btn btn-chico btn-primario' : 'btn btn-chico'}
            onClick={() => onCambio([...TODOS_LOS_DIAS])}
          >
            Todos
          </button>
        </span>
      </div>
      <span className="texto-suave texto-chico">
        {describirDias(dias)}. Si toca un día que no está marcado, pasa al siguiente que sí.
      </span>
    </div>
  );
}
