import type { CellHookData } from 'jspdf-autotable';
// jsPDF y autotable se importan dinámicamente dentro de exportarPdf para no
// cargarlos en el bundle inicial (solo se descargan al exportar un PDF).

/** Colores de marca (RGB). */
const AZUL: [number, number, number] = [37, 99, 235];
const GRIS_TEXTO: [number, number, number] = [31, 41, 51];
const GRIS_SUAVE: [number, number, number] = [107, 114, 128];
const FILA_ALTERNA: [number, number, number] = [246, 248, 250];
const RESALTADO: [number, number, number] = [254, 243, 199]; // ámbar suave (bajo stock)

const COLOR_TIPO: Record<string, [number, number, number]> = {
  ENTRADA: [22, 101, 52], // verde
  SALIDA: [153, 27, 27], // rojo
  AJUSTE: [55, 48, 163], // índigo
};

export interface OpcionesPdf {
  /** Título grande arriba. */
  titulo: string;
  /** Línea secundaria (p. ej. filtros aplicados / total). */
  subtitulo?: string;
  encabezados: string[];
  filas: (string | number)[][];
  nombreArchivo: string;
  orientacion?: 'portrait' | 'landscape';
  /** Marca qué filas resaltar (mismo orden que `filas`). Ej: bajo stock. */
  resaltarFilas?: boolean[];
  /** Índice de la columna "Tipo" para colorear su texto según el valor. */
  columnaTipo?: number;
  /** Texto chico al pie de la primera línea (leyenda). */
  leyenda?: string;
}

/** Genera y descarga un PDF con una tabla estilizada. */
export async function exportarPdf(opc: OpcionesPdf): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({
    orientation: opc.orientacion ?? 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  const margen = 40;
  const anchoPagina = doc.internal.pageSize.getWidth();

  // ── Encabezado ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...GRIS_TEXTO);
  doc.text(`Mantenimiento — ${opc.titulo}`, margen, 46);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRIS_SUAVE);
  const generado = `Generado: ${new Date().toLocaleString('es-AR')}`;
  doc.text(generado, margen, 62);
  if (opc.subtitulo) doc.text(opc.subtitulo, margen, 75);
  if (opc.leyenda) {
    doc.text(opc.leyenda, anchoPagina - margen, 62, { align: 'right' });
  }

  const inicioY = opc.subtitulo ? 88 : 76;

  autoTable(doc, {
    startY: inicioY,
    head: [opc.encabezados],
    body: opc.filas,
    margin: { left: margen, right: margen },
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', textColor: GRIS_TEXTO },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: FILA_ALTERNA },
    didParseCell: (data: CellHookData) => {
      if (data.section !== 'body') return;
      // Resaltado de fila completa (p. ej. bajo stock).
      if (opc.resaltarFilas?.[data.row.index]) {
        data.cell.styles.fillColor = RESALTADO;
      }
      // Coloreo del texto de la columna "Tipo".
      if (opc.columnaTipo !== undefined && data.column.index === opc.columnaTipo) {
        const color = COLOR_TIPO[String(data.cell.raw)];
        if (color) {
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: () => {
      // Pie con número de página.
      const pagina = doc.getNumberOfPages();
      const alto = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(...GRIS_SUAVE);
      doc.text(`Página ${pagina}`, anchoPagina - margen, alto - 18, { align: 'right' });
    },
  });

  doc.save(opc.nombreArchivo);
}
