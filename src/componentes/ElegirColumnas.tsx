import { FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';
import {
  armarTabla,
  clavesPorDefecto,
  guardarElegidas,
  leerElegidas,
  type ColumnaReporte,
} from '@/lib/columnasReporte';
import { Modal } from './Modal';

export type FormatoExportacion = 'pdf' | 'csv';

/** Cuántas filas muestra la vista previa: alcanza para ver cómo queda. */
const FILAS_DE_MUESTRA = 15;

/**
 * Antes de bajar un reporte, qué columnas lleva, y cómo queda.
 *
 * A la izquierda, las columnas; a la derecha, la vista previa con las primeras
 * filas de verdad, que cambia al tildar o destildar. Viene marcado lo que se
 * eligió la última vez, así que quien siempre baja lo mismo toca «PDF» y
 * listo. Las columnas salen en el orden del reporte, no en el que se tildaron.
 */
export function ElegirColumnas<T>({
  titulo,
  reporte,
  columnas,
  muestra = [],
  totalFilas,
  orientacion,
  formatos = ['pdf', 'csv'],
  exportando = false,
  onExportar,
  onCerrar,
}: {
  titulo: string;
  /** Con qué nombre se recuerda la elección. */
  reporte: string;
  columnas: ColumnaReporte<T>[];
  /** Filas para la vista previa (se muestran las primeras). Sin filas, no hay vista previa. */
  muestra?: T[];
  /** Cuántas filas va a tener el reporte entero, si se sabe. */
  totalFilas?: number;
  /** Cómo sale la hoja según cuántas columnas haya. Por defecto, apaisada desde 5. */
  orientacion?: (columnas: number) => 'vertical' | 'apaisada';
  formatos?: FormatoExportacion[];
  exportando?: boolean;
  onExportar: (formato: FormatoExportacion, elegidas: string[]) => void;
  onCerrar: () => void;
}) {
  const [elegidas, setElegidas] = useState(() => leerElegidas(reporte, columnas));

  const alternar = (clave: string) =>
    setElegidas((actual) =>
      actual.includes(clave) ? actual.filter((c) => c !== clave) : [...actual, clave],
    );

  const exportar = (formato: FormatoExportacion) => {
    guardarElegidas(reporte, elegidas);
    onExportar(formato, elegidas);
  };

  const ninguna = elegidas.length === 0;
  const conPrevia = muestra.length > 0;
  const previa = armarTabla(columnas, muestra.slice(0, FILAS_DE_MUESTRA), elegidas);
  const hoja = (orientacion ?? ((n) => (n > 4 ? 'apaisada' : 'vertical')))(
    previa.encabezados.length,
  );

  const eleccion = (
    <div className="elegir-columnas-lado">
      <fieldset className="elegir-columnas">
        <legend className="texto-suave texto-chico">¿Qué columnas querés que tenga?</legend>
        {columnas.map((c) => (
          <label key={c.clave} className="elegir-columnas-opcion">
            <input
              type="checkbox"
              checked={elegidas.includes(c.clave)}
              onChange={() => alternar(c.clave)}
            />
            {c.titulo}
          </label>
        ))}
      </fieldset>
      <div className="fila-acciones">
        <button
          type="button"
          className="btn btn-fantasma btn-sm"
          onClick={() => setElegidas(columnas.map((c) => c.clave))}
        >
          Todas
        </button>
        <button
          type="button"
          className="btn btn-fantasma btn-sm"
          onClick={() => setElegidas(clavesPorDefecto(columnas))}
        >
          Las de siempre
        </button>
      </div>
      {ninguna && <p className="texto-suave texto-chico">Elegí al menos una columna.</p>}
    </div>
  );

  return (
    <Modal
      titulo={titulo}
      abierto
      onCerrar={onCerrar}
      avisarSiHayCambios={false}
      tamano={conPrevia ? 'completo' : 'normal'}
    >
      <div className={`formulario-modal${conPrevia ? ' exportar-completo' : ''}`}>
        {conPrevia ? (
          <div className="exportar-con-previa">
            {eleccion}
            <section className="vista-previa-reporte" aria-label="Vista previa del reporte">
              <div className="vista-previa-cabecera">
                <strong>Vista previa</strong>
                <span className="texto-suave texto-chico">
                  {ninguna
                    ? 'sin columnas'
                    : `${previa.encabezados.length} ${previa.encabezados.length === 1 ? 'columna' : 'columnas'} · hoja ${hoja}`}
                  {totalFilas !== undefined && ` · ${totalFilas} filas en total`}
                </span>
              </div>
              <div className={`vista-previa-hoja ${hoja}`}>
                {ninguna ? (
                  <p className="texto-suave texto-chico vista-previa-vacia">
                    Tildá columnas a la izquierda para ver cómo queda.
                  </p>
                ) : (
                  <table className="vista-previa-tabla">
                    <thead>
                      <tr>
                        {previa.encabezados.map((e) => (
                          <th key={e}>{e}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previa.filas.map((fila, i) => (
                        <tr key={i}>
                          {fila.map((valor, j) => (
                            <td key={j}>{valor}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {muestra.length > FILAS_DE_MUESTRA && (
                <p className="texto-suave texto-chico">
                  Se muestran las primeras {FILAS_DE_MUESTRA} filas.
                </p>
              )}
            </section>
          </div>
        ) : (
          eleccion
        )}

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          {formatos.includes('csv') && (
            <button
              type="button"
              className="btn"
              disabled={ninguna || exportando}
              onClick={() => exportar('csv')}
            >
              <FileSpreadsheet className="icono" aria-hidden />
              Planilla (CSV)
            </button>
          )}
          {formatos.includes('pdf') && (
            <button
              type="button"
              className="btn btn-primario"
              disabled={ninguna || exportando}
              onClick={() => exportar('pdf')}
            >
              <FileText className="icono" aria-hidden />
              {exportando ? 'Preparando…' : 'PDF'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
