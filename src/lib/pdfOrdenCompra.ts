import { logoComoSvg } from '@/componentes/LogoLasTres';
import { formatearFechaSola, formatearNumero } from './formato';
import type { OrdenCompra } from '@/tipos/ordenCompra';

/** Rojo institucional de Lácteos Las Tres (RGB). */
const ROJO: [number, number, number] = [200, 16, 46];
const GRIS: [number, number, number] = [90, 90, 90];
const NEGRO: [number, number, number] = [25, 25, 25];

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

/** Cuánto se espera a que el navegador rasterice el logo antes de seguir sin él. */
const MS_ESPERA_LOGO = 3000;

/**
 * Convierte el logo (SVG) a PNG, que es lo que jsPDF sabe insertar.
 *
 * Se dibuja en un canvas al doble del tamaño final para que no se vea pixelado
 * al imprimir. Si algo falla (canvas bloqueado, SVG invalido), devuelve null y
 * el PDF sale sin logo en lugar de romperse.
 */
async function logoComoPng(lado = 512): Promise<string | null> {
  try {
    const svg = logoComoSvg();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    // El plazo es clave: si el navegador nunca dispara onload ni onerror, sin
    // esto la promesa queda colgada y el PDF no se genera nunca. Preferimos un
    // PDF sin logo antes que un boton que no responde.
    const imagen = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      const plazo = setTimeout(() => resolve(null), MS_ESPERA_LOGO);
      img.onload = () => {
        clearTimeout(plazo);
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(plazo);
        resolve(null);
      };
      img.src = url;
    });
    if (!imagen) return null;

    const canvas = document.createElement('canvas');
    canvas.width = lado;
    canvas.height = lado;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Fondo blanco: el PDF no maneja transparencia de forma consistente.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lado, lado);
    ctx.drawImage(imagen, 0, 0, lado, lado);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Arma el PDF de una orden y devuelve el documento, sin guardarlo.
 *
 * Se separa del guardado porque el mismo PDF tiene dos destinos: la descarga y
 * el adjunto que se manda al backend para el envío automático. Generarlo dos
 * veces con código distinto garantizaría que en algún momento se despeguen.
 *
 * jsPDF y autotable se cargan dinámicamente para que no pesen en el bundle
 * inicial: solo se descargan cuando alguien imprime una orden.
 */
async function construirPdf(orden: OrdenCompra) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const margen = 14;

  // ── Encabezado: logo real + datos de la empresa ──
  const logoPng = await logoComoPng();
  if (logoPng) {
    doc.addImage(logoPng, 'PNG', margen, 10, 24, 24);
  }

  doc.setTextColor(...ROJO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(EMPRESA.nombre, margen + 29, 20);

  doc.setTextColor(...GRIS);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(EMPRESA.leyenda, margen + 29, 25.5);

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

  return doc;
}

/** Genera el PDF e inicia la descarga. */
export async function descargarPdfOrdenCompra(orden: OrdenCompra): Promise<void> {
  const doc = await construirPdf(orden);
  doc.save(`${orden.numero}.pdf`);
}

/**
 * El mismo PDF, en base64, para mandarlo al backend como adjunto.
 *
 * Se saca el prefijo `data:application/pdf;base64,` que agrega jsPDF: el
 * backend espera base64 puro y con el prefijo el Buffer saldría corrupto.
 */
export async function pdfOrdenComoBase64(orden: OrdenCompra): Promise<string> {
  const doc = await construirPdf(orden);
  const conPrefijo = doc.output('datauristring');
  return conPrefijo.slice(conPrefijo.indexOf(',') + 1);
}
