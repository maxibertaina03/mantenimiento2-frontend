import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NuevaTarea } from './NuevaTarea';

/**
 * La máquina de la tarea se reconoce en lo que se escribe: si no hay dudas
 * queda atada sola; si hay varias, se ofrecen; lo elegido a mano gana.
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

const sugerencia = (id: string, nombre: string, elegida: boolean) => ({
  id,
  nombre,
  ubicacionNombre: 'Quesería',
  puntaje: 1,
  completa: true,
  elegida,
});

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation(
    (ruta: string, opciones?: { method?: string; query?: { texto?: string } }) => {
      if (ruta.startsWith('/permisos/mios')) {
        return Promise.resolve({ rol: 'X', permisos: ['tareas.editar', 'equipos.ver'] });
      }
      if (ruta === '/equipos/sugerir') {
        const texto = opciones?.query?.texto ?? '';
        if (texto.includes('desmigadora')) {
          return Promise.resolve([sugerencia('d1', 'Desmigadora 1', true)]);
        }
        if (texto.includes('tina')) {
          return Promise.resolve([
            sugerencia('t1', 'Tina 1', false),
            sugerencia('t2', 'Tina 2', false),
          ]);
        }
        return Promise.resolve([]);
      }
      if (ruta === '/calendario' && opciones?.method === 'POST') return Promise.resolve({});
      if (ruta.startsWith('/equipos')) {
        return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
      }
      return Promise.resolve([]);
    },
  );
});

function abrir() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NuevaTarea fecha="2026-11-05" onCerrar={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const enviado = () =>
  apiRequestMock.mock.calls.find(
    ([r, o]) => r === '/calendario' && (o as { method?: string })?.method === 'POST',
  )?.[1] as { body: Record<string, unknown> } | undefined;

describe('NuevaTarea', () => {
  it('«cambio de rodamiento de desmigadora» queda atada a la Desmigadora sola', async () => {
    abrir();
    await userEvent.type(
      screen.getByLabelText(/¿Qué hay que hacer\?/),
      'Cambio de rodamiento de desmigadora',
    );
    expect(await screen.findByText(/por lo que escribiste/)).toHaveTextContent('Desmigadora 1');
    await userEvent.click(screen.getByRole('button', { name: 'Programar' }));
    await waitFor(() => expect(enviado()?.body).toMatchObject({ equipoId: 'd1' }));
  });

  it('si nombra varias, las ofrece; tocar una la elige', async () => {
    abrir();
    await userEvent.type(screen.getByLabelText(/¿Qué hay que hacer\?/), 'Limpiar la tina');
    expect(await screen.findByText(/¿Es de alguna de estas\?/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Tina 2/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Programar' }));
    await waitFor(() => expect(enviado()?.body).toMatchObject({ equipoId: 't2' }));
  });

  it('«No es esa» la saca y no vuelve a atarla', async () => {
    abrir();
    const campo = screen.getByLabelText(/¿Qué hay que hacer\?/);
    await userEvent.type(campo, 'Engrasar desmigadora');
    await userEvent.click(await screen.findByRole('button', { name: /No es esa/ }));
    await userEvent.type(campo, ' ya');
    await new Promise((r) => setTimeout(r, 600));
    expect(screen.queryByText(/por lo que escribiste/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Programar' }));
    await waitFor(() => expect(enviado()?.body.equipoId).toBeUndefined());
  });
});
