import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceATaller } from './ServiceATaller';
import type { PlanQueVence } from '@/tipos/equipo';

/** Mandar un service a un taller abre una orden preventiva, del plan, con el taller. */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => {
  class ApiError extends Error {}
  class ErrorServidorNoDisponible extends Error {}
  return {
    apiRequest: (...args: unknown[]) => apiRequestMock(...args),
    ApiError,
    ErrorServidorNoDisponible,
  };
});

const PLAN = {
  id: 'plan-1',
  equipoId: 'eq-1',
  equipoNombre: 'Compresor 1',
  nombre: 'Service 2000 h',
  tareas: 'Cambio de aceite y filtros',
} as unknown as PlanQueVence;

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((ruta: string, opciones?: { method?: string }) => {
    if (ruta.startsWith('/usuarios/me')) return Promise.resolve({ id: 'u1', nombre: 'Facundo' });
    if (ruta === '/ordenes-trabajo/asignables') {
      return Promise.resolve([{ id: 'u1', nombre: 'Facundo', puedeTrabajar: true }]);
    }
    if (ruta === '/proveedores') {
      return Promise.resolve({
        datos: [{ id: 'prov-1', nombre: 'Compresores del Centro' }],
        total: 1,
        pagina: 1,
        limite: 20,
      });
    }
    if (ruta === '/ordenes-trabajo' && opciones?.method === 'POST') {
      return Promise.resolve({ id: 'ot-1' });
    }
    return Promise.resolve([]);
  });
});

describe('ServiceATaller', () => {
  it('abre la orden preventiva del plan, al taller, y avisa cuál es', async () => {
    const onListo = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ServiceATaller plan={PLAN} onListo={onListo} onCerrar={() => {}} />
      </QueryClientProvider>,
    );

    const mandar = screen.getByRole('button', { name: /Mandar al taller/ });
    expect(mandar).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/¿A qué taller va?/), 'Compres');
    await userEvent.click(await screen.findByText('Compresores del Centro'));
    await waitFor(() => expect(screen.getByLabelText('Quién lo sigue')).toHaveValue('u1'));
    await userEvent.click(mandar);

    await waitFor(() => expect(onListo).toHaveBeenCalledWith('ot-1'));
    const [, { body }] = apiRequestMock.mock.calls.find(
      ([r, o]) => r === '/ordenes-trabajo' && (o as { method?: string })?.method === 'POST',
    ) as [string, { body: unknown }];
    expect(body).toEqual({
      titulo: 'Service 2000 h',
      descripcion: 'Cambio de aceite y filtros',
      tipo: 'PREVENTIVO',
      equipoId: 'eq-1',
      planId: 'plan-1',
      ejecutor: 'EXTERNO',
      proveedorId: 'prov-1',
      asignadoAId: 'u1',
    });
  });
});
