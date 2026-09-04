import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdenesCompraPage } from './OrdenesCompraPage';

/**
 * La pantalla de órdenes de compra.
 *
 * Lo que estos tests protegen es que no queden dos ventanas abiertas a la vez:
 * la de envío se abre desde el detalle, y con las dos abiertas se apilaban una
 * encima de otra.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => {
  class ApiError extends Error {
    constructor(
      public readonly statusCode: number,
      mensaje: string,
    ) {
      super(mensaje);
    }
  }
  class ErrorServidorNoDisponible extends Error {}
  return {
    apiRequest: (...args: unknown[]) => apiRequestMock(...args),
    ApiError,
    ErrorServidorNoDisponible,
  };
});

vi.mock('@/lib/pdfOrdenCompra', () => ({
  descargarPdfOrdenCompra: vi.fn(),
  pdfOrdenComoBase64: async () => 'JVBERi0xLjQK',
}));

const orden = {
  id: 'oc-1',
  numero: 'OC-2026-0005',
  estado: 'EMITIDA',
  proveedorId: 'p-1',
  proveedorNombre: 'Proveedor de Prueba SRL',
  proveedorCuit: null,
  proveedorEmail: 'ventas@proveedor.com.ar',
  proveedorTelefono: '+54 9 3534 40-3519',
  fecha: '2026-09-04T14:05:00.000Z',
  observaciones: null,
  creadoPorNombre: null,
  emitidaEn: '2026-09-04T14:05:00.000Z',
  recibidaEn: null,
  recibidaPorNombre: null,
  remito: null,
  factura: null,
  renglones: [
    {
      id: 'r1',
      materialId: 'm1',
      materialNombre: 'Aceite hidráulico ISO 68',
      unidad: 'lt',
      cantidad: 15,
      precioUnitario: 1850,
      subtotal: 27750,
      notas: null,
      movimientoId: null,
    },
  ],
  total: 27750,
  editable: false,
  creadoEn: '2026-09-04T14:05:00.000Z',
};

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((rutaCruda: string) => {
    const ruta = String(rutaCruda ?? '');
    if (ruta.startsWith('/usuarios/me')) {
      return Promise.resolve({ id: 'u1', nombre: 'Máximo', rol: 'ADMIN' });
    }
    if (ruta.endsWith('/configuracion-envio')) {
      return Promise.resolve({
        mailAdministracion: 'administracion@lacteoslastres.com.ar',
        whatsappAdministracion: '+54 9 3534 40-3519',
        correoConfigurado: true,
      });
    }
    if (ruta.endsWith('/envios')) return Promise.resolve([]);
    if (ruta.startsWith('/ordenes-compra')) {
      return Promise.resolve({ datos: [orden], total: 1, pagina: 1, limite: 20 });
    }
    return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
  });
});

function mostrar() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const nodo: ReactNode = (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OrdenesCompraPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(nodo);
}

describe('OrdenesCompraPage — una sola ventana a la vez', () => {
  it('REGRESION: al enviar, el detalle se cierra', async () => {
    // Con las dos abiertas quedaban apiladas, y cual tapaba a cual dependia del
    // orden en el JSX y no de lo que la persona acababa de tocar: el boton
    // parecia no hacer nada.
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /^ver$/i }));
    expect(await screen.findByRole('heading', { name: /Orden OC-2026-0005/ })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /enviar al proveedor/i }));

    // Queda la de envío, y la de detalle ya no está.
    expect(await screen.findByRole('heading', { name: /Enviar OC-2026-0005/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /^Orden OC-2026-0005/ })).not.toBeInTheDocument(),
    );
  });

  it('a un operario no se le ofrece enviar', async () => {
    // El envío automático sigue en prueba: un operario descarga el PDF y listo.
    apiRequestMock.mockImplementation((rutaCruda: string) => {
      const ruta = String(rutaCruda ?? '');
      if (ruta.startsWith('/usuarios/me')) {
        return Promise.resolve({ id: 'u2', nombre: 'Operario', rol: 'OPERARIO' });
      }
      if (ruta.startsWith('/ordenes-compra')) {
        return Promise.resolve({ datos: [orden], total: 1, pagina: 1, limite: 20 });
      }
      return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
    });
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /^ver$/i }));
    await screen.findByRole('heading', { name: /Orden OC-2026-0005/ });

    expect(screen.queryByRole('button', { name: /enviar al proveedor/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar pdf/i })).toBeInTheDocument();
  });
});
