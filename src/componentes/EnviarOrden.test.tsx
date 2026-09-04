import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { EnviarOrden } from './EnviarOrden';
import type { OrdenCompra } from '@/tipos/ordenCompra';

/**
 * El envío por correo lo hace el servidor con el PDF adjunto. Lo que estos
 * tests protegen es que el navegador mande SOLO el PDF (no los destinatarios) y
 * que, si el servidor no tiene SMTP, la pantalla no deje a nadie sin poder
 * mandar la orden.
 */
const apiRequestMock = vi.fn();
// La clase va DENTRO del factory: vi.mock se iza sobre los imports, y una clase
// declarada afuera todavia estaria en zona muerta cuando el factory corre.
vi.mock('@/lib/apiClient', () => {
  class ApiError extends Error {
    constructor(
      public readonly statusCode: number,
      mensaje: string,
    ) {
      super(mensaje);
      this.name = 'ApiError';
    }
  }
  // MensajeError hace `instanceof ErrorServidorNoDisponible`: si el mock no lo
  // exporta, el instanceof revienta y el componente no renderiza nada.
  class ErrorServidorNoDisponible extends Error {}
  return {
    apiRequest: (...args: unknown[]) => apiRequestMock(...args),
    ApiError,
    ErrorServidorNoDisponible,
  };
});

const descargarMock = vi.fn();
vi.mock('@/lib/pdfOrdenCompra', () => ({
  descargarPdfOrdenCompra: (...args: unknown[]) => descargarMock(...args),
  pdfOrdenComoBase64: async () => 'JVBERi0xLjQK',
}));

const orden = {
  id: 'oc-1',
  numero: 'OC-2026-0007',
  estado: 'EMITIDA',
  proveedorId: 'p-1',
  proveedorNombre: 'Ferretería Central',
  proveedorCuit: '30-12345678-9',
  proveedorEmail: 'ventas@ferreteria.com.ar',
  proveedorTelefono: '3564 15 123456',
  fecha: '2026-08-28T10:00:00.000Z',
  observaciones: null,
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
      precioUnitario: 10,
      subtotal: 1000,
      notas: null,
      movimientoId: null,
    },
  ],
  total: 1000,
  editable: false,
  creadoEn: '2026-08-28T10:00:00.000Z',
} as OrdenCompra;

function envolver(nodo: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{nodo}</QueryClientProvider>;
}

const abrir = (o: OrdenCompra = orden) =>
  render(envolver(<EnviarOrden orden={o} onCerrar={() => {}} />));

const RESULTADO_ENVIO = {
  para: ['ventas@ferreteria.com.ar'],
  copia: ['administracion@lacteoslastres.com.ar'],
  responderA: 'mantenimiento@lacteoslastres.com.ar',
  estado: 'EMITIDA',
};

/** La respuesta de cada ruta. `envios` arranca vacio salvo que se pida otra cosa. */
function servidor(opciones: { envios?: unknown[]; whatsappAdmin?: string | null } = {}) {
  apiRequestMock.mockImplementation((rutaCruda: string) => {
    const ruta = String(rutaCruda ?? '');
    if (ruta.endsWith('/configuracion-envio')) {
      return Promise.resolve({
        mailAdministracion: 'administracion@lacteoslastres.com.ar',
        whatsappAdministracion:
          opciones.whatsappAdmin === undefined ? '+54 9 3534 40-3519' : opciones.whatsappAdmin,
        correoConfigurado: true,
      });
    }
    if (ruta.endsWith('/envios')) return Promise.resolve(opciones.envios ?? []);
    return Promise.resolve(RESULTADO_ENVIO);
  });
}

/** El envio por correo, entre todas las llamadas que hace la pantalla. */
const llamadaDeEnvio = () =>
  apiRequestMock.mock.calls.find(([ruta]) => String(ruta).endsWith('/enviar-correo'));

const abrirMock = vi.fn();

beforeEach(() => {
  apiRequestMock.mockReset();
  descargarMock.mockReset();
  abrirMock.mockReset();
  vi.stubGlobal('open', abrirMock);
  servidor();
});

describe('EnviarOrden — correo automático', () => {
  it('REGRESION: manda SOLO el PDF, no los destinatarios', async () => {
    // Si el navegador pudiera elegir a quien se le manda, cualquiera con una
    // sesion podria usar la casilla de la empresa para escribirle a cualquiera.
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(screen.getByRole('button', { name: /enviar por correo/i }));

    await waitFor(() => expect(llamadaDeEnvio()).toBeDefined());
    const [, opciones] = llamadaDeEnvio()!;
    expect(Object.keys(opciones.body)).toEqual(['pdfBase64']);
  });

  it('confirma a quien se envio', async () => {
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(screen.getByRole('button', { name: /enviar por correo/i }));

    expect(await screen.findByText(/orden enviada/i)).toBeInTheDocument();
    expect(screen.getByText(/ventas@ferreteria.com.ar/)).toBeInTheDocument();
    expect(screen.getByText(/administracion@lacteoslastres.com.ar/)).toBeInTheDocument();
  });

  it('avisa que la orden va a administracion si el proveedor no tiene correo', () => {
    abrir({ ...orden, proveedorEmail: null });
    expect(screen.getByText(/no tiene correo cargado/i)).toBeInTheDocument();
  });

  it('REGRESION: si el servidor no tiene SMTP, ofrece mandarla a mano', async () => {
    // El 503 no es un fallo del usuario ni algo para reintentar: sin esta
    // salida, quedaria sin poder mandar la orden.
    servidor();
    const original = apiRequestMock.getMockImplementation()!;
    apiRequestMock.mockImplementation((ruta: string, ...resto: unknown[]) =>
      String(ruta).endsWith('/enviar-correo')
        ? Promise.reject(new ApiError(503, 'SMTP no configurado'))
        : original(ruta, ...resto),
    );
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(screen.getByRole('button', { name: /enviar por correo/i }));

    expect(await screen.findByRole('link', { name: /abrir mi correo/i })).toBeInTheDocument();
    expect(screen.getByText(/no está configurado/i)).toBeInTheDocument();
  });

  it('un error que NO es 503 se muestra, sin caer al modo manual', async () => {
    servidor();
    const original = apiRequestMock.getMockImplementation()!;
    apiRequestMock.mockImplementation((ruta: string, ...resto: unknown[]) =>
      String(ruta).endsWith('/enviar-correo')
        ? Promise.reject(new ApiError(500, 'Gmail rechazo el envio'))
        : original(ruta, ...resto),
    );
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(screen.getByRole('button', { name: /enviar por correo/i }));

    expect(await screen.findByText(/Gmail rechazo el envio/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /abrir mi correo/i })).not.toBeInTheDocument();
  });
});

describe('EnviarOrden — WhatsApp', () => {
  it('el boton del proveedor abre el chat con el telefono de su ficha', async () => {
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(await screen.findByRole('button', { name: /al proveedor/i }));

    expect(abrirMock).toHaveBeenCalledWith(
      expect.stringContaining('wa.me/5493564123456'),
      '_blank',
      expect.anything(),
    );
  });

  it('el boton de administracion usa el numero que manda el servidor', async () => {
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(await screen.findByRole('button', { name: /a administración/i }));

    expect(abrirMock).toHaveBeenCalledWith(
      expect.stringContaining('wa.me/5493534403519'),
      '_blank',
      expect.anything(),
    );
  });

  it('REGRESION: abrir el chat deja constancia del envio', async () => {
    // Sin esto la orden queda en BORRADOR y editable despues de que el
    // proveedor la recibio, y "¿ya se la mandamos?" no tiene respuesta.
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(await screen.findByRole('button', { name: /al proveedor/i }));

    await waitFor(() => {
      const registro = apiRequestMock.mock.calls.find(([r]) =>
        String(r).endsWith('/registrar-whatsapp'),
      );
      expect(registro).toBeDefined();
      expect(registro![1].body).toEqual({ numero: '5493564123456' });
    });
  });

  it('REGRESION: si no se puede registrar, el chat se abre igual', async () => {
    // El chat ya se abrio antes de que el registro fallara: frenar a la persona
    // por eso no arregla nada y le impide mandar la orden.
    servidor();
    const original = apiRequestMock.getMockImplementation()!;
    apiRequestMock.mockImplementation((ruta: string, ...resto: unknown[]) =>
      String(ruta).endsWith('/registrar-whatsapp')
        ? Promise.reject(new ApiError(500, 'se cayo la base'))
        : original(ruta, ...resto),
    );
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(await screen.findByRole('button', { name: /al proveedor/i }));

    expect(abrirMock).toHaveBeenCalled();
  });

  it('sin numero de administracion cargado, ese boton no aparece', async () => {
    // `whatsappAdministracion` es null cuando falta la variable en el servidor.
    servidor({ whatsappAdmin: null });
    abrir();

    expect(await screen.findByRole('button', { name: /al proveedor/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /a administración/i })).not.toBeInTheDocument();
  });

  it('REGRESION: sin telefono usable, el boton queda deshabilitado y explica por que', () => {
    // Antes que un enlace roto que abre un chat vacio sin avisar.
    abrir({ ...orden, proveedorTelefono: 'no tiene' });
    expect(screen.getByRole('button', { name: /al proveedor/i })).toBeDisabled();
    expect(screen.getByText(/no parece un número de celular/i)).toBeInTheDocument();
  });

  it('avisa que el PDF de WhatsApp se adjunta a mano', () => {
    abrir();
    expect(screen.getByText(/adjuntá el PDF/i)).toBeInTheDocument();
  });

  it('se puede volver a descargar el PDF', async () => {
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(screen.getByRole('button', { name: /descargar el pdf/i }));
    expect(descargarMock).toHaveBeenCalledWith(orden);
  });
});

describe('EnviarOrden — constancia de lo ya enviado', () => {
  it('muestra por donde salio la orden y cuando', async () => {
    // Sin esto, "¿ya se la mandamos a Ferretería Central?" solo se contesta
    // buscando en la casilla de quien la haya mandado.
    servidor({
      envios: [
        {
          id: 'e1',
          via: 'CORREO',
          destinatarios: 'ventas@ferreteria.com.ar',
          automatico: true,
          enviadoEn: '2026-09-04T13:00:00.000Z',
          usuarioNombre: 'Máximo',
        },
      ],
    });
    abrir();

    const historial = await screen.findByRole('list');
    expect(historial).toHaveTextContent('ventas@ferreteria.com.ar');
    expect(historial).toHaveTextContent('Máximo');
  });

  it('distingue lo que mando el sistema de lo que mando una persona', async () => {
    // WhatsApp no sale solo: marcarlo igual que el correo haria leer el
    // registro como una confirmacion de entrega, que no lo es.
    servidor({
      envios: [
        {
          id: 'e2',
          via: 'WHATSAPP',
          destinatarios: '5493564123456',
          automatico: false,
          enviadoEn: '2026-09-04T13:00:00.000Z',
          usuarioNombre: null,
        },
      ],
    });
    abrir();

    expect(await screen.findByText(/\(a mano\)/)).toBeInTheDocument();
  });

  it('sin envios previos no muestra la seccion', async () => {
    servidor({ envios: [] });
    abrir();

    await screen.findByRole('button', { name: /al proveedor/i });
    expect(screen.queryByText(/ya se mandó/i)).not.toBeInTheDocument();
  });
});

describe('EnviarOrden — cargar el contacto del proveedor', () => {
  it('ofrece cargar el correo cuando falta', async () => {
    // De los 1067 proveedores, 6 tienen correo. El momento en que alguien se
    // entera de que falta es este, asi que es aca donde tiene que cargarlo.
    abrir({ ...orden, proveedorEmail: null, proveedorTelefono: null });

    expect(
      await screen.findByRole('button', { name: /cargar correo o teléfono/i }),
    ).toBeInTheDocument();
  });

  it('con el contacto cargado ofrece corregirlo, no cargarlo', async () => {
    abrir();
    expect(await screen.findByRole('button', { name: /corregir el contacto/i })).toBeInTheDocument();
  });

  it('guarda el correo en la ficha del proveedor', async () => {
    const usuario = userEvent.setup();
    abrir({ ...orden, proveedorEmail: null, proveedorTelefono: null });
    await usuario.click(await screen.findByRole('button', { name: /cargar correo/i }));
    await usuario.type(
      screen.getByPlaceholderText('compras@proveedor.com.ar'),
      'compras@ferreteria.com.ar',
    );
    await usuario.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => {
      const guardado = apiRequestMock.mock.calls.find(([r]) => String(r).startsWith('/proveedores/'));
      expect(guardado).toBeDefined();
      expect(guardado![1].body.email).toBe('compras@ferreteria.com.ar');
    });
  });

  it('REGRESION: no deja guardar un correo que no es un correo', async () => {
    // Guardarlo haria que la orden rebote sin que nadie se entere.
    const usuario = userEvent.setup();
    abrir({ ...orden, proveedorEmail: null, proveedorTelefono: null });
    await usuario.click(await screen.findByRole('button', { name: /cargar correo/i }));
    await usuario.type(screen.getByPlaceholderText('compras@proveedor.com.ar'), 'esto-no-es');

    expect(screen.getByRole('button', { name: /^guardar$/i })).toBeDisabled();
    expect(screen.getByText(/no parece una dirección/i)).toBeInTheDocument();
  });
});

describe('EnviarOrden — sin copia interna configurada', () => {
  /**
   * Hoy la copia interna esta apagada: el servidor de correo de la empresa
   * rechaza todo lo que sale por Brevo con 550 Blacklisted [France, Europe],
   * asi que rebotaba siempre. La constancia la da la lista de envios.
   */
  const sinCopiaInterna = (envios: unknown[] = []) => {
    apiRequestMock.mockImplementation((rutaCruda: string) => {
      const ruta = String(rutaCruda ?? '');
      if (ruta.endsWith('/configuracion-envio')) {
        return Promise.resolve({
          mailAdministracion: null,
          whatsappAdministracion: '+54 9 3534 40-3519',
          correoConfigurado: true,
        });
      }
      if (ruta.endsWith('/envios')) return Promise.resolve(envios);
      return Promise.resolve({ ...RESULTADO_ENVIO, copia: [] });
    });
  };

  it('no promete una copia interna que no existe', async () => {
    sinCopiaInterna();
    abrir();

    await screen.findByRole('button', { name: /al proveedor/i });
    expect(screen.queryByText(/copia interna/i)).not.toBeInTheDocument();
  });

  it('con correo del proveedor, se puede mandar igual', async () => {
    sinCopiaInterna();
    abrir();

    expect(await screen.findByRole('button', { name: /enviar por correo/i })).toBeEnabled();
  });

  it('REGRESION: sin correo del proveedor tampoco, no ofrece mandar a la nada', async () => {
    // Mandar un correo sin destinatario no falla: simplemente no le llega a
    // nadie, y la orden quedaria marcada como enviada.
    sinCopiaInterna();
    abrir({ ...orden, proveedorEmail: null });

    expect(await screen.findByRole('button', { name: /enviar por correo/i })).toBeDisabled();
    expect(screen.getByText(/no hay a dónde mandarla/i)).toBeInTheDocument();
  });

  it('y ahi manda a cargar el correo o usar WhatsApp', async () => {
    sinCopiaInterna();
    abrir({ ...orden, proveedorEmail: null });

    expect(await screen.findByText(/mandásela por WhatsApp/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /al proveedor/i })).toBeEnabled();
  });
});
