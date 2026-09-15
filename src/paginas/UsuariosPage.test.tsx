import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La pantalla donde se le asigna el rol a cada persona.
 *
 * Existe este archivo por un error concreto: el desplegable ofrecía dos roles
 * cuando el sistema ya tenía cuatro, porque la lista estaba escrita a mano acá.
 * Elegir "Operario" terminaba en un error del servidor que no explicaba nada.
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

const { UsuariosPage } = await import('./UsuariosPage');

const USUARIOS = [
  {
    id: 'u1',
    nombre: 'informatica',
    email: 'tele@lacteoslastres.com.ar',
    rol: 'ADMIN',
    idExterno: 'clerk_1',
    creadoEn: '2026-08-27T12:46:00.000Z',
  },
  {
    id: 'u2',
    nombre: 'facundo',
    email: 'mantenimiento2@lacteoslastres.com.ar',
    rol: 'MANTENIMIENTO',
    idExterno: 'clerk_2',
    creadoEn: '2026-08-28T10:58:00.000Z',
  },
];

function servidor() {
  const guardados: { id: string; rol: string }[] = [];
  apiRequestMock.mockImplementation(
    (rutaCruda: string, config?: { method?: string; body?: unknown }) => {
      const ruta = String(rutaCruda ?? '');
      if (config?.method === 'PATCH') {
        const id = ruta.split('/').pop() as string;
        guardados.push({ id, rol: (config.body as { rol: string }).rol });
        return Promise.resolve({});
      }
      if (ruta.startsWith('/usuarios/me')) return Promise.resolve(USUARIOS[0]);
      if (ruta.startsWith('/permisos/mios')) {
        return Promise.resolve({ rol: 'ADMIN', permisos: ['usuarios.administrar'] });
      }
      if (ruta === '/permisos') return Promise.resolve({});
      if (ruta.startsWith('/usuarios')) {
        return Promise.resolve({ datos: USUARIOS, total: 2, pagina: 1, limite: 100 });
      }
      return Promise.resolve({});
    },
  );
  return guardados;
}

function mostrar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <UsuariosPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('UsuariosPage', () => {
  it('REGRESION: el desplegable ofrece los CUATRO roles', async () => {
    // Ofrecía dos. Elegir uno que el servidor no conoce devolvía
    // "rol must be one of the following values", que no le dice nada a nadie.
    servidor();
    mostrar();

    const desplegable = await screen.findByLabelText('Rol de facundo');
    const opciones = [...desplegable.querySelectorAll('option')].map((o) => o.textContent);
    expect(opciones).toEqual(['Administrador', 'Gerencia', 'Administrativo', 'Mantenimiento']);
  });

  it('cada desplegable arranca en el rol que la persona tiene', async () => {
    servidor();
    mostrar();

    expect(await screen.findByLabelText('Rol de facundo')).toHaveValue('MANTENIMIENTO');
    expect(screen.getByLabelText('Rol de informatica')).toHaveValue('ADMIN');
  });

  it('guarda el rol elegido', async () => {
    const guardados = servidor();
    mostrar();

    const desplegable = await screen.findByLabelText('Rol de facundo');
    await userEvent.selectOptions(desplegable, 'GERENCIA');

    await waitFor(() => expect(guardados).toEqual([{ id: 'u2', rol: 'GERENCIA' }]));
  });

  it('REGRESION: bajarse el propio rol pide confirmacion', async () => {
    // Es la forma mas facil de perder el acceso sin querer, y solo otro
    // administrador puede devolverlo.
    const guardados = servidor();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    mostrar();

    const desplegable = await screen.findByLabelText('Rol de informatica');
    await userEvent.selectOptions(desplegable, 'GERENCIA');

    expect(confirmar).toHaveBeenCalled();
    expect(guardados).toHaveLength(0);
    confirmar.mockRestore();
  });

  it('muestra que hace cada rol, para no elegir a ciegas', async () => {
    servidor();
    mostrar();

    expect(await screen.findByText(/Mira el sistema entero y no toca nada/i)).toBeInTheDocument();
    expect(screen.getByText(/las órdenes de compra/i)).toBeInTheDocument();
  });
});
