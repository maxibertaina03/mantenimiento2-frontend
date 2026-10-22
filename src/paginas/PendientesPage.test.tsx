import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pendiente } from '@/tipos/pendiente';
import { PendientesPage } from './PendientesPage';

/**
 * El anotador: anotar tiene que ser más rápido que un papel (se escribe y
 * Enter), y tildar lo hecho, de un toque.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const pendiente = (id: string, texto: string, extra: Partial<Pendiente> = {}): Pendiente => ({
  id,
  texto,
  urgente: false,
  asignadoAId: null,
  asignadoANombre: null,
  equipoId: null,
  equipoNombre: null,
  creadoPorId: 'u1',
  creadoPorNombre: 'Facundo',
  creadoEn: new Date().toISOString(),
  hechaEn: null,
  hechaPorNombre: null,
  ordenTrabajoId: null,
  ordenTrabajoNumero: null,
  ...extra,
});

let abiertos: Pendiente[] = [];

beforeEach(() => {
  abiertos = [
    pendiente('p1', 'Comprar rulemanes 6204', { urgente: true }),
    pendiente('p2', 'Mandar a rebobinar el motor', {
      asignadoAId: 'u2',
      asignadoANombre: 'Leandro',
      equipoId: 'e1',
      equipoNombre: 'Bomba 2',
    }),
  ];
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation(
    (ruta: string, config?: { method?: string; query?: { estado?: string } }) => {
      if (ruta.startsWith('/permisos/mios')) {
        return Promise.resolve({
          rol: 'MANTENIMIENTO',
          permisos: ['pendientes.ver', 'pendientes.editar', 'trabajos.ver', 'trabajos.editar'],
        });
      }
      if (ruta.startsWith('/usuarios/me')) {
        return Promise.resolve({ id: 'u2', nombre: 'Leandro', rol: 'MANTENIMIENTO' });
      }
      if (ruta === '/ordenes-trabajo' && config?.method === 'POST') {
        return Promise.resolve({ id: 'ot-1', numero: 'OT-2026-0001' });
      }
      if (ruta === '/pendientes' && config?.method === 'POST') {
        return Promise.resolve(pendiente('p3', 'nuevo'));
      }
      if (ruta === '/pendientes') {
        return Promise.resolve(config?.query?.estado === 'hechos' ? [] : abiertos);
      }
      return Promise.resolve(null);
    },
  );
});

function mostrar() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PendientesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PendientesPage', () => {
  it('lista los pendientes con lo que tienen: urgente, a quién le toca y el equipo', async () => {
    mostrar();
    expect(await screen.findByText('Comprar rulemanes 6204')).toBeInTheDocument();
    expect(screen.getByText('Urgente', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.getByText('Leandro')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bomba 2/ })).toHaveAttribute('href', '/equipos/e1');
  });

  it('se anota escribiendo y apretando Enter', async () => {
    const usuario = userEvent.setup();
    mostrar();
    await usuario.type(
      await screen.findByLabelText('Qué quedó pendiente'),
      'Pedir presupuesto de pintura{Enter}',
    );
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/pendientes', {
        method: 'POST',
        body: {
          texto: 'Pedir presupuesto de pintura',
          urgente: false,
          asignadoAId: null,
          equipoId: null,
        },
      }),
    );
  });

  it('el círculo pregunta antes de darlo por hecho', async () => {
    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(
      await screen.findByRole('button', { name: 'Marcar como hecho: Comprar rulemanes 6204' }),
    );
    // «Todavía no» no hace nada.
    await usuario.click(screen.getByRole('button', { name: 'Todavía no' }));
    expect(apiRequestMock).not.toHaveBeenCalledWith('/pendientes/p1/hecho', expect.anything());

    await usuario.click(
      screen.getByRole('button', { name: 'Marcar como hecho: Comprar rulemanes 6204' }),
    );
    await usuario.click(screen.getByRole('button', { name: /Sí, ya está hecho/ }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/pendientes/p1/hecho', {
        method: 'POST',
        body: {},
      }),
    );
  });

  it('si es sobre una máquina, se registra el trabajo y el pendiente guarda la orden', async () => {
    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(
      await screen.findByRole('button', {
        name: 'Marcar como hecho: Mandar a rebobinar el motor',
      }),
    );
    await usuario.click(screen.getByRole('button', { name: /Registrar el trabajo/ }));

    // El formulario de la ficha, con el texto del pendiente ya puesto.
    expect(await screen.findByDisplayValue('Mandar a rebobinar el motor')).toBeInTheDocument();
    await usuario.type(screen.getByLabelText(/¿Qué se hizo\?/), 'Se rebobinó en el taller');
    await usuario.click(screen.getByRole('button', { name: 'Registrar trabajo' }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/pendientes/p2/hecho', {
        method: 'POST',
        body: { ordenTrabajoId: 'ot-1' },
      }),
    );
  });

  it('si le toca a otro, no lo puede dar por hecho', async () => {
    const usuario = userEvent.setup();
    abiertos = [
      pendiente('p9', 'Cambiar el retén', { asignadoAId: 'u7', asignadoANombre: 'Facundo' }),
    ];
    mostrar();
    await usuario.click(
      await screen.findByRole('button', { name: 'Marcar como hecho: Cambiar el retén' }),
    );
    expect(screen.getByText(/solo esa persona/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sí, ya está hecho/ })).not.toBeInTheDocument();
  });

  it('«Míos» deja solo los que le tocan a uno', async () => {
    const usuario = userEvent.setup();
    mostrar();
    await screen.findByText('Comprar rulemanes 6204');
    await usuario.click(screen.getByLabelText(/Míos/));
    expect(screen.queryByText('Comprar rulemanes 6204')).not.toBeInTheDocument();
    expect(screen.getByText('Mandar a rebobinar el motor')).toBeInTheDocument();
  });
});
