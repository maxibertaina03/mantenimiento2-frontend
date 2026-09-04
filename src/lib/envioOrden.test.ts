import { describe, expect, it } from 'vitest';
import {
  MAIL_ADMINISTRACION_POR_DEFECTO,
  aNumeroWhatsapp,
  armarMensaje,
  enlaceCorreo,
  enlaceWhatsapp,
  esEmailValido,
} from './envioOrden';
import type { OrdenCompra } from '@/tipos/ordenCompra';

const orden: OrdenCompra = {
  id: 'oc-1',
  numero: 'OC-2026-0007',
  estado: 'EMITIDA',
  proveedorId: 'p-1',
  proveedorNombre: 'Ferretería Central',
  proveedorCuit: '30-12345678-9',
  proveedorEmail: 'ventas@ferreteria.com.ar',
  proveedorTelefono: '3564 15 123456',
  fecha: '2026-08-28T10:00:00.000Z',
  observaciones: 'Entregar en portería',
  creadoPorNombre: 'Maxi',
  emitidaEn: null,
  recibidaEn: null,
  recibidaPorNombre: null,
  renglones: [
    {
      id: 'r1',
      materialId: 'm1',
      materialNombre: 'Cable 2.5mm',
      unidad: 'm',
      cantidad: 100,
      precioUnitario: 1250.5,
      subtotal: 125050,
      notas: null,
      movimientoId: null,
    },
  ],
  total: 125050,
  editable: false,
  creadoEn: '2026-08-28T10:00:00.000Z',
};

describe('esEmailValido', () => {
  it.each(['a@b.com', 'ventas@ferreteria.com.ar'])('acepta %s', (v) => {
    expect(esEmailValido(v)).toBe(true);
  });

  it.each([null, undefined, '', '  ', 'sin-arroba', 'a@b', 'a@ b.com'])('rechaza %p', (v) => {
    expect(esEmailValido(v)).toBe(false);
  });
});

describe('aNumeroWhatsapp', () => {
  it('REGRESION: saca el 0 de larga distancia y el 15 del celular', () => {
    // Es como se escribe en la práctica y como NO lo acepta WhatsApp.
    expect(aNumeroWhatsapp('03564 15 123456')).toBe('5493564123456');
  });

  it('acepta un número ya en formato internacional', () => {
    expect(aNumeroWhatsapp('+54 9 3564 123456')).toBe('5493564123456');
  });

  it('ignora paréntesis, guiones y espacios', () => {
    expect(aNumeroWhatsapp('(3564) 123-456')).toBe('5493564123456');
  });

  it('un número sin 0 ni 15 también funciona', () => {
    expect(aNumeroWhatsapp('3564123456')).toBe('5493564123456');
  });

  it('no duplica el 9 si ya venía', () => {
    expect(aNumeroWhatsapp('5493564123456')).toBe('5493564123456');
  });

  it.each([null, undefined, '', '   ', 'sin numero', '123'])('devuelve null para %p', (v) => {
    expect(aNumeroWhatsapp(v)).toBeNull();
  });

  it('rechaza algo demasiado largo para ser un teléfono', () => {
    expect(aNumeroWhatsapp('123456789012345')).toBeNull();
  });
});

describe('armarMensaje', () => {
  it('el asunto lleva el número de orden', () => {
    expect(armarMensaje(orden).asunto).toContain('OC-2026-0007');
  });

  it('el cuerpo lista los materiales con su cantidad y unidad', () => {
    expect(armarMensaje(orden).cuerpo).toContain('Cable 2.5mm — 100 m');
  });

  it('incluye el total y las observaciones', () => {
    const { cuerpo } = armarMensaje(orden);
    expect(cuerpo).toContain('125.050,00');
    expect(cuerpo).toContain('Entregar en portería');
  });

  it('avisa que el PDF va adjunto', () => {
    // El adjunto lo pone la persona: el mensaje tiene que dejarlo dicho.
    expect(armarMensaje(orden).cuerpo).toContain('adjunta');
  });

  it('una orden sin total ni observaciones no rompe', () => {
    const simple = { ...orden, total: null, observaciones: null };
    expect(armarMensaje(simple).cuerpo).toContain('Cable 2.5mm');
  });
});

describe('enlaceCorreo', () => {
  it('con correo del proveedor: va a él, con administración en copia', () => {
    const url = enlaceCorreo(orden, orden.proveedorEmail);
    expect(url.startsWith('mailto:ventas%40ferreteria.com.ar')).toBe(true);
    expect(url).toContain(`cc=${encodeURIComponent(MAIL_ADMINISTRACION_POR_DEFECTO)}`);
  });

  it('REGRESION: sin correo del proveedor, la orden igual va a administración', () => {
    // Si no, el envío se perdería del todo y no quedaría constancia interna.
    const url = enlaceCorreo(orden, null);
    expect(url.startsWith(`mailto:${encodeURIComponent(MAIL_ADMINISTRACION_POR_DEFECTO)}`)).toBe(true);
    expect(url).not.toContain('cc=');
  });

  it('un correo inválido se trata como si no hubiera', () => {
    const url = enlaceCorreo(orden, 'no-es-un-mail');
    expect(url.startsWith(`mailto:${encodeURIComponent(MAIL_ADMINISTRACION_POR_DEFECTO)}`)).toBe(true);
  });

  it('REGRESION: los espacios no quedan como "+" en el cuerpo', () => {
    // URLSearchParams codifica el espacio como "+", que en un mailto se ve
    // literalmente como "+" en vez de espacio.
    const url = enlaceCorreo(orden, orden.proveedorEmail);
    expect(url).not.toMatch(/body=[^&]*\+/);
    expect(url).toContain('%20');
  });

  it('lleva el asunto y el cuerpo', () => {
    const url = enlaceCorreo(orden, orden.proveedorEmail);
    expect(url).toContain('subject=');
    expect(url).toContain('body=');
    expect(decodeURIComponent(url)).toContain('OC-2026-0007');
  });
});

describe('enlaceWhatsapp', () => {
  it('arma el enlace con el número normalizado', () => {
    const url = enlaceWhatsapp(orden, '03564 15 123456');
    expect(url?.startsWith('https://wa.me/5493564123456?text=')).toBe(true);
  });

  it('el mensaje va en el enlace', () => {
    const url = enlaceWhatsapp(orden, '3564123456')!;
    expect(decodeURIComponent(url)).toContain('OC-2026-0007');
    expect(decodeURIComponent(url)).toContain('Cable 2.5mm');
  });

  it('REGRESION: sin teléfono usable devuelve null (no un enlace roto)', () => {
    expect(enlaceWhatsapp(orden, null)).toBeNull();
    expect(enlaceWhatsapp(orden, '')).toBeNull();
    expect(enlaceWhatsapp(orden, 'no tiene')).toBeNull();
  });
});

describe('el numero de administracion que manda el servidor', () => {
  // Ya no es una constante del frontend: viene de WHATSAPP_ADMINISTRACION en el
  // servidor, escrito como lo escribiria una persona. Lo que se prueba es que
  // ese formato se normalice, porque si no el boton lleva a un chat vacio.
  const COMO_LO_MANDA_EL_SERVIDOR = '+54 9 3534 40-3519';

  it('se normaliza bien', () => {
    expect(aNumeroWhatsapp(COMO_LO_MANDA_EL_SERVIDOR)).toBe('5493534403519');
  });

  it('arma un enlace valido con la orden', () => {
    const url = enlaceWhatsapp(orden, COMO_LO_MANDA_EL_SERVIDOR);
    expect(url?.startsWith('https://wa.me/5493534403519?text=')).toBe(true);
    expect(decodeURIComponent(url!)).toContain('OC-2026-0007');
  });

  it('si el servidor no lo tiene cargado, no se arma ningun enlace', () => {
    // `whatsappAdministracion` es null cuando falta la variable de entorno.
    expect(enlaceWhatsapp(orden, null)).toBeNull();
  });
});

describe('enlaceCorreo con la casilla que manda el servidor', () => {
  it('usa la casilla del servidor en vez de la de reserva', () => {
    // El valor bueno lo da /ordenes-compra/configuracion-envio: la constante
    // del frontend quedo solo como reserva.
    const url = enlaceCorreo(orden, 'proveedor@x.com', 'otra-casilla@empresa.com');
    expect(url).toContain(encodeURIComponent('otra-casilla@empresa.com'));
    expect(url).not.toContain(encodeURIComponent(MAIL_ADMINISTRACION_POR_DEFECTO));
  });

  it('sin dato del servidor cae en la de reserva', () => {
    const url = enlaceCorreo(orden, 'proveedor@x.com', null);
    expect(url).toContain(encodeURIComponent(MAIL_ADMINISTRACION_POR_DEFECTO));
  });
});
