import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComboMaterial } from './ComboMaterial';
import type { Material } from '@/tipos/material';

/**
 * El combo consulta la API por nombre en vez de cargar los ~831 materiales de
 * una. Estos tests fijan ese contrato (debounce, filtrado server-side y
 * seleccion) contra el apiClient mockeado.
 */
/** Forma de las opciones que el componente le pasa al apiClient. */
interface OpcionesApi {
  query?: Record<string, string | number | undefined | null>;
}

const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
}));

const material = (id: string, nombre: string, stockActual = 10): Material =>
  ({
    id,
    nombre,
    unidad: 'u',
    stockActual,
    stockMinimo: 0,
    categoriaId: 'c1',
    categoriaNombre: 'Cat',
    bajoStock: false,
    notas: null,
  }) as Material;

const CATALOGO = [
  material('m1', 'Cable 2.5mm'),
  material('m2', 'Cable 4mm'),
  material('m3', 'Tornillo 6x40'),
];

function envoltorio() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  apiRequestMock.mockReset();
  // Simula el filtrado server-side por nombre.
  apiRequestMock.mockImplementation(async (path: string, opciones: OpcionesApi = {}) => {
    if (/^\/materiales\/[^/]+$/.test(path)) {
      const id = path.split('/')[2];
      return CATALOGO.find((m) => m.id === id) ?? null;
    }
    const buscar = String(opciones?.query?.buscar ?? '').toLowerCase();
    const datos = buscar
      ? CATALOGO.filter((m) => m.nombre.toLowerCase().includes(buscar))
      : CATALOGO;
    return { datos, total: datos.length, pagina: 1, limite: 20 };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ComboMaterial', () => {
  it('no consulta el listado hasta que se abre el desplegable', () => {
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });
    expect(screen.queryByText(/Cable 2.5mm/)).not.toBeInTheDocument();
  });

  it('al enfocar muestra las opciones', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });

    await user.click(screen.getByRole('textbox'));

    await waitFor(() => expect(screen.getByText(/Cable 2.5mm/)).toBeInTheDocument());
    expect(screen.getByText(/Tornillo 6x40/)).toBeInTheDocument();
  });

  it('filtra en el servidor, no en el cliente', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, 'cable');

    // El debounce es de 250ms.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      const llamadas = apiRequestMock.mock.calls.filter((c) => c[0] === '/materiales');
      const ultima = llamadas[llamadas.length - 1];
      expect(ultima[1].query.buscar).toBe('cable');
    });
  });

  it('hace debounce: tipear rapido no dispara una request por tecla', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });

    const input = screen.getByRole('textbox');
    await user.click(input);
    apiRequestMock.mockClear();

    await user.type(input, 'cable');
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      const busquedas = apiRequestMock.mock.calls
        .filter((c) => c[0] === '/materiales')
        .map((c) => c[1]?.query?.buscar);
      // Debe quedar la busqueda completa, no una por cada letra tipeada.
      expect(busquedas).toContain('cable');
      expect(busquedas).not.toContain('c');
      expect(busquedas).not.toContain('ca');
    });
  });

  it('al elegir una opcion avisa al padre con el material completo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCambio = vi.fn();
    render(<ComboMaterial materialId="" onCambio={onCambio} />, { wrapper: envoltorio() });

    await user.click(screen.getByRole('textbox'));
    await waitFor(() => expect(screen.getByText(/Cable 2.5mm/)).toBeInTheDocument());
    await user.click(screen.getByText(/Cable 2.5mm/));

    expect(onCambio).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
  });

  it('tras elegir, cierra el desplegable y muestra el nombre elegido', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });

    await user.click(screen.getByRole('textbox'));
    await waitFor(() => expect(screen.getByText(/Tornillo 6x40/)).toBeInTheDocument());
    await user.click(screen.getByText(/Tornillo 6x40/));

    expect(screen.getByRole('textbox')).toHaveValue('Tornillo 6x40');
    expect(screen.queryByText(/Cable 2.5mm/)).not.toBeInTheDocument();
  });

  it('muestra el stock de cada opcion para decidir sin salir de la pantalla', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });

    await user.click(screen.getByRole('textbox'));

    await waitFor(() => expect(screen.getAllByText(/stock 10 u/).length).toBeGreaterThan(0));
  });

  it('precarga el material que llega por prop (ej: desde el detalle)', async () => {
    render(<ComboMaterial materialId="m3" onCambio={vi.fn()} />, { wrapper: envoltorio() });
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Tornillo 6x40'));
  });

  it('avisa cuando la busqueda no trae resultados', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, 'zzzznoexiste');
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => expect(screen.getByText(/Sin resultados/)).toBeInTheDocument());
  });
});
