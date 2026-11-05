import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SolicitudesPage } from './SolicitudesPage';
import type { Solicitud } from '@/tipos/solicitud';

/**
 * Las solicitudes de trabajo: un sector carga y ve las suyas; mantenimiento
 * las revisa y genera la orden.
 */
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

const SOLICITUD: Solicitud = {
  id: 's1',
  numero: 'SOL-2026-0001',
  descripcion: 'Pierde agua la llave de la tina 2',
  sectorId: 'sec1',
  sectorNombre: 'Quesería',
  equipoId: 'eq1',
  equipoNombre: 'Tina 2',
  urgencia: 'URGENTE',
  estado: 'NUEVA',
  solicitadaPorId: 'u-sector',
  solicitadaPorNombre: 'Quesería turno mañana',
  creadoEn: '2026-11-05T10:00:00.000Z',
  revisadaPorId: null,
  revisadaPorNombre: null,
  revisadaEn: null,
  motivoRechazo: null,
  notaResolucion: null,
  resueltaEn: null,
  ordenTrabajoId: null,
  ordenTrabajoNumero: null,
  ordenTrabajoAsignadoANombre: null,
  fotos: [],
};

let permisos: string[] = [];

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((ruta: string, opciones?: { method?: string }) => {
    if (ruta.startsWith('/usuarios/me')) return Promise.resolve({ id: 'u1', nombre: 'Facundo' });
    if (ruta.startsWith('/permisos/mios')) return Promise.resolve({ rol: 'X', permisos });
    if (ruta === '/solicitudes/opciones') {
      return Promise.resolve({
        sectores: [{ id: 'sec1', nombre: 'Quesería', equipos: [{ id: 'eq1', nombre: 'Tina 2' }] }],
        miSectorId: 'sec1',
      });
    }
    if (ruta === '/ordenes-trabajo/asignables') {
      return Promise.resolve([{ id: 'u1', nombre: 'Facundo', puedeTrabajar: true }]);
    }
    if (ruta === '/solicitudes' && opciones?.method === 'POST') {
      return Promise.resolve({ ...SOLICITUD, id: 's2', numero: 'SOL-2026-0002' });
    }
    if (ruta === '/solicitudes') return Promise.resolve([SOLICITUD]);
    if (opciones?.method === 'POST') return Promise.resolve(SOLICITUD);
    return Promise.resolve([]);
  });
});

function abrir() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SolicitudesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const posts = () =>
  apiRequestMock.mock.calls.filter(([, o]) => (o as { method?: string })?.method === 'POST');

describe('SolicitudesPage', () => {
  it('un sector ve «Mis solicitudes», carga una nueva con su sector elegido', async () => {
    permisos = ['solicitudes.crear'];
    abrir();
    expect(await screen.findByRole('heading', { name: 'Mis solicitudes' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Nueva solicitud/ }));
    const enviar = await screen.findByRole('button', { name: /Enviar a mantenimiento/ });
    expect(enviar).toBeDisabled();
    await waitFor(() => expect(screen.getByLabelText('Sector')).toHaveValue('sec1'));
    await userEvent.type(screen.getByLabelText('¿Qué pasa?'), 'No arranca la cinta 3');
    await userEvent.click(screen.getByLabelText('Urgente / máquina parada'));
    await userEvent.click(enviar);

    await waitFor(() => expect(posts()).toHaveLength(1));
    const [ruta, { body }] = posts()[0] as [string, { body: Record<string, unknown> }];
    expect(ruta).toBe('/solicitudes');
    expect(body).toMatchObject({
      descripcion: 'No arranca la cinta 3',
      sectorId: 'sec1',
      urgencia: 'URGENTE',
      fotos: [],
    });
    expect(await screen.findByText(/SOL-2026-0002 le llegó a mantenimiento/)).toBeInTheDocument();
  });

  it('el sector abre la suya y no ve los botones de mantenimiento', async () => {
    permisos = ['solicitudes.crear'];
    abrir();
    await userEvent.click(await screen.findByText('Pierde agua la llave de la tina 2'));
    expect(await screen.findByText(/Solicitud SOL-2026-0001/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generar orden de trabajo/ })).not.toBeInTheDocument();
  });

  it('mantenimiento genera la orden de trabajo desde la solicitud', async () => {
    permisos = [
      'solicitudes.crear',
      'solicitudes.ver',
      'solicitudes.gestionar',
      'trabajos.editar',
    ];
    abrir();
    expect(
      await screen.findByRole('heading', { name: 'Solicitudes de trabajo' }),
    ).toBeInTheDocument();
    await userEvent.click(await screen.findByText('Pierde agua la llave de la tina 2'));
    await userEvent.click(await screen.findByRole('button', { name: /Generar orden de trabajo/ }));
    // Quien la revisa viene elegido para hacerla.
    await waitFor(() => expect(screen.getByLabelText('Quién la hace')).toHaveValue('u1'));
    await userEvent.click(screen.getByRole('button', { name: 'Generar la orden' }));

    await waitFor(() =>
      expect(posts().map(([r]) => r)).toEqual(['/solicitudes/s1/orden-trabajo']),
    );
    expect((posts()[0][1] as { body: unknown }).body).toEqual({
      titulo: 'Pierde agua la llave de la tina 2',
      asignadoAId: 'u1',
    });
  });

  it('rechazar pide el motivo', async () => {
    permisos = ['solicitudes.ver', 'solicitudes.gestionar'];
    abrir();
    await userEvent.click(await screen.findByText('Pierde agua la llave de la tina 2'));
    await userEvent.click(await screen.findByRole('button', { name: /Rechazar/ }));
    const confirmar = screen.getByRole('button', { name: 'Rechazar' });
    expect(confirmar).toBeDisabled();
    await userEvent.type(screen.getByLabelText('¿Por qué se rechaza?'), 'La ve sistemas');
    await userEvent.click(confirmar);
    await waitFor(() => expect(posts().map(([r]) => r)).toEqual(['/solicitudes/s1/rechazar']));
  });
});
