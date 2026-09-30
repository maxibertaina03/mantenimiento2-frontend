import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentesEquipo } from './ComponentesEquipo';
import type { Equipo } from '@/tipos/equipo';

/**
 * Dónde está montado un equipo y qué tiene montado.
 *
 * Lo que se cuida: que cada botón le pida al servidor lo correcto —montar ESTE
 * equipo en otro, o montar OTRO equipo en este—, que son dos cosas al revés y
 * fáciles de confundir.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

// El buscador de equipos real pide a la API y escanea QR: acá alcanza con que
// «elija» un equipo al tocarlo.
vi.mock('./ComboEquipo', () => ({
  ComboEquipo: ({ onCambio }: { onCambio: (e: { id: string; nombre: string }) => void }) => (
    <button type="button" onClick={() => onCambio({ id: 'otro', nombre: 'Motor 15 HP' })}>
      elegir equipo
    </button>
  ),
}));

const bomba = {
  id: 'bomba',
  nombre: 'Electrobomba centrífuga',
  estado: 'OPERATIVO',
  equipoPadreId: 'des',
  equipoPadreNombre: 'Desnatadora 1',
  cantidadComponentes: 0,
} as unknown as Equipo;

function servidor(equipo: Equipo = bomba, componentes: unknown[] = []) {
  apiRequestMock.mockImplementation((rutaCruda: string) => {
    const ruta = String(rutaCruda ?? '');
    if (ruta.startsWith('/permisos/mios')) {
      return Promise.resolve({ rol: 'MANTENIMIENTO', permisos: ['equipos.ver', 'equipos.editar'] });
    }
    if (ruta === `/equipos/${equipo.id}`) return Promise.resolve(equipo);
    if (ruta.endsWith('/componentes')) return Promise.resolve(componentes);
    if (ruta.endsWith('/montajes')) return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
}

function mostrar(equipo: Equipo, onAbrir = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const nodo: ReactNode = (
    <QueryClientProvider client={qc}>
      <ComponentesEquipo equipo={equipo} onAbrir={onAbrir} />
    </QueryClientProvider>
  );
  render(nodo);
  return onAbrir;
}

beforeEach(() => apiRequestMock.mockReset());

describe('ComponentesEquipo', () => {
  it('dice dónde está montado y lleva a esa ficha', async () => {
    servidor();
    const onAbrir = mostrar(bomba);

    await userEvent.click(await screen.findByRole('button', { name: 'Desnatadora 1' }));
    expect(onAbrir).toHaveBeenCalledWith('des');
  });

  it('trasladar monta ESTE equipo en el elegido', async () => {
    servidor();
    mostrar(bomba);

    await userEvent.click(await screen.findByRole('button', { name: /Trasladar a otra máquina/ }));
    await userEvent.click(screen.getByText('elegir equipo'));
    await userEvent.click(screen.getByRole('button', { name: /Montar en «Motor 15 HP»/ }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/equipos/bomba/montar', {
        method: 'POST',
        body: { equipoPadreId: 'otro', motivo: undefined },
      }),
    );
  });

  it('REGRESION: agregar un componente monta el ELEGIDO en este, no al revés', async () => {
    servidor();
    mostrar(bomba);

    await userEvent.click(await screen.findByRole('button', { name: /Agregar componente/ }));
    await userEvent.click(screen.getByText('elegir equipo'));
    await userEvent.click(screen.getByRole('button', { name: /Montar «Motor 15 HP» acá/ }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/equipos/otro/montar', {
        method: 'POST',
        body: { equipoPadreId: 'bomba', motivo: undefined },
      }),
    );
  });

  it('lista los componentes y cada uno abre su ficha', async () => {
    const desnatadora = {
      ...bomba,
      id: 'des',
      nombre: 'Desnatadora 1',
      equipoPadreId: null,
      equipoPadreNombre: null,
      cantidadComponentes: 1,
    } as unknown as Equipo;
    servidor(desnatadora, [
      {
        id: 'bomba',
        nombre: 'Electrobomba centrífuga',
        estado: 'OPERATIVO',
        tipoNombre: 'Bomba',
        clasificacion: 'EQUIPO',
        montadoDesde: '2026-03-10T12:00:00.000Z',
        cantidadComponentes: 0,
      },
    ]);
    const onAbrir = mostrar(desnatadora);

    expect(await screen.findByText(/Va suelto/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Electrobomba centrífuga' }));
    expect(onAbrir).toHaveBeenCalledWith('bomba');
  });

  it('un equipo dado de baja no ofrece montar ni agregar', async () => {
    const baja = { ...bomba, estado: 'DADO_DE_BAJA', equipoPadreId: null } as unknown as Equipo;
    servidor(baja);
    mostrar(baja);

    await screen.findByText(/Va suelto/);
    expect(screen.queryByRole('button', { name: /Montar en una máquina/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Agregar componente/ })).not.toBeInTheDocument();
  });
});
