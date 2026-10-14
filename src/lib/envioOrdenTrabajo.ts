import type { OrdenTrabajo } from '@/tipos/ordenTrabajo';
import { aNumeroWhatsapp } from './envioOrden';

/**
 * El mensaje de WhatsApp que acompaña una orden de trabajo al taller.
 *
 * Es el mismo texto que arma el servidor para el correo: qué equipo va y qué
 * hay que hacerle. El PDF no se puede adjuntar desde el navegador, así que el
 * mensaje avisa que va aparte.
 */
export function mensajeAlTaller(orden: OrdenTrabajo): string {
  const equipo = orden.equipoNombre
    ? orden.equipoCodigo
      ? `${orden.equipoNombre} (${orden.equipoCodigo})`
      : orden.equipoNombre
    : orden.equipoItNombre;

  const lineas = [
    `Estimados de ${orden.proveedorNombre ?? 'la empresa'}:`,
    '',
    `Les enviamos la orden de trabajo ${orden.numero}.`,
    '',
  ];
  if (equipo) lineas.push(`Equipo: ${equipo}`);
  lineas.push(`Trabajo a realizar: ${orden.titulo}`);
  if (orden.descripcion) lineas.push('', `Detalle: ${orden.descripcion}`);
  lineas.push(
    '',
    'Les mando la orden en PDF. Por favor, que viaje con el equipo y nos la devuelvan con lo que se le hizo.',
    '',
    'Saludos,',
    'Lácteos Las Tres S.R.L.',
  );
  return lineas.join('\n');
}

/** Enlace de WhatsApp al taller, o null si no tiene un celular usable. */
export function enlaceWhatsappTaller(
  orden: OrdenTrabajo,
  telefono: string | null | undefined,
): string | null {
  const numero = aNumeroWhatsapp(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeAlTaller(orden))}`;
}
