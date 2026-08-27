import { formatearFechaSola, formatearNumero } from './formato';
import type { OrdenCompra } from '@/tipos/ordenCompra';

/** Rojo institucional de Lácteos Las Tres (RGB). */
const ROJO: [number, number, number] = [200, 16, 46];
const GRIS: [number, number, number] = [90, 90, 90];
const NEGRO: [number, number, number] = [25, 25, 25];

/** Subconjunto de jsPDF que usa el dibujo del escudo. */
interface DocPdf {
  setFillColor: (r: number, g: number, b: number) => void;
  roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, s: string) => void;
  rect: (x: number, y: number, w: number, h: number, s: string) => void;
  triangle: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, s: string) => void;
  circle: (x: number, y: number, r: number, s: string) => void;
}

const EMPRESA = {
  nombre: 'LÁCTEOS LAS TRES S.R.L.',
  leyenda: 'Est. 1989 · Sistema de Mantenimiento',
};

function moneda(valor: number | null): string {
  if (valor === null) return '—';
  return `$ ${valor.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Genera e inicia la descarga del PDF de una orden de compra.
 *
 * jsPDF y autotable se cargan dinámicamente para que no pesen en el bundle
 * inicial: solo se descargan cuando alguien imprime una orden.
 */
export async function descargarPdfOrdenCompra(orden: OrdenCompra): Promise<void> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const margen = 14;

  // ── Encabezado: escudo + datos de la empresa ──
  dibujarEscudo(doc, margen, 12, 18);

  doc.setTextColor(...ROJO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(EMPRESA.nombre, margen + 24, 20);

  doc.setTextColor(...GRIS);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(EMPRESA.leyenda, margen + 24, 25.5);

  // ── Recuadro del número de orden (arriba a la derecha) ──
  const anchoCaja = 62;
  const xCaja = anchoPagina - margen - anchoCaja;
  doc.setDrawColor(...ROJO);
  doc.setLineWidth(0.6);
  doc.roundedRect(xCaja, 12, anchoCaja, 22, 2, 2);

  doc.setTextColor(...ROJO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ORDEN DE COMPRA', xCaja + anchoCaja / 2, 19, { align: 'center' });

  doc.setTextColor(...NEGRO);
  doc.setFontSize(14);
  doc.text(orden.numero, xCaja + anchoCaja / 2, 27, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text(`Estado: ${orden.estado}`, xCaja + anchoCaja / 2, 32, { align: 'center' });

  // Línea separadora
  doc.setDrawColor(...ROJO);
  doc.setLineWidth(0.8);
  doc.line(margen, 38, anchoPagina - margen, 38);

  // ── Datos del proveedor y de la orden ──
  let y = 46;
  doc.setFontSize(9);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NEGRO);
  doc.text('PROVEEDOR', margen, y);
  doc.text('DATOS DE LA ORDEN', anchoPagina / 2 + 4, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRIS);

  const izquierda: string[] = [
    orden.proveedorNombre ?? '—',
    orden.proveedorCuit ? `CUIT: ${orden.proveedorCuit}` : '',
  ].filter(Boolean);

  const derecha: string[] = [
    `Fecha de emisión: ${formatearFechaSola(orden.fecha)}`,
    `Entrega estimada: ${formatearFechaSola(orden.fechaEntregaEstimada)}`,
    orden.creadoPorNombre ? `Solicitó: ${orden.creadoPorNombre}` : '',
    orden.recibidaEn ? `Recibida: ${formatearFechaSola(orden.recibidaEn)}` : '',
  ].filter(Boolean);

  const filas = Math.max(izquierda.length, derecha.length);
  for (let i = 0; i < filas; i++) {
    if (izquierda[i]) doc.text(izquierda[i], margen, y + i * 4.6);
    if (derecha[i]) doc.text(derecha[i], anchoPagina / 2 + 4, y + i * 4.6);
  }
  y += filas * 4.6 + 4;

  // ── Detalle ──
  const hayPrecios = orden.renglones.some((r) => r.precioUnitario !== null);

  const cabecera = hayPrecios
    ? ['#', 'Material', 'Cantidad', 'Unidad', 'P. unitario', 'Subtotal']
    : ['#', 'Material', 'Cantidad', 'Unidad'];

  const cuerpo = orden.renglones.map((r, i) => {
    const base = [
      String(i + 1),
      r.materialNombre ?? r.materialId,
      formatearNumero(r.cantidad),
      r.unidad ?? '—',
    ];
    return hayPrecios ? [...base, moneda(r.precioUnitario), moneda(r.subtotal)] : base;
  });

  autoTable(doc, {
    startY: y,
    head: [cabecera],
    body: cuerpo,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.4, textColor: NEGRO },
    headStyles: { fillColor: ROJO, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'center' },
      ...(hayPrecios ? { 4: { halign: 'right' }, 5: { halign: 'right' } } : {}),
    },
    margin: { left: margen, right: margen },
  });

  // `lastAutoTable` lo agrega el plugin autotable al documento.
  const finTabla = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  y = finTabla + 8;

  // ── Total ──
  if (orden.total !== null) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...NEGRO);
    doc.text('TOTAL', anchoPagina - margen - 46, y);
    doc.setTextColor(...ROJO);
    doc.text(moneda(orden.total), anchoPagina - margen, y, { align: 'right' });
    y += 10;
  }

  // ── Observaciones ──
  if (orden.observaciones) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NEGRO);
    doc.text('Observaciones', margen, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRIS);
    const lineas = doc.splitTextToSize(orden.observaciones, anchoPagina - margen * 2);
    doc.text(lineas, margen, y);
    y += lineas.length * 4.4 + 6;
  }

  // ── Firmas ──
  const yFirmas = Math.max(y + 16, 236);
  doc.setDrawColor(150);
  doc.setLineWidth(0.3);
  const anchoFirma = 58;
  doc.line(margen, yFirmas, margen + anchoFirma, yFirmas);
  doc.line(anchoPagina - margen - anchoFirma, yFirmas, anchoPagina - margen, yFirmas);

  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text('Solicitado por', margen + anchoFirma / 2, yFirmas + 4, { align: 'center' });
  doc.text('Autorizado por', anchoPagina - margen - anchoFirma / 2, yFirmas + 4, {
    align: 'center',
  });

  // ── Pie ──
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  doc.text(
    `${EMPRESA.nombre} · Orden ${orden.numero} · Generada el ${formatearFechaSola(new Date().toISOString())}`,
    anchoPagina / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' },
  );

  doc.save(`${orden.numero}.pdf`);
}

/**
 * Escudo del logo dibujado con primitivas de jsPDF.
 *
 * jsPDF no acepta SVG, así que el escudo se reconstruye con rectángulos
 * redondeados, un círculo para la base en U y triángulos para las estrellas.
 * Espeja la forma del componente LogoLasTres: borde rojo, hueco blanco, cuerpo
 * rojo, base redondeada y estrella central más grande.
 *
 * Si algún día se sube el archivo oficial del logo, esto se reemplaza por
 * `doc.addImage(logoBase64, 'PNG', x, y, ancho, alto)`, que queda idéntico.
 */
function dibujarEscudo(doc: DocPdf, x: number, y: number, ancho: number): void {
  // Tres capas concéntricas: borde, hueco blanco y cuerpo.
  const capas: [number, [number, number, number]][] = [
    [0, ROJO],
    [0.5, [255, 255, 255]],
    [1.1, ROJO],
  ];

  for (const [inset, color] of capas) {
    const a = ancho - inset * 2;
    const cx = x + inset;
    const cy = y + inset;
    const radio = a / 2;
    // Parte recta del escudo.
    const altoRecto = ancho * 0.72 - inset;

    doc.setFillColor(...color);
    doc.roundedRect(cx, cy, a, altoRecto, a * 0.06, a * 0.06, 'F');
    // Base en U: media circunferencia apoyada al final de la parte recta.
    doc.circle(cx + radio, cy + altoRecto, radio, 'F');
    // Tapa la mitad superior del círculo para que no sobresalga de los lados.
    doc.setFillColor(...color);
    doc.rect(cx, cy + altoRecto - radio, a, radio, 'F');
  }

  // Estrellas: la del centro más grande, como en el original.
  doc.setFillColor(255, 255, 255);
  const yEstrellas = y + ancho * 0.3;
  estrella(doc, x + ancho * 0.28, yEstrellas + ancho * 0.04, ancho * 0.09);
  estrella(doc, x + ancho * 0.5, yEstrellas, ancho * 0.13);
  estrella(doc, x + ancho * 0.72, yEstrellas + ancho * 0.04, ancho * 0.09);

  // Franja diagonal del paisaje.
  doc.setFillColor(255, 255, 255);
  doc.triangle(
    x + ancho * 0.1,
    y + ancho * 0.78,
    x + ancho * 0.9,
    y + ancho * 0.56,
    x + ancho * 0.9,
    y + ancho * 0.64,
    'F',
  );
  doc.triangle(
    x + ancho * 0.1,
    y + ancho * 0.78,
    x + ancho * 0.9,
    y + ancho * 0.64,
    x + ancho * 0.1,
    y + ancho * 0.86,
    'F',
  );
}

/** Estrella de cinco puntas aproximada con dos triángulos superpuestos. */
function estrella(doc: DocPdf, cx: number, cy: number, r: number): void {
  doc.triangle(cx, cy - r, cx - r * 0.87, cy + r * 0.5, cx + r * 0.87, cy + r * 0.5, 'F');
  doc.triangle(cx, cy + r, cx - r * 0.87, cy - r * 0.5, cx + r * 0.87, cy - r * 0.5, 'F');
}
