import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnidadesMedida } from './UnidadesMedida';
import type { UnidadMedida } from '@/tipos/unidadMedida';

/**
 * El catálogo de unidades es lo que hace que la unidad sea un dato analizable:
 * antes era texto libre y "lt", "Lt" y "litros" eran tres unidades distintas.
 * Estos tests fijan las reglas que sostienen esa garantía.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
}));

const unidad = (id: string, nombre: string, simbolo: string, materiales = 0): UnidadMedida => ({
  id,
  nombre,
  simbolo,
  orden: 0,
  activo: true,
  materiales,
});

const CATALOGO = [unidad('u1', 'Unidad', 'u', 12), unidad('u2', 'Litro', 'lt', 0)];

function envolver(nodo: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{nodo}</QueryClientProvider>;
}

function abrir() {
  return render(envolver(<UnidadesMedida abierto onCerrar={() => {}} />));
}

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((ruta: string) => {
    if (ruta.startsWith('/unidades-medida')) return Promise.resolve(CATALOGO);
    return Promise.resolve([]);
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('UnidadesMedida', () => {
  it('lista las unidades con su simbolo y cuantos materiales las usan', async () => {
    abrir();
    expect(await screen.findByText('Litro')).toBeInTheDocument();
    expect(screen.getByText('lt')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('crea una unidad nueva con nombre y simbolo', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText('Litro');

    await usuario.click(screen.getByRole('button', { name: /nueva unidad/i }));
    await usuario.type(screen.getByLabelText(/nombre/i), 'Kilogramo');
    await usuario.type(screen.getByLabelText(/símbolo/i), 'kg');
    await usuario.click(screen.getByRole('button', { name: /crear unidad/i }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/unidades-medida',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ nombre: 'Kilogramo', simbolo: 'kg' }),
        }),
      ),
    );
  });

  it('REGRESION: recorta los espacios, para que " kg " no entre como otra unidad', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText('Litro');

    await usuario.click(screen.getByRole('button', { name: /nueva unidad/i }));
    await usuario.type(screen.getByLabelText(/nombre/i), '  Kilogramo  ');
    await usuario.type(screen.getByLabelText(/símbolo/i), '  kg  ');
    await usuario.click(screen.getByRole('button', { name: /crear unidad/i }));

    await waitFor(() => {
      const alta = apiRequestMock.mock.calls.find(
        ([ruta, op]) => ruta === '/unidades-medida' && op?.method === 'POST',
      );
      expect(alta?.[1].body).toMatchObject({ nombre: 'Kilogramo', simbolo: 'kg' });
    });
  });

  it('desactivar una unidad la manda por PATCH, sin borrarla', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText('Litro');

    // La primera fila es "Unidad", que usan 12 materiales.
    await usuario.click(screen.getAllByRole('button', { name: 'Activa' })[0]);

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/unidades-medida/u1',
        expect.objectContaining({ method: 'PATCH', body: { activo: false } }),
      ),
    );
  });

  it('explica que una unidad en uso se desactiva en vez de borrarse', async () => {
    abrir();
    expect(await screen.findByText(/desactivala/i)).toBeInTheDocument();
  });
});
