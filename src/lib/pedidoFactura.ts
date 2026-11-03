/**
 * Lo que se le pide a todo proveedor junto con la orden: la factura digital,
 * a Administración. Con la factura en PDF el precio se carga leyéndola, y no
 * hay que copiarlo a mano de un papel. Va en el PDF, el correo y el WhatsApp.
 */
export const ADMINISTRACION = {
  email: 'administracion@lacteoslastres.com.ar',
  telefono: '3534 40-3519',
};

/** Para el correo y el WhatsApp: le habla al proveedor. */
export const PEDIDO_FACTURA_DIGITAL =
  'Por favor, envíen la factura en formato digital (PDF) a Administración: ' +
  `${ADMINISTRACION.email} · Tel. ${ADMINISTRACION.telefono}.`;

/** Para el PDF de la orden. */
export const PEDIDO_FACTURA_PDF =
  'Enviar la factura en formato digital (PDF) a Administración: ' +
  `${ADMINISTRACION.email} · Tel. ${ADMINISTRACION.telefono}`;
