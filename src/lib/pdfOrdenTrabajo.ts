import { dibujarMembrete, EMPRESA, GRIS, NEGRO, ROJO } from './pdfMembrete';
import { formatearFechaSola, formatearNumero } from './formato';
import type { Equipo } from '@/tipos/equipo';
import {
  ETIQUETA_ESTADO_TRABAJO,
  ETIQUETA_TIPO_TRABAJO,
  type OrdenTrabajo,
} from '@/tipos/ordenTrabajo';
import type { Proveedor } from '@/tipos/proveedor';

/**
 * Lo que la orden trae solo por nombre y el papel necesita completo: la ficha
 * del equipo (marca, modelo, serie, dónde está) y los datos del taller. Los
 * pide quien imprime; si no se pudieron traer, el papel sale con lo que hay.
 */
export interface ExtrasOrdenTrabajo {
  equipo?: Equipo | null;
  proveedor?: Proveedor | null;
}

function moneda(valor: number): string {
  return `$ ${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Los datos del equipo, renglón por renglón, salteando lo que no se cargó. */
function renglonesDelEquipo(orden: OrdenTrabajo, equipo: Equipo | null | undefined): string[] {
  if (equipo) {
    const marcaModelo = [equipo.marcaNombre, equipo.modeloNombre].filter(Boolean).join(' ');
    return [
      equipo.nombre,
      equipo.codigoInterno ? `Código: ${equipo.codigoInterno}` : '',
      equipo.tipoNombre ? `Tipo: ${equipo.tipoNombre}` : '',
      marcaModelo ? `Marca y modelo: ${marcaModelo}` : '',
      equipo.numeroSerie ? `N° de serie: ${equipo.numeroSerie}` : '',
      equipo.ubicacionNombre ? `Ubicación: ${equipo.ubicacionNombre}` : '',
      equipo.equipoPadreNombre ? `Montado en: ${equipo.equipoPadreNombre}` : '',
    ].filter(Boolean);
  }
  if (orden.equipoNombre) {
    return [orden.equipoNombre, orden.equipoCodigo ? `Código: ${orden.equipoCodigo}` : ''].filter(
      Boolean,
    );
  }
  if (orden.equipoItNombre) {
    return [
      orden.equipoItNombre,
      orden.equipoItCodigo ? `Código: ${orden.equipoItCodigo}` : '',
    ].filter(Boolean);
  }
  return ['Sin equipo relacionado'];
}

/**
 * Arma el PDF de una orden de trabajo, con el mismo membrete que la orden de
 * compra.
 *
 * Está pensado para el motor que se manda a un taller: logística tiene que
 * saber qué equipo es, a dónde va y qué hay que hacerle, y el taller, qué se
 * le pide. Por eso, mientras la orden está abierta, deja lugar para que el
 * taller escriba qué encontró, y las firmas de quien entrega, quien lo lleva y
 * quien lo recibe.
 */
async function construirPdf(orden: OrdenTrabajo, extras: ExtrasOrdenTrabajo) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const margen = 14;
  const anchoUtil = anchoPagina - margen * 2;
  const externo = orden.ejecutor === 'EXTERNO';

  await dibujarMembrete(doc, 'ORDEN DE TRABAJO', orden.numero);

  /** Un título de sección en rojo, con su raya. */
  const seccion = (titulo: string, yTitulo: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...ROJO);
    doc.text(titulo, margen, yTitulo);
    doc.setDrawColor(220);
    doc.setLineWidth(0.3);
    doc.line(margen, yTitulo + 1.5, anchoPagina - margen, yTitulo + 1.5);
    return yTitulo + 6.5;
  };

  /** Texto largo partido al ancho de la hoja. Devuelve dónde termina. */
  const parrafo = (texto: string, yTexto: number, negrita = false) => {
    doc.setFont('helvetica', negrita ? 'bold' : 'normal');
    doc.setFontSize(negrita ? 10.5 : 9.5);
    doc.setTextColor(...NEGRO);
    const lineas = doc.splitTextToSize(texto, anchoUtil);
    doc.text(lineas, margen, yTexto);
    return yTexto + lineas.length * (negrita ? 5 : 4.6);
  };

  // ── Equipo y datos de la orden, en dos columnas ──
  let y = 46;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NEGRO);
  doc.text('EQUIPO', margen, y);
  doc.text('DATOS DE LA ORDEN', anchoPagina / 2 + 4, y);

  y += 5;
  const izquierda = renglonesDelEquipo(orden, extras.equipo);
  const derecha = [
    `Fecha: ${formatearFechaSola(orden.abiertaEn)}`,
    `Tipo de trabajo: ${ETIQUETA_TIPO_TRABAJO[orden.tipo]}`,
    `Estado: ${ETIQUETA_ESTADO_TRABAJO[orden.estado]}`,
    orden.abiertaPorNombre ? `Pidió: ${orden.abiertaPorNombre}` : '',
    orden.asignadoANombre ? `Responsable: ${orden.asignadoANombre}` : '',
    orden.planNombre ? `Plan: ${orden.planNombre}` : '',
  ].filter(Boolean);

  const filas = Math.max(izquierda.length, derecha.length);
  const anchoColumna = anchoPagina / 2 - margen - 4;
  for (let i = 0; i < filas; i++) {
    // El nombre del equipo va resaltado: es lo primero que se busca en el papel.
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
    doc.setTextColor(...(i === 0 ? NEGRO : GRIS));
    if (izquierda[i]) doc.text(doc.splitTextToSize(izquierda[i], anchoColumna)[0], margen, y + i * 4.6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRIS);
    if (derecha[i]) doc.text(derecha[i], anchoPagina / 2 + 4, y + i * 4.6);
  }
  y += filas * 4.6 + 4;

  // ── A qué taller va ──
  if (externo) {
    const p = extras.proveedor;
    const datos = [
      p?.cuit ? `CUIT: ${p.cuit}` : '',
      p?.telefono ? `Tel.: ${p.telefono}` : '',
      p?.email ? p.email : '',
    ].filter(Boolean);
    const alto = datos.length > 0 ? 15 : 10;

    doc.setFillColor(253, 242, 244);
    doc.setDrawColor(...ROJO);
    doc.setLineWidth(0.4);
    doc.roundedRect(margen, y, anchoUtil, alto, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...ROJO);
    doc.text(orden.estado === 'CERRADA' ? 'LO HIZO' : 'SE ENVÍA A', margen + 4, y + 6);
    doc.setTextColor(...NEGRO);
    doc.setFontSize(11);
    doc.text(orden.proveedorNombre ?? p?.nombre ?? '—', margen + 28, y + 6);
    if (datos.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...GRIS);
      doc.text(datos.join('   ·   '), margen + 28, y + 11.5);
    }
    y += alto + 7;
  }

  // ── Qué hay que hacer ──
  y = seccion(orden.estado === 'CERRADA' ? 'TRABAJO PEDIDO' : 'TRABAJO A REALIZAR', y);
  y = parrafo(orden.titulo, y, true);
  if (orden.descripcion) y = parrafo(orden.descripcion, y + 1);
  y += 5;

  // ── Materiales que salieron del pañol para este trabajo ──
  if (orden.materiales.length > 0) {
    y = seccion('MATERIALES', y);
    autoTable(doc, {
      startY: y - 2,
      head: [['#', 'Material', 'Cantidad', 'Unidad']],
      body: orden.materiales.map((m, i) => [
        String(i + 1),
        m.materialNombre,
        formatearNumero(m.cantidad),
        m.unidad,
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.2, textColor: NEGRO },
      headStyles: { fillColor: ROJO, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'center' },
      },
      margin: { left: margen, right: margen },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Lo que se hizo, o el lugar para escribirlo ──
  if (orden.estado === 'CERRADA' && orden.resolucion) {
    y = seccion('TRABAJO REALIZADO', y);
    y = parrafo(orden.resolucion, y);
    const numeros = [
      orden.costoManoObra !== null ? `Mano de obra: ${moneda(orden.costoManoObra)}` : '',
      orden.horasParada !== null ? `Horas de parada: ${formatearNumero(orden.horasParada)}` : '',
      orden.cerradaEn ? `Terminado: ${formatearFechaSola(orden.cerradaEn)}` : '',
    ].filter(Boolean);
    if (numeros.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...GRIS);
      doc.text(numeros.join('   ·   '), margen, y + 1);
      y += 5;
    }
    y += 4;
  } else if (orden.estado === 'ABIERTA') {
    // En blanco, para completar a mano: el taller anota qué encontró.
    y = seccion(externo ? 'PARA COMPLETAR POR EL TALLER' : 'OBSERVACIONES', y);
    const renglones = externo
      ? ['Diagnóstico / qué se encontró:', '', 'Qué se hizo:', '', 'Fecha de devolución:']
      : ['', '', ''];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS);
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    for (const r of renglones) {
      if (r) doc.text(r, margen, y);
      y += 1.5;
      doc.line(margen + (r ? doc.getTextWidth(r) + 2 : 0), y, anchoPagina - margen, y);
      y += 6;
    }
    y += 2;
  }

  // ── Firmas ──
  const firmas = externo
    ? ['Entregó (Mantenimiento)', 'Retiró (Logística)', 'Recibió (Taller)']
    : ['Responsable', 'Controló'];
  let yFirmas = Math.max(y + 16, 250);
  if (yFirmas > altoPagina - 24) {
    // No entra en esta hoja: las firmas van en la siguiente.
    doc.addPage();
    yFirmas = 40;
  }
  const anchoFirma = 52;
  const hueco = (anchoUtil - anchoFirma * firmas.length) / (firmas.length - 1);
  doc.setDrawColor(150);
  doc.setLineWidth(0.3);
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  firmas.forEach((f, i) => {
    const x = margen + i * (anchoFirma + hueco);
    doc.line(x, yFirmas, x + anchoFirma, yFirmas);
    doc.text(f, x + anchoFirma / 2, yFirmas + 4, { align: 'center' });
  });

  // ── Pie ──
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  doc.text(
    `${EMPRESA.nombre} · Orden de trabajo ${orden.numero} · Impresa el ${formatearFechaSola(new Date().toISOString())}`,
    anchoPagina / 2,
    altoPagina - 10,
    { align: 'center' },
  );

  return doc;
}

/** Genera el PDF de la orden de trabajo e inicia la descarga. */
export async function descargarPdfOrdenTrabajo(
  orden: OrdenTrabajo,
  extras: ExtrasOrdenTrabajo = {},
): Promise<void> {
  const doc = await construirPdf(orden, extras);
  doc.save(`${orden.numero}.pdf`);
}
