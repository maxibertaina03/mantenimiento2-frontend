import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Equipo } from '@/tipos/equipo';
import type { Proveedor } from '@/tipos/proveedor';
import { MandarAServicioExterno } from './MandarAServicioExterno';

/** El caso real: el tubo de oxígeno se manda a llenar afuera. */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const pdfMock = vi.fn();
vi.mock('@/lib/pdfOrdenTrabajo', () => ({
  descargarPdfOrdenTrabajo: (...args: unknown[]) => pdfMock(...args),
}));

const OXIGENO = { id: 'prov-ox', nombre: 'Oxígeno Central' } as Proveedor;
vi.mock('./ComboProveedor', () => ({
  ComboProveedor: ({ onCambio }: { onCambio: (p: Proveedor | null) => void }) => (
    <button type="button" onClick={() => onCambio(OXIGENO)}>
      elegir proveedor
    </button>
  ),
}));

const TUBO = { id: 'eq-tubo', nombre: 'Tubo 1' } as Equipo;

function envolver(nodo: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{nodo}</QueryClientProvider>;
}

beforeEach(() => {
  apiRequestMock.mockReset();
  pdfMock.mockReset();
  apiRequestMock.mockImplementation((ruta: string) => {
    if (ruta === '/ordenes-trabajo')
      return Promise.resolve({
        id: 'ot-1',
        numero: 'OT-2026-0040',
        proveedorId: 'prov-ox',
        proveedorNombre: 'Oxígeno Central',
      });
    return Promise.resolve({ ...OXIGENO, telefono: '3564 400000' });
  });
});

describe('MandarAServicioExterno', () => {
  it('abre la orden para el proveedor, sobre el equipo, y baja el PDF para que viaje con él', async () => {
    const usuario = userEvent.setup();
    render(envolver(<MandarAServicioExterno equipo={TUBO} onCerrar={() => {}} />));

    const abrir = screen.getByRole('button', { name: /abrir orden e imprimir/i });
    expect(abrir).toBeDisabled();

    await usuario.click(screen.getByText('elegir proveedor'));
    await usuario.type(screen.getByLabelText(/qué hay que hacerle/i), 'Llenar el tubo');
    await usuario.click(abrir);

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/ordenes-trabajo', {
        method: 'POST',
        body: {
          titulo: 'Llenar el tubo',
          descripcion: undefined,
          tipo: 'CORRECTIVO',
          equipoId: 'eq-tubo',
          ejecutor: 'EXTERNO',
          proveedorId: 'prov-ox',
        },
      }),
    );
    expect(await screen.findByText('OT-2026-0040')).toBeInTheDocument();
    expect(pdfMock).toHaveBeenCalledWith(
      expect.objectContaining({ numero: 'OT-2026-0040' }),
      expect.objectContaining({
        equipo: TUBO,
        proveedor: expect.objectContaining({ id: 'prov-ox' }),
      }),
    );
  });

  it('sin proveedor o sin decir qué hacerle, no se puede abrir', async () => {
    const usuario = userEvent.setup();
    render(envolver(<MandarAServicioExterno equipo={TUBO} onCerrar={() => {}} />));
    const abrir = screen.getByRole('button', { name: /abrir orden e imprimir/i });

    await usuario.type(screen.getByLabelText(/qué hay que hacerle/i), 'Bobinado nuevo');
    expect(abrir).toBeDisabled();
    await usuario.click(screen.getByText('elegir proveedor'));
    expect(abrir).toBeEnabled();
  });
});
