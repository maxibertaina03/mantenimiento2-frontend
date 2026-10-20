import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mensajeAlTaller } from '@/lib/envioOrdenTrabajo';
import type { OrdenTrabajo } from '@/tipos/ordenTrabajo';
import { EnviarOrdenTrabajo } from './EnviarOrdenTrabajo';
import { VolvioDelTaller } from './VolvioDelTaller';

/** El tubo de oxígeno, afuera para llenarlo: mandarle la orden al taller y registrar la vuelta. */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {
    constructor(
      public statusCode: number,
      m: string,
    ) {
      super(m);
    }
  },
  ErrorServidorNoDisponible: class extends Error {},
}));

vi.mock('@/lib/pdfOrdenTrabajo', () => ({
  pdfOrdenTrabajoComoBase64: () => Promise.resolve('JVBERi0xLjQ='),
  descargarPdfOrdenTrabajo: () => Promise.resolve(),
}));

const TUBO = {
  id: 'ot-40',
  numero: 'OT-2026-0040',
  titulo: 'Llenar el tubo de oxígeno',
  descripcion: null,
  tipo: 'CORRECTIVO',
  estado: 'ABIERTA',
  equipoId: 'eq-tubo',
  equipoNombre: 'Tubo 1',
  equipoCodigo: null,
  equipoItId: null,
  equipoItNombre: null,
  equipoItCodigo: null,
  ejecutor: 'EXTERNO',
  proveedorId: 'prov-ox',
  proveedorNombre: 'Oxígeno Central',
  asignadoAId: 'u1',
} as OrdenTrabajo;

function envolver(nodo: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{nodo}</QueryClientProvider>;
}

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((ruta: string) => {
    if (ruta === '/proveedores/prov-ox')
      return Promise.resolve({
        id: 'prov-ox',
        nombre: 'Oxígeno Central',
        email: 'taller@oxigeno.com',
        telefono: '3564 15 400000',
      });
    if (ruta.endsWith('/envios')) return Promise.resolve([]);
    if (ruta.endsWith('/enviar-correo'))
      return Promise.resolve({ para: ['taller@oxigeno.com'], responderA: null });
    return Promise.resolve({});
  });
});

describe('EnviarOrdenTrabajo', () => {
  it('por correo: manda solo el PDF; el destinatario lo pone el servidor', async () => {
    const usuario = userEvent.setup();
    render(envolver(<EnviarOrdenTrabajo orden={TUBO} onCerrar={() => {}} />));

    const correo = await screen.findByRole('button', { name: 'Enviar por correo' });
    await waitFor(() => expect(correo).toBeEnabled());
    await usuario.click(correo);

    expect(await screen.findByText(/Orden enviada a taller@oxigeno.com/)).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith('/ordenes-trabajo/ot-40/enviar-correo', {
      method: 'POST',
      body: { pdfBase64: 'JVBERi0xLjQ=' },
    });
  });

  it('por WhatsApp: abre el chat con la orden escrita y deja la constancia', async () => {
    const usuario = userEvent.setup();
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(envolver(<EnviarOrdenTrabajo orden={TUBO} onCerrar={() => {}} />));

    const whatsapp = await screen.findByRole('button', { name: 'Mandar por WhatsApp' });
    await waitFor(() => expect(whatsapp).toBeEnabled());
    await usuario.click(whatsapp);

    const url = decodeURIComponent(String(abrir.mock.calls[0][0]));
    expect(url).toContain('https://wa.me/5493564400000');
    expect(url).toContain('Trabajo a realizar: Llenar el tubo de oxígeno');
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/ordenes-trabajo/ot-40/registrar-whatsapp', {
        method: 'POST',
        body: { numero: '5493564400000' },
      }),
    );
    abrir.mockRestore();
  });
});

describe('VolvioDelTaller', () => {
  it('cierra la orden con lo que hizo el taller, su remito y lo que cobró', async () => {
    const usuario = userEvent.setup();
    const onCerrar = vi.fn();
    render(envolver(<VolvioDelTaller orden={TUBO} onCerrar={onCerrar} />));

    const cerrar = screen.getByRole('button', { name: /volvió: cerrar la orden/i });
    expect(cerrar).toBeDisabled(); // sin decir qué hizo el taller

    await usuario.type(screen.getByLabelText(/qué le hizo el taller/i), 'Lo llenaron');
    await usuario.type(screen.getByLabelText(/remito o factura del taller/i), 'R-0001-00004930');
    await usuario.type(screen.getByLabelText(/lo que cobró/i), '18000');
    await usuario.click(cerrar);

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/ordenes-trabajo/ot-40/cerrar', {
        method: 'POST',
        body: {
          resolucion: 'Lo llenaron',
          comprobanteExterno: 'R-0001-00004930',
          costoManoObra: 18000,
        },
      }),
    );
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  });
});

describe('mensajeAlTaller', () => {
  it('dice qué equipo va, qué hay que hacerle y que el PDF va aparte', () => {
    const texto = mensajeAlTaller({
      ...TUBO,
      equipoCodigo: 'T-01',
      descripcion: 'Tubo de 6 m³',
    });
    expect(texto).toContain('Estimados de Oxígeno Central:');
    expect(texto).toContain('Equipo: Tubo 1 (T-01)');
    expect(texto).toContain('Trabajo a realizar: Llenar el tubo de oxígeno');
    expect(texto).toContain('Detalle: Tubo de 6 m³');
    expect(texto).toContain('Les mando la orden en PDF');
  });
});
