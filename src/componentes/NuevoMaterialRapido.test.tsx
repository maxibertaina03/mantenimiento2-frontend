import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NuevoMaterialRapido } from './NuevoMaterialRapido';

/**
 * Alta rápida desde la orden de compra: es normal comprar algo que nunca se
 * compró. Lo que estos tests protegen es que se pueda crear sin salir de la
 * orden y que el material quede listo para usar.
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

const CATEGORIAS = [
  { id: 'c1', nombre: 'Bulonería', descripcion: null },
  { id: 'c2', nombre: 'Eléctrico', descripcion: null },
];
const UNIDADES = [
  { id: 'u1', nombre: 'Unidad', simbolo: 'u', orden: 10, activo: true, materiales: 0 },
  { id: 'u2', nombre: 'Metro', simbolo: 'm', orden: 90, activo: true, materiales: 0 },
];

function envolver(nodo: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{nodo}</QueryClientProvider>;
}

const alCreado = vi.fn();
const abrir = (nombre = 'Valvula esferica 1/4') =>
  render(
    envolver(
      <NuevoMaterialRapido nombreInicial={nombre} onCreado={alCreado} onCerrar={() => {}} />,
    ),
  );

beforeEach(() => {
  apiRequestMock.mockReset();
  alCreado.mockReset();
  apiRequestMock.mockImplementation((ruta: string, opciones?: { method?: string }) => {
    if (ruta.startsWith('/categorias-material') && !opciones?.method)
      return Promise.resolve(CATEGORIAS);
    if (ruta.startsWith('/unidades-medida')) return Promise.resolve(UNIDADES);
    if (ruta === '/categorias-material')
      return Promise.resolve({ id: 'c3', nombre: 'Nueva', descripcion: null });
    if (ruta === '/materiales')
      return Promise.resolve({ id: 'm9', nombre: 'Valvula esferica 1/4', unidad: 'u' });
    return Promise.resolve([]);
  });
});

describe('NuevoMaterialRapido', () => {
  it('REGRESION: arranca con el nombre que se buscó y no aparecio', async () => {
    // Si no, habria que reescribirlo, que es justo lo que se quiere evitar.
    abrir();
    expect(await screen.findByDisplayValue('Valvula esferica 1/4')).toBeInTheDocument();
  });

  it('crea el material con categoria y unidad, y avisa quien lo llamo', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole('option', { name: 'Bulonería' });

    await usuario.selectOptions(screen.getByLabelText(/categoría/i), 'c1');
    await usuario.selectOptions(screen.getByLabelText(/unidad/i), 'u2');
    await usuario.click(screen.getByRole('button', { name: /crear y usar/i }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/materiales',
        expect.objectContaining({
          method: 'POST',
          body: { nombre: 'Valvula esferica 1/4', categoriaId: 'c1', unidadId: 'u2' },
        }),
      ),
    );
    await waitFor(() => expect(alCreado).toHaveBeenCalledWith(expect.objectContaining({ id: 'm9' })));
  });

  it('recorta los espacios del nombre', async () => {
    const usuario = userEvent.setup();
    abrir('   Buje bronce   ');
    await screen.findByRole('option', { name: 'Bulonería' });

    await usuario.selectOptions(screen.getByLabelText(/categoría/i), 'c1');
    await usuario.selectOptions(screen.getByLabelText(/unidad/i), 'u1');
    await usuario.click(screen.getByRole('button', { name: /crear y usar/i }));

    await waitFor(() => {
      const alta = apiRequestMock.mock.calls.find(
        ([r, o]) => r === '/materiales' && o?.method === 'POST',
      );
      expect(alta?.[1].body.nombre).toBe('Buje bronce');
    });
  });

  it('REGRESION: no crea nada sin categoria ni unidad', async () => {
    // Son obligatorias: un material sin unidad rompe los reportes por unidad.
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole('option', { name: 'Bulonería' });

    await usuario.click(screen.getByRole('button', { name: /crear y usar/i }));

    expect(
      apiRequestMock.mock.calls.find(([r, o]) => r === '/materiales' && o?.method === 'POST'),
    ).toBeUndefined();
  });

  it('deja crear una categoria sin salir del formulario', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole('option', { name: 'Bulonería' });

    await usuario.click(screen.getByRole('button', { name: /crear una categoría nueva/i }));
    await usuario.type(screen.getByPlaceholderText(/nombre de la nueva categoría/i), 'Válvulas');
    await usuario.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/categorias-material',
        expect.objectContaining({ method: 'POST', body: { nombre: 'Válvulas' } }),
      ),
    );
  });

  it('aclara que el material se crea con stock 0', () => {
    abrir();
    expect(screen.getByText(/stock 0/i)).toBeInTheDocument();
  });
});
