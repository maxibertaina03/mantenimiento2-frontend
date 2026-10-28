import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Credencial } from '@/api/credenciales';
import { CredencialesPage } from './CredencialesPage';

/**
 * El baúl: cada credencial muestra a la vista lo que hace falta para usarla
 * (usuario, dónde, equipo, notas), y el tipo sale de un catálogo al que se le
 * agregan tipos desde el formulario.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const CREDENCIAL: Credencial = {
  id: 'c1',
  nombre: 'RENDER',
  tipoId: 't-servicio',
  tipoNombre: 'Servicio',
  usuario: 'telecomunicaciones@lacteoslastres.com.ar',
  url: 'https://dashboard.render.com/login',
  notas: 'Cuenta del servidor del sistema',
  equipoItId: null,
  equipoItNombre: null,
  rotarCadaDias: 90,
  rotadaEn: '2026-10-27T12:00:00.000Z',
  proximaRotacion: '2027-01-25T12:00:00.000Z',
  estadoRotacion: 'al-dia',
  rotaciones: 0,
  vistas: 1,
  activo: true,
  creadoEn: '2026-10-27T12:00:00.000Z',
};

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation(
    (ruta: string, config?: { method?: string; body?: { nombre?: string } }) => {
      if (ruta.startsWith('/permisos/mios')) {
        return Promise.resolve({
          rol: 'ADMIN',
          permisos: ['credenciales.ver', 'credenciales.editar', 'credenciales.revelar'],
        });
      }
      if (ruta === '/tipos-credencial' && config?.method === 'POST') {
        return Promise.resolve({ id: 't-nuevo', nombre: config.body?.nombre });
      }
      if (ruta === '/tipos-credencial') {
        return Promise.resolve([
          { id: 't-correo', nombre: 'Casilla de correo' },
          { id: 't-servicio', nombre: 'Servicio' },
        ]);
      }
      if (ruta === '/credenciales' && config?.method === 'POST') {
        return Promise.resolve(CREDENCIAL);
      }
      if (ruta === '/credenciales') {
        return Promise.resolve({ datos: [CREDENCIAL], total: 1, pagina: 1, limite: 20 });
      }
      if (ruta.startsWith('/equipos-it')) {
        return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
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
        <CredencialesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CredencialesPage', () => {
  it('cada credencial muestra su tipo, usuario, dónde se usa (como enlace) y las notas', async () => {
    mostrar();
    expect(await screen.findByText('RENDER')).toBeInTheDocument();
    expect(screen.getByText('Servicio', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.getByText('telecomunicaciones@lacteoslastres.com.ar')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'https://dashboard.render.com/login' }),
    ).toHaveAttribute('href', 'https://dashboard.render.com/login');
    expect(screen.getByText('Cuenta del servidor del sistema')).toBeInTheDocument();
  });

  it('se agrega un tipo desde el formulario y la credencial se guarda con él', async () => {
    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(await screen.findByRole('button', { name: /Nueva credencial/ }));
    const ventana = await screen.findByRole('dialog');

    await usuario.type(within(ventana).getByLabelText(/Nombre \*/), 'Grabadora del portón');
    await usuario.selectOptions(within(ventana).getByLabelText('Tipo'), '__agregar__');
    await usuario.type(
      within(ventana).getByLabelText('Nombre del tipo nuevo'),
      'Cámara de seguridad',
    );
    await usuario.click(within(ventana).getByRole('button', { name: 'Agregar' }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/tipos-credencial', {
        method: 'POST',
        body: { nombre: 'Cámara de seguridad' },
      }),
    );

    await usuario.type(within(ventana).getByLabelText(/Contraseña \*/), 'clave-1');
    await usuario.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/credenciales', {
        method: 'POST',
        body: expect.objectContaining({
          nombre: 'Grabadora del portón',
          tipoId: 't-nuevo',
          equipoItId: null,
          secreto: 'clave-1',
        }),
      }),
    );
  });
});
