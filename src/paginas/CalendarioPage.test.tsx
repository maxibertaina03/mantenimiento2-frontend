import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarioPage } from './CalendarioPage';
import type { Tarea } from '@/tipos/tarea';

/**
 * El calendario.
 *
 * Lo que más importa proteger: que una tarea de otro se vea pero no se pueda
 * dar por hecha, y que repartir el trabajo sea un permiso aparte de hacerlo.
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

const HOY = new Date('2026-09-23T12:00:00.000Z');

const TAREA: Tarea = {
  id: '11111111-1111-4111-8111-111111111111',
  titulo: 'Revisar presion de caldera',
  descripcion: 'Tiene que estar entre 5 y 7 bar',
  fecha: '2026-09-23T00:00:00.000Z',
  estado: 'PENDIENTE',
  asignadoAId: 'u1',
  asignadoANombre: 'Facundo',
  equipoId: null,
  equipoNombre: null,
  planId: null,
  planNombre: null,
  rutinaId: null,
  rutinaTitulo: null,
  ordenTrabajoId: null,
  ordenTrabajoNumero: null,
  creadaPorId: 'u1',
  creadoEn: '2026-09-22T10:00:00.000Z',
};

let permisos: string[] = [];
let tareas: Tarea[] = [];

beforeEach(() => {
  // La fecha se fija para que el test no dependa del mes en que se corra.
  // `shouldAdvanceTime` deja que userEvent siga funcionando con temporizadores
  // falsos, que si no se cuelga esperando.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(HOY);
  apiRequestMock.mockReset();
  permisos = ['tareas.ver', 'tareas.editar'];
  tareas = [TAREA];

  apiRequestMock.mockImplementation((rutaCruda: string) => {
    const ruta = String(rutaCruda ?? '');
    if (ruta.startsWith('/usuarios/me')) {
      return Promise.resolve({ id: 'u1', nombre: 'Facundo', rol: 'MANTENIMIENTO' });
    }
    if (ruta.startsWith('/permisos/mios')) {
      return Promise.resolve({ rol: 'MANTENIMIENTO', permisos });
    }
    if (ruta.startsWith('/ordenes-trabajo/asignables')) {
      return Promise.resolve([
        { id: 'u1', nombre: 'Facundo' },
        { id: 'u2', nombre: 'Leandro' },
      ]);
    }
    if (ruta.startsWith('/calendario/rutinas')) return Promise.resolve([]);
    if (ruta.startsWith('/calendario')) {
      return Promise.resolve({ desde: '2026-08-31', hasta: '2026-10-04', tareas });
    }
    return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function mostrar() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const nodo: ReactNode = (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CalendarioPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(nodo);
}

describe('CalendarioPage', () => {
  it('muestra el mes y las tareas de cada dia', async () => {
    mostrar();

    expect(await screen.findByText('Revisar presion de caldera')).toBeInTheDocument();
    // getAllByText: el mes esta en la barra y otra vez en el titulo que solo
    // se ve al imprimir.
    expect(screen.getAllByText(/septiembre de 2026/).length).toBeGreaterThan(0);
  });

  it('pide el rango del mes que se esta mirando', async () => {
    mostrar();

    await waitFor(() => {
      const llamada = apiRequestMock.mock.calls.find(
        (c) => String(c[0]) === '/calendario' && c[1]?.query?.desde,
      );
      // Semanas completas de lunes a domingo: el rango empieza antes del dia 1.
      expect(llamada?.[1].query.desde <= '2026-09-01').toBe(true);
      expect(llamada?.[1].query.hasta >= '2026-09-30').toBe(true);
    });
  });

  it('avisa cuando hay tareas sin repartir', async () => {
    // Mientras no tengan responsable, todos suponen que las hace otro.
    tareas = [{ ...TAREA, asignadoAId: null, asignadoANombre: null }];
    mostrar();

    expect(await screen.findByText(/sin repartir en este mes/i)).toBeInTheDocument();
  });

  it('el detalle de una tarea propia ofrece darla por hecha', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mostrar();

    await usuario.click(await screen.findByText('Revisar presion de caldera'));

    expect(await screen.findByRole('button', { name: /darla por hecha/i })).toBeInTheDocument();
  });

  it('REGRESION: la tarea de otro se ve pero no se puede dar por hecha', async () => {
    // Si dos personas pueden cerrar la misma tarea, el reparto deja de
    // significar algo.
    tareas = [{ ...TAREA, asignadoAId: 'u2', asignadoANombre: 'Leandro' }];
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mostrar();

    await usuario.click(await screen.findByText('Revisar presion de caldera'));

    expect(await screen.findByText(/es de Leandro/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /darla por hecha/i })).not.toBeInTheDocument();
  });

  it('una tarea sin duenio la puede agarrar cualquiera', async () => {
    tareas = [{ ...TAREA, asignadoAId: null, asignadoANombre: null }];
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mostrar();

    await usuario.click(await screen.findByText('Revisar presion de caldera'));

    expect(await screen.findByRole('button', { name: /darla por hecha/i })).toBeInTheDocument();
  });

  it('REGRESION: sin el permiso de repartir no se ofrece asignar', async () => {
    // Hacer lo tuyo y decidir que hace el resto no son la misma cosa.
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mostrar();

    await usuario.click(await screen.findByText('Revisar presion de caldera'));
    await screen.findByRole('button', { name: /darla por hecha/i });

    expect(screen.queryByRole('button', { name: /^asignar$/i })).not.toBeInTheDocument();
  });

  it('con el permiso de repartir, se le puede dar a otro', async () => {
    permisos = ['tareas.ver', 'tareas.editar', 'tareas.asignar'];
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mostrar();

    await usuario.click(await screen.findByText('Revisar presion de caldera'));
    await usuario.selectOptions(await screen.findByLabelText(/Darle la tarea a alguien/i), 'u2');
    await usuario.click(screen.getByRole('button', { name: /^asignar$/i }));

    await waitFor(() => {
      const llamada = apiRequestMock.mock.calls.find((c) => String(c[0]).includes('/asignar'));
      expect(llamada?.[1].body).toEqual({ asignadoAId: 'u2' });
    });
  });

  it('REGRESION: sin permiso de editar no se ofrece programar nada', async () => {
    // Gerencia mira el calendario y no lo toca.
    permisos = ['tareas.ver'];
    mostrar();

    await screen.findByText('Revisar presion de caldera');

    expect(screen.queryByRole('button', { name: /nueva tarea/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rutinas/i })).not.toBeInTheDocument();
  });

  it('una tarea que salio de un plan lo dice, y avisa que corre la proxima fecha', async () => {
    tareas = [{ ...TAREA, planId: 'plan-1', planNombre: 'Cambio de aceite' }];
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mostrar();

    await usuario.click(await screen.findByText('Revisar presion de caldera'));

    expect(await screen.findByText(/Cambio de aceite/)).toBeInTheDocument();
    expect(screen.getByText(/la próxima fecha del plan corre sola/i)).toBeInTheDocument();
  });

  it('una tarea hecha muestra la orden de trabajo que quedo', async () => {
    tareas = [
      {
        ...TAREA,
        estado: 'HECHA',
        ordenTrabajoId: 'ot-1',
        ordenTrabajoNumero: 'OT-2026-0007',
      },
    ];
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mostrar();

    await usuario.click(await screen.findByText('Revisar presion de caldera'));

    expect(await screen.findByText(/OT-2026-0007/)).toBeInTheDocument();
  });
});
