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
          permisos: ['pendientes.ver', 'pendientes.editar'],
        });
      }
      if (ruta.startsWith('/usuarios/me')) {
        return Promise.resolve({ id: 'u2', nombre: 'Leandro', rol: 'MANTENIMIENTO' });
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

  it('se tilda como hecho de un toque', async () => {
    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(
      await screen.findByRole('button', { name: 'Marcar como hecho: Comprar rulemanes 6204' }),
    );
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/pendientes/p1/hecho', { method: 'POST' }),
    );
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
