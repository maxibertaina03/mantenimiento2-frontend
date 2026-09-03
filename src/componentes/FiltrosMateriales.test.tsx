import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FiltrosMateriales, contarFiltros } from './FiltrosMateriales';

/**
 * Filtros del listado de materiales.
 *
 * El filtrado lo resuelve el backend: son 870 materiales y traerlos todos para
 * filtrarlos en el navegador rompería la paginación. Estos tests fijan que la
 * pantalla arme bien lo que se le pide al servidor.
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

const CATEGORIAS = [{ id: 'c1', nombre: 'Bulonería', descripcion: null }];
const UNIDADES = [
  { id: 'u1', nombre: 'Unidad', simbolo: 'u', orden: 10, activo: true, materiales: 3 },
];

function envolver(nodo: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{nodo}</QueryClientProvider>;
}

const alCambiar = vi.fn();
const abrir = (filtros = {}) =>
  render(envolver(<FiltrosMateriales filtros={filtros} onCambio={alCambiar} />));

beforeEach(() => {
  apiRequestMock.mockReset();
  alCambiar.mockReset();
  apiRequestMock.mockImplementation((ruta: string) => {
    if (ruta.startsWith('/categorias-material')) return Promise.resolve(CATEGORIAS);
    if (ruta.startsWith('/unidades-medida')) return Promise.resolve(UNIDADES);
    return Promise.resolve([]);
  });
});

describe('contarFiltros', () => {
  it('sin filtros cuenta cero', () => {
    expect(contarFiltros({})).toBe(0);
  });

  it('REGRESION: ver solo los materiales en uso NO cuenta como filtro', () => {
    // Es lo normal: si contara, el boton mostraria un "(1)" permanente y el
    // aviso de "listado acotado" perderia sentido de tanto aparecer.
    expect(contarFiltros({ mostrar: 'activos' })).toBe(0);
  });

  it('pedir los jubilados SI cuenta: el listado deja de ser el habitual', () => {
    expect(contarFiltros({ mostrar: 'inactivos' })).toBe(1);
    expect(contarFiltros({ mostrar: 'todos' })).toBe(1);
  });

  it('REGRESION: la busqueda por nombre NO cuenta como filtro', () => {
    // Tiene su propio campo visible; contarla haria aparecer un "(1)" en el
    // boton de filtros cada vez que alguien escribe en el buscador.
    expect(contarFiltros({ buscar: 'cable' })).toBe(0);
  });

  it('REGRESION: stockMin 0 cuenta como filtro puesto', () => {
    // Es un filtro util —ver que esta en cero— y con una comprobacion de
    // verdad/falsedad se perderia.
    expect(contarFiltros({ stockMin: 0 })).toBe(1);
  });

  it('el orden no cuenta como filtro: no achica el listado', () => {
    expect(contarFiltros({ ordenarPor: 'stock', direccion: 'desc' })).toBe(0);
  });

  it('suma los filtros puestos', () => {
    expect(contarFiltros({ categoriaId: 'c1', stockMin: 10, bajoStock: true })).toBe(3);
  });
});

describe('FiltrosMateriales', () => {
  it('filtra por categoria', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole('option', { name: 'Bulonería' });

    await usuario.selectOptions(screen.getByLabelText(/categoría/i), 'c1');
    expect(alCambiar).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: 'c1' }));
  });

  it('ordena por stock descendente', async () => {
    const usuario = userEvent.setup();
    abrir();
    await usuario.selectOptions(screen.getByLabelText(/ordenar por/i), 'stock');
    expect(alCambiar).toHaveBeenCalledWith(expect.objectContaining({ ordenarPor: 'stock' }));

    alCambiar.mockClear();
    await usuario.selectOptions(screen.getByLabelText('Orden'), 'desc');
    expect(alCambiar).toHaveBeenCalledWith(expect.objectContaining({ direccion: 'desc' }));
  });

  it('REGRESION: elegir "sin unidad" descarta el unidadId', async () => {
    // Pedir una unidad Y "sin unidad" a la vez devolveria siempre vacio, sin
    // que se entienda por que.
    const usuario = userEvent.setup();
    abrir({ unidadId: 'u1' });
    await screen.findByRole('option', { name: /Unidad \(u\)/ });

    await usuario.selectOptions(screen.getByLabelText(/unidad/i), 'SIN');
    expect(alCambiar).toHaveBeenCalledWith(
      expect.objectContaining({ sinUnidad: true, unidadId: undefined }),
    );
  });

  it('elegir una unidad apaga el "sin unidad"', async () => {
    const usuario = userEvent.setup();
    abrir({ sinUnidad: true });
    await screen.findByRole('option', { name: /Unidad \(u\)/ });

    await usuario.selectOptions(screen.getByLabelText(/unidad/i), 'u1');
    expect(alCambiar).toHaveBeenCalledWith(
      expect.objectContaining({ sinUnidad: false, unidadId: 'u1' }),
    );
  });

  it('marca los que estan bajo su stock minimo', async () => {
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(screen.getByRole('checkbox'));
    expect(alCambiar).toHaveBeenCalledWith(expect.objectContaining({ bajoStock: true }));
  });

  it('el boton de limpiar solo aparece con filtros puestos', () => {
    abrir();
    expect(screen.queryByRole('button', { name: /limpiar/i })).not.toBeInTheDocument();
  });

  it('REGRESION: limpiar conserva la busqueda por nombre', async () => {
    // Es un campo aparte y visible: borrarlo desde "limpiar filtros" haria
    // desaparecer texto que la persona ve escrito en pantalla.
    const usuario = userEvent.setup();
    abrir({ buscar: 'cable', categoriaId: 'c1', stockMin: 5 });

    await usuario.click(await screen.findByRole('button', { name: /limpiar/i }));
    expect(alCambiar).toHaveBeenCalledWith({ buscar: 'cable' });
  });

  it('el boton de limpiar muestra cuantos filtros hay', async () => {
    abrir({ categoriaId: 'c1', bajoStock: true });
    expect(await screen.findByRole('button', { name: /limpiar filtros \(2\)/i })).toBeInTheDocument();
  });
});
