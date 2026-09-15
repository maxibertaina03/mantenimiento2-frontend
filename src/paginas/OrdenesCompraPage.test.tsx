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

/** Dos materiales con etiqueta QR pegada, para escanear. */
const RETEN = '1e035e68-e43f-4776-9706-3e64fcd3fe33';
const BUJE = '2a17bc90-11d2-4e5a-8c31-9f0b7d4e6a12';
const BASE_QR = 'https://mantenimiento2-frontend.vercel.app';

const DEPOSITO: Record<string, { id: string; nombre: string; unidad: string }> = {
  [RETEN]: { id: RETEN, nombre: 'Reten 40x72x10', unidad: 'u' },
  [BUJE]: { id: BUJE, nombre: 'Buje bronce 25mm', unidad: 'u' },
};

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((rutaCruda: string) => {
    const ruta = String(rutaCruda ?? '');
    if (ruta.startsWith('/usuarios/me')) {
      return Promise.resolve({ id: 'u1', nombre: 'Máximo', rol: 'ADMIN' });
    }
    if (ruta.startsWith('/permisos/mios')) {
      return Promise.resolve({
        rol: 'ADMIN',
        permisos: ['ordenes.ver', 'ordenes.editar', 'ordenes.recibir', 'ordenes.enviar'],
      });
    }
    if (ruta.endsWith('/configuracion-envio')) {
      return Promise.resolve({
        mailAdministracion: 'administracion@lacteoslastres.com.ar',
        whatsappAdministracion: '+54 9 3534 40-3519',
        correoConfigurado: true,
      });
    }
    if (ruta.endsWith('/envios')) return Promise.resolve([]);
    const porId = /^\/materiales\/([0-9a-f-]{36})$/.exec(ruta);
    if (porId) return Promise.resolve(DEPOSITO[porId[1]] ?? null);
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

  it('sin el permiso de enviar, no se ofrece el envio', async () => {
    // Mandar la orden a un tercero desde la casilla de la empresa es un permiso
    // aparte de prepararla. Quien no lo tenga descarga el PDF y la manda por su
    // cuenta, que es el flujo de siempre.
    apiRequestMock.mockImplementation((rutaCruda: string) => {
      const ruta = String(rutaCruda ?? '');
      if (ruta.startsWith('/usuarios/me')) {
        return Promise.resolve({ id: 'u2', nombre: 'Operario', rol: 'MANTENIMIENTO' });
      }
      if (ruta.startsWith('/permisos/mios')) {
        return Promise.resolve({
          rol: 'MANTENIMIENTO',
          permisos: ['ordenes.ver', 'ordenes.editar', 'ordenes.recibir'],
        });
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

describe('OrdenesCompraPage — cargar con la pistola', () => {
  /** Un escaneo: para el navegador, la direccion aparece escrita de una. */
  const escanear = async (usuario: ReturnType<typeof userEvent.setup>, id: string) => {
    const campo = screen.getByPlaceholderText(/Buscar material/i);
    await usuario.click(campo);
    await usuario.paste(`${BASE_QR}/materiales/${id}`);
  };

  const abrirAlta = async (usuario: ReturnType<typeof userEvent.setup>) => {
    mostrar();
    await usuario.click(await screen.findByRole('button', { name: /nueva orden/i }));
    await screen.findByRole('heading', { name: /Nueva orden de compra/i });
  };

  it('escanear varios seguidos los va agregando, sin cantidad', async () => {
    // Es el flujo que se pidio: pasar las etiquetas de corrido con la pistola y
    // sentarse despues a poner cuanto se compra de cada una.
    const usuario = userEvent.setup();
    await abrirAlta(usuario);

    await escanear(usuario, RETEN);
    expect(await screen.findByText('Reten 40x72x10')).toBeInTheDocument();

    await escanear(usuario, BUJE);
    expect(await screen.findByText('Buje bronce 25mm')).toBeInTheDocument();

    // Los dos entraron sin cantidad, esperando que alguien la cargue.
    expect(screen.getByLabelText('Cantidad de Reten 40x72x10')).toHaveValue(null);
    expect(screen.getByLabelText('Cantidad de Buje bronce 25mm')).toHaveValue(null);
  });

  it('REGRESION: no se puede crear la orden con renglones sin cantidad', async () => {
    // El backend los rechaza igual, pero el error llegaria recien al guardar,
    // con la orden entera cargada y sin decir cual renglon es.
    const usuario = userEvent.setup();
    await abrirAlta(usuario);

    await escanear(usuario, RETEN);
    await screen.findByText('Reten 40x72x10');

    expect(await screen.findByText(/Falta la cantidad de/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear orden/i })).toBeDisabled();

    await usuario.type(screen.getByLabelText('Cantidad de Reten 40x72x10'), '4');

    await waitFor(() =>
      expect(screen.queryByText(/Falta la cantidad de/i)).not.toBeInTheDocument(),
    );
  });

  it('REGRESION: escanear dos veces la misma etiqueta no duplica el renglon', async () => {
    // Un doble disparo de la pistola sobre la misma caja es lo mas comun que
    // va a pasar, y el backend rechaza el mismo material dos veces en la orden.
    const usuario = userEvent.setup();
    await abrirAlta(usuario);

    await escanear(usuario, RETEN);
    await screen.findByText('Reten 40x72x10');
    await escanear(usuario, RETEN);

    expect(await screen.findByText(/ya estaba en la orden/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Cantidad de Reten 40x72x10/)).toHaveLength(1);
  });

  it('avisa cuando lo que se escaneo no es un material', async () => {
    const usuario = userEvent.setup();
    await abrirAlta(usuario);

    const campo = screen.getByPlaceholderText(/Buscar material/i);
    await usuario.click(campo);
    await usuario.paste(`${BASE_QR}/equipos?equipo=${RETEN}`);

    expect(await screen.findByText(/es de un equipo/i)).toBeInTheDocument();
  });
});
