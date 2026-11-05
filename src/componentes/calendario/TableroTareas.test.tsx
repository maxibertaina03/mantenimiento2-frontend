import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TableroTareas } from './TableroTareas';
import type { Tarea } from '@/tipos/tarea';

/**
 * El tablero: qué se puede mover y adónde va cada movimiento. Arrastrar con el
 * mouse usa lo mismo que «Mover a…», que es lo que se prueba acá.
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

const tarea = (id: string, titulo: string, cambios: Partial<Tarea> = {}): Tarea => ({
  id,
  titulo,
  descripcion: null,
  fecha: new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z',
  fechaOriginal: null,
  estado: 'PENDIENTE',
  asignadoAId: 'u1',
  asignadoANombre: 'Facundo',
  equipoId: null,
  equipoNombre: null,
  equipoItId: null,
  equipoItNombre: null,
  planId: null,
  planNombre: null,
  rutinaId: null,
  rutinaTitulo: null,
  ordenTrabajoId: null,
  ordenTrabajoNumero: null,
  creadaPorId: 'u1',
  creadoEn: '2026-09-22T10:00:00.000Z',
  ...cambios,
});

let permisos: string[] = [];

beforeEach(() => {
  apiRequestMock.mockReset();
  permisos = ['tareas.ver', 'tareas.editar'];
  apiRequestMock.mockImplementation((ruta: string, opciones?: { method?: string }) => {
    if (ruta.startsWith('/usuarios/me')) {
      return Promise.resolve({ id: 'u1', nombre: 'Facundo', rol: 'MANTENIMIENTO' });
    }
    if (ruta.startsWith('/permisos/mios')) {
      return Promise.resolve({ rol: 'MANTENIMIENTO', permisos });
    }
    if (ruta === '/calendario/tablero') {
      return Promise.resolve({
        pendientes: [
          tarea('t1', 'Cambiar correa'),
          tarea('t2', 'Engrasar rodillos', { asignadoAId: 'u2', asignadoANombre: 'Leandro' }),
        ],
        enProceso: [
          tarea('t3', 'Revisar bomba', {
            estado: 'EN_PROCESO',
            enProcesoDesde: new Date().toISOString(),
          }),
        ],
        hechas: [],
      });
    }
    if (opciones?.method === 'POST') return Promise.resolve(tarea('x', 'x'));
    return Promise.resolve([]);
  });
});

function abrir() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TableroTareas colores={new Map()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const llamadas = () =>
  apiRequestMock.mock.calls
    .filter(([, o]) => (o as { method?: string } | undefined)?.method === 'POST')
    .map(([ruta]) => ruta);

describe('TableroTareas', () => {
  it('reparte las tarjetas en las tres columnas', async () => {
    abrir();
    const pendiente = await screen.findByLabelText('Pendiente');
    expect(within(pendiente).getByText('Cambiar correa')).toBeInTheDocument();
    expect(within(screen.getByLabelText('En proceso')).getByText('Revisar bomba')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Listo')).getByText(/no se terminó nada/)).toBeInTheDocument();
  });

  it('«Mover a» En proceso la toma, y a Pendiente la suelta', async () => {
    abrir();
    await userEvent.selectOptions(
      await screen.findByLabelText('Mover «Cambiar correa» a'),
      'enProceso',
    );
    await userEvent.selectOptions(screen.getByLabelText('Mover «Revisar bomba» a'), 'pendientes');
    await waitFor(() =>
      expect(llamadas()).toEqual(['/calendario/t1/tomar', '/calendario/t3/soltar']),
    );
  });

  it('a Listo abre el cierre de siempre, sin llamar a nada todavía', async () => {
    abrir();
    await userEvent.selectOptions(
      await screen.findByLabelText('Mover «Cambiar correa» a'),
      'hechas',
    );
    expect(await screen.findByText('Hecha, sin novedad')).toBeInTheDocument();
    expect(llamadas()).toEqual([]);
  });

  it('la de otro no se mueve; el encargado sí puede', async () => {
    const { unmount } = abrir();
    await screen.findByText('Engrasar rodillos');
    expect(screen.queryByLabelText('Mover «Engrasar rodillos» a')).not.toBeInTheDocument();
    unmount();

    permisos = ['tareas.ver', 'tareas.editar', 'tareas.asignar'];
    abrir();
    expect(await screen.findByLabelText('Mover «Engrasar rodillos» a')).toBeInTheDocument();
  });
});
