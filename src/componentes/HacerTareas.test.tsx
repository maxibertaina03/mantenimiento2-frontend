import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tarea } from '@/tipos/tarea';
import { HacerTareas } from './HacerTareas';

/**
 * La recorrida desde el celular: dos toques por tarea («Hecha» en la lista,
 * «Hecha, sin novedad» acá) y aparece la siguiente.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const hoy = new Date();
const hoyIso = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())).toISOString();

const tarea = (id: string, equipo: string, titulo = 'Purga'): Tarea =>
  ({
    id,
    titulo,
    descripcion: null,
    fecha: hoyIso,
    fechaOriginal: null,
    estado: 'PENDIENTE',
    equipoId: `eq-${id}`,
    equipoNombre: equipo,
    equipoItId: null,
    equipoItNombre: null,
    asignadoAId: null,
    asignadoANombre: null,
    planId: 'p1',
    planNombre: 'Purga diaria',
    rutinaId: null,
    rutinaTitulo: null,
    cadaDias: 1,
    ordenTrabajoId: null,
  }) as unknown as Tarea;

const TAREAS = [tarea('t1', 'Compresor 1'), tarea('t2', 'Hidrociclón 1'), tarea('t3', 'Tanque')];

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((ruta: string) => {
    if (ruta.startsWith('/permisos/mios')) {
      return Promise.resolve({ rol: 'MANTENIMIENTO', permisos: ['tareas.ver', 'tareas.editar'] });
    }
    if (ruta.endsWith('/completar')) return Promise.resolve({ id: ruta.split('/')[2] });
    return Promise.resolve([]);
  });
});

function mostrar(onCerrar = vi.fn(), tareas = TAREAS) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HacerTareas tareas={tareas} inicialId={tareas[0].id} onCerrar={onCerrar} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onCerrar;
}

describe('HacerTareas', () => {
  it('«Hecha, sin novedad» la cierra de un toque y aparece la siguiente', async () => {
    const usuario = userEvent.setup();
    mostrar();
    expect(screen.getByRole('heading', { name: 'Tarea 1 de 3' })).toBeInTheDocument();
    expect(screen.getByText('Compresor 1')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /Hecha, sin novedad/ }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/calendario/t1/completar', {
        method: 'POST',
        body: { resolucion: 'Sin novedad' },
      }),
    );
    expect(await screen.findByText(/Listo: Compresor 1 quedó hecha/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tarea 2 de 3' })).toBeInTheDocument();
    expect(screen.getByText('Hidrociclón 1')).toBeInTheDocument();
  });

  it('al terminar la última dice que no quedan pendientes', async () => {
    const usuario = userEvent.setup();
    mostrar(vi.fn(), TAREAS.slice(0, 2));
    await usuario.click(screen.getByRole('button', { name: /Hecha, sin novedad/ }));
    await screen.findByText('Hidrociclón 1');
    await usuario.click(screen.getByRole('button', { name: /Hecha, sin novedad/ }));
    expect(await screen.findByText('No quedan tareas pendientes.')).toBeInTheDocument();
  });

  it('«Saltear» pasa a la siguiente sin cerrarla', async () => {
    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(screen.getByRole('button', { name: /Saltear/ }));
    expect(screen.getByText('Hidrociclón 1')).toBeInTheDocument();
    expect(apiRequestMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/completar'),
      expect.anything(),
    );
  });

  it('«Hubo algo» abre el formulario completo', async () => {
    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(screen.getByRole('button', { name: /Hubo algo/ }));
    expect(await screen.findByText(/Materiales que se usaron/)).toBeInTheDocument();
  });

  it('con una sola tarea (desde el calendario), al hacerla se cierra', async () => {
    const usuario = userEvent.setup();
    const onCerrar = mostrar(vi.fn(), [TAREAS[0]]);
    expect(screen.getByRole('heading', { name: 'Dar por hecha' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: /Hecha, sin novedad/ }));
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  });
});
