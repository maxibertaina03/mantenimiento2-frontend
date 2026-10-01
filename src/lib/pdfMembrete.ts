import type { jsPDF } from 'jspdf';
import { logoComoSvg } from '@/componentes/LogoLasTres';

/**
 * El membrete de los papeles que salen del sistema: logo, nombre de la empresa
 * y el recuadro con qué es y su número. Lo comparten la orden de compra y la
 * orden de trabajo, para que en la planta se reconozcan como del mismo lado.
 */

/** Rojo institucional de Lácteos Las Tres (RGB). */
export const ROJO: [number, number, number] = [200, 16, 46];
export const GRIS: [number, number, number] = [90, 90, 90];
export const NEGRO: [number, number, number] = [25, 25, 25];

export const EMPRESA = {
  nombre: 'LÁCTEOS LAS TRES S.R.L.',
  leyenda: 'Est. 1989 · Sistema de Mantenimiento',
};

/** Cuánto se espera a que el navegador rasterice el logo antes de seguir sin él. */
const MS_ESPERA_LOGO = 3000;

/**
 * Convierte el logo (SVG) a PNG, que es lo que jsPDF sabe insertar.
 *
 * Se dibuja en un canvas al doble del tamaño final para que no se vea pixelado
 * al imprimir. Si algo falla (canvas bloqueado, SVG invalido), devuelve null y
 * el PDF sale sin logo en lugar de romperse.
 */
export async function logoComoPng(lado = 512): Promise<string | null> {
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
 * Dibuja el encabezado y devuelve dónde termina (en mm), para seguir debajo.
 *
 * @param titulo lo que va en el recuadro: «ORDEN DE COMPRA», «ORDEN DE TRABAJO».
 */
export async function dibujarMembrete(doc: jsPDF, titulo: string, numero: string): Promise<number> {
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

  // ── Recuadro del número (arriba a la derecha) ──
  const anchoCaja = 62;
  const xCaja = anchoPagina - margen - anchoCaja;
  doc.setDrawColor(...ROJO);
  doc.setLineWidth(0.6);
  doc.roundedRect(xCaja, 12, anchoCaja, 22, 2, 2);

  doc.setTextColor(...ROJO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(titulo, xCaja + anchoCaja / 2, 19, { align: 'center' });

  doc.setTextColor(...NEGRO);
  doc.setFontSize(14);
  doc.text(numero, xCaja + anchoCaja / 2, 27, { align: 'center' });

  // Línea separadora
  doc.setDrawColor(...ROJO);
  doc.setLineWidth(0.8);
  doc.line(margen, 38, anchoPagina - margen, 38);

  return 38;
}
