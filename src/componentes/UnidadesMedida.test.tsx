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
    if (ruta === '/materiales/sin-unidad') return Promise.resolve({ sinUnidad: 0 });
    if (ruta === '/materiales/asignar-unidad-masiva')
      return Promise.resolve({ actualizados: 831, sinUnidad: 0 });
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

describe('UnidadesMedida — carga masiva', () => {
  /** Deja el backend respondiendo que hay `n` materiales sin unidad. */
  function conPendientes(n: number) {
    apiRequestMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/unidades-medida')) return Promise.resolve(CATALOGO);
      if (ruta === '/materiales/sin-unidad') return Promise.resolve({ sinUnidad: n });
      if (ruta === '/materiales/asignar-unidad-masiva')
        return Promise.resolve({ actualizados: n, sinUnidad: 0 });
      return Promise.resolve([]);
    });
  }

  it('no muestra nada si todos los materiales ya tienen unidad', async () => {
    conPendientes(0);
    abrir();
    await screen.findByText('Litro');
    expect(screen.queryByText(/sin unidad/i)).not.toBeInTheDocument();
  });

  it('avisa cuantos materiales estan sin unidad', async () => {
    conPendientes(831);
    abrir();
    expect(await screen.findByText(/831 material\(es\) sin unidad/i)).toBeInTheDocument();
  });

  it('asigna la unidad elegida a los que no tienen', async () => {
    conPendientes(831);
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText(/831 material/i);

    await usuario.selectOptions(
      screen.getByRole('combobox'),
      screen.getByRole('option', { name: /Unidad \(u\)/ }),
    );
    await usuario.click(screen.getByRole('button', { name: /asignar a los 831/i }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/materiales/asignar-unidad-masiva',
        expect.objectContaining({ method: 'POST', body: { unidadId: 'u1' } }),
      ),
    );
    expect(await screen.findByText(/831 material\(es\) quedaron/i)).toBeInTheDocument();
  });

  it('REGRESION: no manda nada si el usuario cancela la confirmacion', async () => {
    // Es una operacion masiva: tiene que poder frenarse.
    conPendientes(831);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText(/831 material/i);

    await usuario.selectOptions(
      screen.getByRole('combobox'),
      screen.getByRole('option', { name: /Unidad \(u\)/ }),
    );
    await usuario.click(screen.getByRole('button', { name: /asignar a los 831/i }));

    expect(apiRequestMock).not.toHaveBeenCalledWith(
      '/materiales/asignar-unidad-masiva',
      expect.anything(),
    );
  });

  it('el boton esta deshabilitado hasta elegir una unidad', async () => {
    conPendientes(831);
    abrir();
    await screen.findByText(/831 material/i);
    expect(screen.getByRole('button', { name: /asignar a los 831/i })).toBeDisabled();
  });
});
