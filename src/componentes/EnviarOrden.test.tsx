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

beforeEach(() => {
  apiRequestMock.mockReset();
  descargarMock.mockReset();
  apiRequestMock.mockResolvedValue({
    para: ['ventas@ferreteria.com.ar'],
    copia: ['administracion@lacteoslastres.com.ar'],
    responderA: 'mantenimiento@lacteoslastres.com.ar',
  });
});

describe('EnviarOrden — correo automático', () => {
  it('REGRESION: manda SOLO el PDF, no los destinatarios', async () => {
    // Si el navegador pudiera elegir a quien se le manda, cualquiera con una
    // sesion podria usar la casilla de la empresa para escribirle a cualquiera.
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(screen.getByRole('button', { name: /enviar por correo/i }));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalled());
    const [ruta, opciones] = apiRequestMock.mock.calls[0];
    expect(ruta).toBe('/ordenes-compra/oc-1/enviar-correo');
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
    apiRequestMock.mockRejectedValue(new ApiError(503, 'SMTP no configurado'));
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(screen.getByRole('button', { name: /enviar por correo/i }));

    expect(await screen.findByRole('link', { name: /abrir mi correo/i })).toBeInTheDocument();
    expect(screen.getByText(/no está configurado/i)).toBeInTheDocument();
  });

  it('un error que NO es 503 se muestra, sin caer al modo manual', async () => {
    apiRequestMock.mockRejectedValue(new ApiError(500, 'Gmail rechazo el envio'));
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(screen.getByRole('button', { name: /enviar por correo/i }));

    expect(await screen.findByText(/Gmail rechazo el envio/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /abrir mi correo/i })).not.toBeInTheDocument();
  });
});

describe('EnviarOrden — WhatsApp', () => {
  it('el boton de administracion apunta al numero de la empresa', () => {
    abrir();
    const enlace = screen.getByRole('link', { name: /a administración/i });
    expect(enlace).toHaveAttribute('href', expect.stringContaining('wa.me/5493534403519'));
  });

  it('el boton del proveedor usa el telefono de su ficha', () => {
    abrir();
    const enlace = screen.getByRole('link', { name: /al proveedor/i });
    expect(enlace).toHaveAttribute('href', expect.stringContaining('wa.me/5493564123456'));
  });

  it('REGRESION: sin telefono usable, el boton queda deshabilitado y explica por que', () => {
    // Antes que un enlace roto que abre un chat vacio sin avisar.
    abrir({ ...orden, proveedorTelefono: 'no tiene' });
    expect(screen.getByRole('button', { name: /al proveedor/i })).toBeDisabled();
    expect(screen.getByText(/no parece un número de celular/i)).toBeInTheDocument();
  });

  it('avisa que el PDF de WhatsApp se adjunta a mano', () => {
    abrir();
    expect(screen.getByText(/hay que adjuntarlo a mano/i)).toBeInTheDocument();
  });

  it('se puede volver a descargar el PDF', async () => {
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(screen.getByRole('button', { name: /descargar el pdf/i }));
    expect(descargarMock).toHaveBeenCalledWith(orden);
  });
});
