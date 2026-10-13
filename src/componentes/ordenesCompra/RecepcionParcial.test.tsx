import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrdenCompra, RenglonOrden } from '@/tipos/ordenCompra';
import { ReclamarFaltante } from './ReclamarFaltante';
import { RecibirMercaderia } from './RecibirMercaderia';

/**
 * Recibir una orden en partes, y reclamar lo que falta. El caso real: de la
 * OC-2026-0028 llegaron los artefactos y no los acrílicos.
 */
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

const renglon = (id: string, nombre: string, recibida = 0): RenglonOrden => ({
  id,
  materialId: `mat-${id}`,
  materialNombre: nombre,
  unidad: 'u',
  cantidad: 10,
  precioUnitario: null,
  subtotal: null,
  notas: null,
  movimientoId: null,
  descripcionEquipo: null,
  clasificacion: null,
  cantidadRecibida: recibida,
  pendiente: 10 - recibida,
});

const OC28 = {
  id: 'oc-28',
  numero: 'OC-2026-0028',
  estado: 'EMITIDA',
  proveedorId: 'prov-1',
  proveedorNombre: 'Ferrero Alfredo e Hijos',
  proveedorCuit: null,
  proveedorEmail: 'ventas@ferrero.com.ar',
  proveedorTelefono: '3564 15 123456',
  fecha: '2026-10-01T10:00:00.000Z',
  observaciones: null,
  creadoPorNombre: null,
  emitidaEn: null,
  recibidaEn: null,
  recibidaPorNombre: null,
  remito: null,
  factura: null,
  renglones: [
    renglon('art', 'Artefacto marea vacio para led 2x20'),
    renglon('acr', 'Repuesto acrilico p/marea 2x36w'),
  ],
  total: null,
  editable: false,
  recepciones: [],
  cerradaConFaltante: false,
  motivoFaltante: null,
  creadoEn: '2026-10-01T10:00:00.000Z',
} as OrdenCompra;

function envolver(nodo: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{nodo}</QueryClientProvider>;
}

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((ruta: string) => {
    if (ruta.endsWith('/configuracion-envio'))
      return Promise.resolve({
        mailAdministracion: null,
        whatsappAdministracion: null,
        correoConfigurado: true,
      });
    if (ruta.endsWith('/reclamar-correo'))
      return Promise.resolve({
        para: ['ventas@ferrero.com.ar'],
        copia: [],
        responderA: null,
        estado: 'RECIBIDA_PARCIAL',
      });
    return Promise.resolve({ ...OC28, estado: 'RECIBIDA_PARCIAL' });
  });
});

describe('RecibirMercaderia', () => {
  it('REGRESION: llegaron los artefactos y no los acrílicos: manda solo eso, y avisa que queda en parte', async () => {
    const usuario = userEvent.setup();
    const onListo = vi.fn();
    render(envolver(<RecibirMercaderia orden={OC28} onListo={onListo} onCancelar={() => {}} />));

    // Arranca en 0: se carga solo lo que vino.
    await usuario.type(screen.getByLabelText('Cuánto llegó de Artefacto marea vacio para led 2x20'), '10');
    await usuario.type(screen.getByLabelText('Nº de remito'), '0001-00045');

    expect(screen.getByText(/la orden queda «Recibida en parte»/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Confirmar y sumar al stock' }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/ordenes-compra/oc-28/recibir', {
        method: 'PATCH',
        body: {
          remito: '0001-00045',
          factura: undefined,
          renglones: [
            { renglonId: 'art', cantidad: 10 },
            { renglonId: 'acr', cantidad: 0 },
          ],
        },
      }),
    );
    await waitFor(() => expect(onListo).toHaveBeenCalled());
  });

  it('arranca en 0, sin nada precargado; si se carga todo, la orden queda finalizada', async () => {
    const usuario = userEvent.setup();
    render(envolver(<RecibirMercaderia orden={OC28} onListo={() => {}} onCancelar={() => {}} />));
    const artefacto = screen.getByLabelText('Cuánto llegó de Artefacto marea vacio para led 2x20');
    const acrilico = screen.getByLabelText('Cuánto llegó de Repuesto acrilico p/marea 2x36w');
    expect(artefacto).toHaveValue(null);
    expect(acrilico).toHaveValue(null);
    expect(screen.getByText(/Indicá qué llegó/)).toBeInTheDocument();

    await usuario.type(artefacto, '10');
    await usuario.type(acrilico, '10');
    expect(screen.getByText(/Llega todo: la orden queda finalizada/)).toBeInTheDocument();
  });

  it('no deja recibir más de lo que falta, ni sin comprobante', async () => {
    const usuario = userEvent.setup();
    render(envolver(<RecibirMercaderia orden={OC28} onListo={() => {}} onCancelar={() => {}} />));
    const confirmar = screen.getByRole('button', { name: 'Confirmar y sumar al stock' });

    expect(confirmar).toBeDisabled(); // sin nada cargado ni comprobante
    await usuario.type(screen.getByLabelText('Nº de factura'), 'A-1');
    expect(confirmar).toBeDisabled(); // con comprobante, pero no llegó nada
    await usuario.type(
      screen.getByLabelText('Cuánto llegó de Repuesto acrilico p/marea 2x36w'),
      '3',
    );
    expect(confirmar).toBeEnabled();

    const artefacto = screen.getByLabelText('Cuánto llegó de Artefacto marea vacio para led 2x20');
    await usuario.type(artefacto, '12');
    expect(screen.getByText(/no se puede recibir más de lo que se pidió/)).toBeInTheDocument();
    expect(confirmar).toBeDisabled();
  });
});

describe('ReclamarFaltante', () => {
  const parcial = {
    ...OC28,
    estado: 'RECIBIDA_PARCIAL',
    renglones: [
      renglon('art', 'Artefacto marea vacio para led 2x20', 10),
      renglon('acr', 'Repuesto acrilico p/marea 2x36w'),
    ],
  } as OrdenCompra;

  it('muestra solo lo que falta y lo reclama por correo', async () => {
    const usuario = userEvent.setup();
    render(envolver(<ReclamarFaltante orden={parcial} onCerrar={() => {}} />));

    expect(screen.getByRole('listitem')).toHaveTextContent('Repuesto acrilico p/marea 2x36w — 10 u');
    expect(screen.queryByText(/Artefacto marea/)).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: '✉ Reclamar por correo' }));

    expect(await screen.findByText(/Reclamo enviado a ventas@ferrero.com.ar/)).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith('/ordenes-compra/oc-28/reclamar-correo', {
      method: 'POST',
    });
  });

  it('por WhatsApp abre el chat con el reclamo escrito y lo registra', async () => {
    const usuario = userEvent.setup();
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(envolver(<ReclamarFaltante orden={parcial} onCerrar={() => {}} />));

    await usuario.click(screen.getByRole('button', { name: '💬 Reclamar por WhatsApp' }));

    const url = decodeURIComponent(String(abrir.mock.calls[0][0]));
    expect(url).toContain('todavía no recibimos');
    expect(url).toContain('• Repuesto acrilico p/marea 2x36w — 10 u');
    expect(url).not.toContain('Artefacto');
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/ordenes-compra/oc-28/reclamar-whatsapp',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    abrir.mockRestore();
  });
});
