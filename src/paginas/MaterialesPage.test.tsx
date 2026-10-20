import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaterialDetallePage } from './MaterialDetallePage';
import { MaterialesPage } from './MaterialesPage';

/**
 * Volver a la lista de materiales deja todo como estaba.
 *
 * El caso que lo pidió: se filtraba por «Electricidad», se iba a la página 4,
 * se entraba a un material y, al volver, la lista arrancaba de cero.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const material = (id: string, nombre: string) => ({
  id,
  nombre,
  categoriaId: 'cat-elec',
  categoriaNombre: 'Electricidad',
  unidadId: 'u1',
  unidadNombre: 'Unidad',
  unidad: 'u',
  stockActual: 3,
  stockMinimo: 1,
  bajoStock: false,
  activo: true,
  notas: null,
  estanteriaId: null,
  estanteriaNombre: null,
  fila: null,
  creadoEn: '2026-01-01',
  actualizadoEn: '2026-01-01',
});

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation(
    (ruta: string, config?: { query?: Record<string, unknown> }) => {
      if (ruta === '/categorias-material') {
        return Promise.resolve([
          { id: 'cat-elec', nombre: 'Electricidad' },
          { id: 'cat-rod', nombre: 'Rodamientos' },
        ]);
      }
      if (ruta === '/materiales') {
        // 100 materiales: 5 páginas de 20. Cada fila dice de qué página es.
        const pagina = Number(config?.query?.pagina ?? 1);
        const datos = [1, 2].map((i) => material(`m-${pagina}-${i}`, `Cable p${pagina}-${i}`));
        return Promise.resolve({ datos, total: 100, pagina, limite: 20 });
      }
      if (ruta.endsWith('/historial')) {
        return Promise.resolve({ ...material('m-4-1', 'Cable p4-1'), movimientos: [] });
      }
      return Promise.resolve([]);
    },
  );
});

/** Muestra la dirección actual, para comprobar qué quedó en ella. */
function Direccion() {
  const { pathname, search } = useLocation();
  return <output data-testid="direccion">{pathname + search}</output>;
}

function mostrar(entrada = '/materiales') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entrada]}>
        <Routes>
          <Route path="/materiales" element={<MaterialesPage />} />
          <Route path="/materiales/:id" element={<MaterialDetallePage />} />
        </Routes>
        <Direccion />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ultimaConsulta = () => {
  const llamadas = apiRequestMock.mock.calls.filter(([ruta]) => ruta === '/materiales');
  return llamadas[llamadas.length - 1][1].query as Record<string, unknown>;
};

describe('volver a la lista de materiales', () => {
  it('REGRESION: Electricidad, página 4, entrar a un material y volver: queda igual', async () => {
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /filtros/i }));
    await usuario.selectOptions(await screen.findByLabelText('Categoría'), 'cat-elec');
    for (let i = 0; i < 3; i++) {
      await usuario.click(await screen.findByRole('button', { name: /siguiente/i }));
    }
    expect(await screen.findByText('Página 4 de 5')).toBeInTheDocument();

    await usuario.click(await screen.findByRole('link', { name: 'Cable p4-1' }));
    await usuario.click(await screen.findByRole('link', { name: /volver a materiales/i }));

    expect(await screen.findByText('Página 4 de 5')).toBeInTheDocument();
    expect(screen.getByText('Cable p4-1')).toBeInTheDocument();
    // El filtro sigue puesto y a la vista.
    expect(screen.getByLabelText('Categoría')).toHaveValue('cat-elec');
    expect(screen.getByRole('button', { name: 'Filtros (1)' })).toBeInTheDocument();
    expect(ultimaConsulta()).toEqual(
      expect.objectContaining({ pagina: 4, categoriaId: 'cat-elec' }),
    );
  });

  it('la búsqueda también vuelve, y la dirección se puede compartir', async () => {
    const usuario = userEvent.setup();
    mostrar();

    await usuario.type(await screen.findByPlaceholderText(/buscar material/i), 'cable');
    await waitFor(() =>
      expect(screen.getByTestId('direccion')).toHaveTextContent('/materiales?buscar=cable'),
    );

    await usuario.click(await screen.findByRole('link', { name: 'Cable p1-1' }));
    await usuario.click(await screen.findByRole('link', { name: /volver a materiales/i }));

    expect(await screen.findByPlaceholderText(/buscar material/i)).toHaveValue('cable');
    expect(screen.getByTestId('direccion')).toHaveTextContent('/materiales?buscar=cable');
  });

  it('cambiar el filtro vuelve a la página 1: la de antes puede no existir', async () => {
    const usuario = userEvent.setup();
    mostrar('/materiales?categoriaId=cat-elec&pagina=4');

    expect(await screen.findByText('Página 4 de 5')).toBeInTheDocument();
    await usuario.selectOptions(await screen.findByLabelText('Categoría'), 'cat-rod');

    await waitFor(() =>
      expect(screen.getByTestId('direccion')).toHaveTextContent('/materiales?categoriaId=cat-rod'),
    );
    expect(await screen.findByText('Página 1 de 5')).toBeInTheDocument();
  });

  it('a la ficha que se abre desde un QR, «Volver» lleva a la lista sola', async () => {
    const usuario = userEvent.setup();
    mostrar('/materiales/m-4-1');

    await usuario.click(await screen.findByRole('link', { name: /volver a materiales/i }));
    await waitFor(() =>
      expect(screen.getByTestId('direccion')).toHaveTextContent(/^\/materiales$/),
    );
  });
});
