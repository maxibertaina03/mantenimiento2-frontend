import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tarea } from '@/tipos/tarea';
import { MisTareasDeHoy } from './MisTareasDeHoy';
import { PostergarTarea } from './PostergarTarea';

/** Postergar: solo lo que no venció, con el día nuevo y el motivo. */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const tarea = (cambios: Partial<Tarea> = {}): Tarea => ({
  id: 't-1',
  titulo: 'Limpieza de tina',
  descripcion: null,
  fecha: '2099-10-10T00:00:00.000Z',
  fechaOriginal: null,
  estado: 'PENDIENTE',
  asignadoAId: null,
  asignadoANombre: null,
  equipoId: 'tina-2',
  equipoNombre: 'Tina 2',
  equipoItId: null,
  equipoItNombre: null,
  planId: 'plan-1',
  planNombre: 'Limpieza',
  rutinaId: null,
  rutinaTitulo: null,
  ordenTrabajoId: null,
  ordenTrabajoNumero: null,
  creadaPorId: null,
  creadoEn: '2026-10-01T00:00:00.000Z',
  ...cambios,
});

function envolver(nodo: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{nodo}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('PostergarTarea', () => {
  it('manda el día nuevo y el motivo', async () => {
    apiRequestMock.mockResolvedValue(tarea());
    const usuario = userEvent.setup();
    const onCerrar = vi.fn();
    render(envolver(<PostergarTarea tarea={tarea()} onCerrar={onCerrar} />));

    const postergar = screen.getByRole('button', { name: 'Postergar' });
    expect(postergar).toBeDisabled(); // sin motivo
    // Arranca en el día siguiente al que tocaba.
    expect(screen.getByLabelText(/para qué día/i)).toHaveValue('2099-10-11');

    await usuario.type(screen.getByLabelText(/por qué/i), 'Falta el repuesto');
    await usuario.click(postergar);

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/calendario/t-1/postergar', {
        method: 'POST',
        body: { fecha: '2099-10-11', motivo: 'Falta el repuesto' },
      }),
    );
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  });

  it('si el servidor dice que se pasó del límite, lo muestra y no cierra', async () => {
    apiRequestMock.mockRejectedValue(
      new Error('Se puede postergar hasta antes del 24/10/2099, que es cuando vuelve a tocar.'),
    );
    const usuario = userEvent.setup();
    const onCerrar = vi.fn();
    render(envolver(<PostergarTarea tarea={tarea()} onCerrar={onCerrar} />));

    await usuario.type(screen.getByLabelText(/por qué/i), 'Mucho después');
    await usuario.click(screen.getByRole('button', { name: 'Postergar' }));

    expect(await screen.findByText(/hasta antes del 24\/10\/2099/)).toBeInTheDocument();
    expect(onCerrar).not.toHaveBeenCalled();
  });
});

describe('Hoy: postergar solo lo que no venció', () => {
  it('la que todavía no venció ofrece postergar; la vencida, no', async () => {
    apiRequestMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/permisos/mios')) {
        return Promise.resolve({ rol: 'MANTENIMIENTO', permisos: ['tareas.ver', 'tareas.editar'] });
      }
      if (ruta === '/calendario/mias') {
        return Promise.resolve([
          tarea({ id: 'a', titulo: 'Futura' }),
          tarea({ id: 'b', titulo: 'Vencida', fecha: '2020-01-01T00:00:00.000Z' }),
        ]);
      }
      return Promise.resolve(null);
    });
    render(envolver(<MisTareasDeHoy />));

    await screen.findByText('Futura');
    // Una sola vez «Postergar»: la de la futura.
    expect(screen.getAllByRole('button', { name: 'Postergar' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Darla por hecha' })).toHaveLength(2);
  });
});
