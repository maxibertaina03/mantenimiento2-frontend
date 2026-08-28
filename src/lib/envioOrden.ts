import type { OrdenCompra } from '@/tipos/ordenCompra';

/** Copia interna que recibe todas las órdenes emitidas. */
export const MAIL_ADMINISTRACION = 'administracion@lacteoslastres.com.ar';

/**
 * WhatsApp de administración de la empresa.
 *
 * PROVISORIO: por ahora las órdenes se mandan acá para probar el circuito sin
 * escribirle a un proveedor de verdad. Cuando se confirme que funciona, el
 * envío al proveedor es el botón de al lado (usa el teléfono de su ficha).
 */
export const WHATSAPP_ADMINISTRACION = '+54 9 3534 40-3519';

/**
 * Armado de los envíos de una orden de compra: correo y WhatsApp.
 *
 * El PDF NO se puede adjuntar automáticamente: ni `mailto:` ni la API de
 * WhatsApp permiten adjuntar archivos desde el navegador, por seguridad. Por eso
 * el flujo descarga el PDF primero y el mensaje avisa que hay que adjuntarlo:
 * es la parte que sí o sí hace la persona.
 */

/** Un e-mail plausible; lo mínimo para no armar un `mailto:` roto. */
export function esEmailValido(valor: string | null | undefined): boolean {
  const v = (valor ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Pasa un teléfono argentino al formato que espera WhatsApp: solo dígitos, con
 * código de país. Devuelve null si no parece un número usable.
 *
 * Contempla lo que se escribe en la práctica: "03564 15 123456",
 * "+54 9 3564 123456", "(3564) 123-456".
 */
export function aNumeroWhatsapp(telefono: string | null | undefined): string | null {
  const crudo = (telefono ?? '').trim();
  if (!crudo) return null;

  let d = crudo.replace(/\D/g, '');
  if (!d) return null;

  // Ya viene con código de país.
  if (d.startsWith('54')) {
    d = d.slice(2);
  } else if (d.startsWith('0')) {
    // 0 de larga distancia: no va en el formato internacional.
    d = d.slice(1);
  }

  // El 15 de los celulares tampoco va; en su lugar WhatsApp usa el 9 inicial.
  // Aparece después del código de área, que en el país tiene 2 a 4 dígitos.
  for (const largoArea of [2, 3, 4]) {
    if (d.slice(largoArea, largoArea + 2) === '15') {
      d = d.slice(0, largoArea) + d.slice(largoArea + 2);
      break;
    }
  }

  if (d.startsWith('9')) d = d.slice(1);

  // Un número argentino sin 0 ni 15 tiene 10 dígitos (área + abonado).
  if (d.length < 8 || d.length > 11) return null;

  return `549${d}`;
}

function moneda(valor: number | null): string {
  if (valor === null) return '';
  return `$ ${valor.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Detalle en texto plano, para el cuerpo del correo y el mensaje de WhatsApp. */
function detalle(orden: OrdenCompra): string {
  return orden.renglones
    .map((r) => {
      const cantidad = `${r.cantidad}${r.unidad ? ` ${r.unidad}` : ''}`;
      return `• ${r.materialNombre ?? 'Material'} — ${cantidad}`;
    })
    .join('\n');
}

export interface MensajeOrden {
  asunto: string;
  cuerpo: string;
}

export function armarMensaje(orden: OrdenCompra): MensajeOrden {
  const lineas = [
    `Estimados de ${orden.proveedorNombre ?? 'la empresa'}:`,
    '',
    `Les enviamos la orden de compra ${orden.numero}.`,
    '',
    'Detalle:',
    detalle(orden),
  ];

  if (orden.total !== null) {
    lineas.push('', `Total: ${moneda(orden.total)}`);
  }
  if (orden.observaciones) {
    lineas.push('', `Observaciones: ${orden.observaciones}`);
  }

  lineas.push(
    '',
    'La orden en PDF va adjunta.',
    '',
    'Saludos,',
    'Lácteos Las Tres S.R.L.',
  );

  return {
    asunto: `Orden de compra ${orden.numero} - Lácteos Las Tres S.R.L.`,
    cuerpo: lineas.join('\n'),
  };
}

/**
 * Enlace `mailto:` con administración siempre en copia.
 *
 * Si el proveedor tiene correo va como destinatario y administración en copia;
 * si no, administración es el destinatario, así queda constancia igual.
 */
export function enlaceCorreo(orden: OrdenCompra, emailProveedor?: string | null): string {
  const { asunto, cuerpo } = armarMensaje(orden);
  const tieneProveedor = esEmailValido(emailProveedor);

  const para = tieneProveedor ? emailProveedor!.trim() : MAIL_ADMINISTRACION;
  const cc = tieneProveedor ? MAIL_ADMINISTRACION : '';

  const parametros = new URLSearchParams({ subject: asunto, body: cuerpo });
  if (cc) parametros.set('cc', cc);

  // URLSearchParams codifica los espacios como "+", que en un mailto se ven
  // literalmente como "+" en vez de espacios.
  return `mailto:${encodeURIComponent(para)}?${parametros.toString().replace(/\+/g, '%20')}`;
}

/** Enlace de WhatsApp, o null si el proveedor no tiene un teléfono usable. */
export function enlaceWhatsapp(orden: OrdenCompra, telefono: string | null | undefined): string | null {
  const numero = aNumeroWhatsapp(telefono);
  if (!numero) return null;

  const { cuerpo } = armarMensaje(orden);
  return `https://wa.me/${numero}?text=${encodeURIComponent(cuerpo)}`;
}
