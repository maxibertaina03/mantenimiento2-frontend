import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OtrasFotosEquipo } from './OtrasFotosEquipo';

/**
 * Las otras fotos de un equipo: la chapa característica, el tablero.
 *
 * Lo que se cuida: que la descripción viaje con la foto, que «Principal» le
 * pida al servidor el cambio y que sin permiso no se ofrezca tocar nada.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

// Achicar una imagen necesita un canvas de verdad; acá alcanza con el resultado.
vi.mock('@/lib/comprimirImagen', () => ({
  comprimirImagen: vi.fn(async (archivo: File) => ({
    base64: 'QUJD',
    nombreArchivo: archivo.name,
    bytesOriginales: 10,
    bytesFinales: 5,
  })),
}));

const chapa = {
  id: 'f-1',
  url: 'https://almacen/chapa.jpg',
  descripcion: 'Chapa característica',
  subidoEn: '2026-10-06T12:00:00Z',
  subidoPor: null,
};

function servidor(permisos: string[], fotos: unknown[] = [chapa]) {
  apiRequestMock.mockImplementation((rutaCruda: string) => {
    const ruta = String(rutaCruda ?? '');
    if (ruta.startsWith('/permisos/mios')) return Promise.resolve({ rol: 'X', permisos });
    if (ruta === '/equipos/eq/fotos') return Promise.resolve(fotos);
    return Promise.resolve(undefined);
  });
}

function mostrar(almacenDisponible = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <OtrasFotosEquipo
        equipoId="eq"
        nombreEquipo="Compresor 1"
        almacenDisponible={almacenDisponible}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => apiRequestMock.mockReset());

describe('OtrasFotosEquipo', () => {
  it('muestra la chapa y la abre grande al tocarla', async () => {
    servidor(['equipos.ver']);
    mostrar();

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Ver grande: Chapa característica',
      }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Foto de Chapa característica' }),
    ).toBeInTheDocument();
  });

  it('sube la foto con lo que se ve', async () => {
    servidor(['equipos.ver', 'equipos.editar'], []);
    mostrar();

    await userEvent.type(
      await screen.findByRole('combobox', {
        name: 'Qué se ve en la foto nueva',
      }),
      'Tablero',
    );
    const entrada = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(entrada, new File(['x'], 'tablero.jpg', { type: 'image/jpeg' }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/equipos/eq/fotos', {
        method: 'POST',
        body: {
          imagenBase64: 'QUJD',
          nombreArchivo: 'tablero.jpg',
          descripcion: 'Tablero',
        },
      }),
    );
  });

  it('«Principal» pide el cambio al servidor', async () => {
    servidor(['equipos.ver', 'equipos.editar']);
    mostrar();

    await userEvent.click(await screen.findByRole('button', { name: '★ Principal' }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/equipos/eq/fotos/f-1/principal', {
        method: 'POST',
      }),
    );
  });

  it('sin permiso de edición no ofrece subir, cambiar ni borrar', async () => {
    servidor(['equipos.ver']);
    mostrar();

    await screen.findByRole('button', { name: /Ver grande/ });
    expect(screen.queryByRole('button', { name: '★ Principal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Borrar/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Qué se ve en la foto nueva' }),
    ).not.toBeInTheDocument();
  });

  it('sin almacén y sin fotos no muestra nada', async () => {
    servidor(['equipos.ver', 'equipos.editar'], []);
    mostrar(false);

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledWith('/equipos/eq/fotos'));
    expect(screen.queryByText('Más fotos')).not.toBeInTheDocument();
  });
});
