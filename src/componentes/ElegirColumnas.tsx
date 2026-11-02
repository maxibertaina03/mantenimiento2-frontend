import { FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';
import {
  clavesPorDefecto,
  guardarElegidas,
  leerElegidas,
  type ColumnaReporte,
} from '@/lib/columnasReporte';
import { Modal } from './Modal';

export type FormatoExportacion = 'pdf' | 'csv';

/**
 * Antes de bajar un reporte, qué columnas lleva.
 *
 * Viene marcado lo que se eligió la última vez, así que quien siempre baja lo
 * mismo toca «PDF» y listo. Las columnas salen en el orden del reporte, no en
 * el que se tildaron.
 */
export function ElegirColumnas<T>({
  titulo,
  reporte,
  columnas,
  formatos = ['pdf', 'csv'],
  exportando = false,
  onExportar,
  onCerrar,
}: {
  titulo: string;
  /** Con qué nombre se recuerda la elección. */
  reporte: string;
  columnas: ColumnaReporte<T>[];
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

  return (
    <Modal titulo={titulo} abierto onCerrar={onCerrar} avisarSiHayCambios={false}>
      <div className="formulario-modal">
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
