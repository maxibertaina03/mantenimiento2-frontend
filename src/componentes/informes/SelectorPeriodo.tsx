import { AGRUPACIONES, ATAJOS, periodoDeAtajo, type AtajoPeriodo } from '@/lib/periodoInforme';
import type { Agrupar, PeriodoInforme } from '@/tipos/informe';

/**
 * Qué período mirar: un atajo de un toque o dos fechas, y de a cuánto agrupar.
 * El atajo trae su agrupación lógica (un año, por mes), que se puede cambiar.
 */
export function SelectorPeriodo({
  atajo,
  periodo,
  onCambio,
}: {
  atajo: AtajoPeriodo;
  periodo: PeriodoInforme;
  onCambio: (atajo: AtajoPeriodo, periodo: PeriodoInforme) => void;
}) {
  const elegirAtajo = (nuevo: AtajoPeriodo) =>
    onCambio(nuevo, nuevo === 'elegir' ? periodo : periodoDeAtajo(nuevo));

  return (
    <div className="selector-periodo no-imprimir">
      <div className="selector-periodo-atajos" role="group" aria-label="Período">
        {ATAJOS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`chip-periodo${atajo === a.id ? ' activo' : ''}`}
            aria-pressed={atajo === a.id}
            onClick={() => elegirAtajo(a.id)}
          >
            {a.texto}
          </button>
        ))}
      </div>
      <div className="selector-periodo-campos">
        {atajo === 'elegir' && (
          <>
            <label className="campo-chico">
              Desde
              <input
                type="date"
                value={periodo.desde}
                max={periodo.hasta}
                onChange={(e) => {
                  if (e.target.value) onCambio('elegir', { ...periodo, desde: e.target.value });
                }}
              />
            </label>
            <label className="campo-chico">
              Hasta
              <input
                type="date"
                value={periodo.hasta}
                min={periodo.desde}
                onChange={(e) => {
                  if (e.target.value) onCambio('elegir', { ...periodo, hasta: e.target.value });
                }}
              />
            </label>
          </>
        )}
        <label className="campo-chico">
          Agrupar
          <select
            value={periodo.agrupar}
            onChange={(e) => onCambio(atajo, { ...periodo, agrupar: e.target.value as Agrupar })}
          >
            {AGRUPACIONES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.texto}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
