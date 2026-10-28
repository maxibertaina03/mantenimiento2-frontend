import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CredencialesDelEquipo } from './CredencialesDelEquipo';

/**
 * Las contraseñas de un equipo de informática, en su ficha.
 *
 * Lo que hay que proteger acá son dos cosas: que no las vea quien no tiene
 * permiso, y que esta sección NO revele los valores. Ver una contraseña sigue
 * siendo un pedido aparte que queda registrado; si esta lista las mostrara, ese
 * registro dejaría de valer para nada.
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

const CREDENCIAL = {
  id: 'c1',
  nombre: 'Inicio de sesion PC recepcion',
  tipoId: 't3',
  tipoNombre: 'Equipo',
  usuario: 'recepcion',
  url: null,
  notas: null,
  equipoItId: 'eq-1',
  equipoItNombre: 'PC-014',
  rotarCadaDias: 90,
  rotadaEn: '2026-06-01T10:00:00.000Z',
  proximaRotacion: '2026-08-30T10:00:00.000Z',
  activo: true,
  creadoEn: '2026-06-01T10:00:00.000Z',
};

let permisos: string[] = [];

beforeEach(() => {
  apiRequestMock.mockReset();
  permisos = ['it.ver', 'credenciales.ver'];
  apiRequestMock.mockImplementation((rutaCruda: string, config?: { method?: string }) => {
    const ruta = String(rutaCruda ?? '');
    if (ruta.startsWith('/usuarios/me')) {
      return Promise.resolve({ id: 'u1', nombre: 'informatica', rol: 'ADMIN' });
    }
    if (ruta.startsWith('/permisos/mios')) return Promise.resolve({ rol: 'ADMIN', permisos });
    if (ruta.startsWith('/tipos-credencial')) return Promise.resolve([]);
    if (ruta.endsWith('/revelar')) return Promise.resolve({ secreto: 'clave-de-prueba' });
    if (ruta === '/credenciales' && config?.method === 'POST') {
      return Promise.resolve({ ...CREDENCIAL, id: 'c2' });
    }
    if (ruta.startsWith('/credenciales')) {
      return Promise.resolve({ datos: [CREDENCIAL], total: 1, pagina: 1, limite: 50 });
    }
    return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
  });
});

function mostrar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const nodo: ReactNode = (
    <QueryClientProvider client={qc}>
      <CredencialesDelEquipo equipoItId="eq-1" equipoNombre="PC-014" />
    </QueryClientProvider>
  );
  return render(nodo);
}

describe('CredencialesDelEquipo', () => {
  it('lista las contraseñas que pertenecen al equipo', async () => {
    mostrar();

    expect(await screen.findByText('Inicio de sesion PC recepcion')).toBeInTheDocument();
    // El usuario va al lado del nombre. getAllByText porque "recepcion"
    // aparece en los dos.
    expect(screen.getAllByText(/recepcion/).length).toBeGreaterThan(1);
  });

  it('pide solo las de ese equipo', async () => {
    mostrar();

    await waitFor(() => {
      const llamada = apiRequestMock.mock.calls.find((c) => String(c[0]).startsWith('/credenciales'));
      expect(llamada?.[1].query.equipoItId).toBe('eq-1');
    });
  });

  it('REGRESION: sin permiso de ver credenciales no muestra nada ni pide nada', async () => {
    // Alguien puede tener acceso a los equipos de informatica y no al baul. Si
    // esta seccion se cargara igual, le estaria diciendo que esa maquina tiene
    // tres claves guardadas, que ya es mas de lo que le corresponde saber.
    permisos = ['it.ver'];
    const { container } = mostrar();

    await waitFor(() => {
      expect(
        apiRequestMock.mock.calls.filter((c) => String(c[0]).startsWith('/credenciales')),
      ).toHaveLength(0);
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('REGRESION: no revela ningun valor de contraseña sin pedirlo', async () => {
    // La lista muestra nombres. El valor se pide aparte, y ese pedido queda
    // registrado con quien lo hizo.
    permisos = ['it.ver', 'credenciales.ver', 'credenciales.revelar'];
    mostrar();
    await screen.findByText('Inicio de sesion PC recepcion');

    const pedidos = apiRequestMock.mock.calls.map((c) => String(c[0]));
    expect(pedidos.some((r) => r.includes('revelar'))).toBe(false);
  });

  it('«Ver» pide la contraseña con el mismo aviso y registro que el baúl', async () => {
    const usuario = userEvent.setup();
    permisos = ['it.ver', 'credenciales.ver', 'credenciales.revelar'];
    mostrar();

    await usuario.click(
      await screen.findByRole('button', { name: /Ver la contraseña de Inicio de sesion/ }),
    );
    const ventana = screen.getByRole('dialog');
    expect(within(ventana).getByText(/queda registrado/i)).toBeInTheDocument();
    await usuario.click(within(ventana).getByRole('button', { name: /Mostrar la contraseña/ }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/credenciales/c1/revelar', { method: 'POST' }),
    );
    expect(await within(ventana).findByDisplayValue('clave-de-prueba')).toBeInTheDocument();
  });

  it('sin permiso de revelar no ofrece «Ver» ni «Agregar»', async () => {
    mostrar();
    await screen.findByText('Inicio de sesion PC recepcion');
    expect(screen.queryByRole('button', { name: /Ver la contraseña/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Agregar contraseña/ })).not.toBeInTheDocument();
  });

  it('«Agregar contraseña» la carga con el equipo ya elegido', async () => {
    // Un equipo puede tener varias: el inicio de sesión de la PC y su AnyDesk.
    const usuario = userEvent.setup();
    permisos = ['it.ver', 'credenciales.ver', 'credenciales.editar'];
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /Agregar contraseña/ }));
    const ventana = screen.getByRole('dialog');
    await usuario.type(within(ventana).getByLabelText(/Nombre \*/), 'AnyDesk PC recepcion');
    await usuario.type(within(ventana).getByLabelText(/Contraseña \*/), 'clave-2');
    await usuario.click(within(ventana).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      const alta = apiRequestMock.mock.calls.find(
        (c) => c[0] === '/credenciales' && c[1]?.method === 'POST',
      );
      expect(alta?.[1].body).toMatchObject({
        nombre: 'AnyDesk PC recepcion',
        secreto: 'clave-2',
        equipoItId: 'eq-1',
      });
    });
  });

  it('avisa cuando el equipo no tiene ninguna cargada', async () => {
    apiRequestMock.mockImplementation((rutaCruda: string) => {
      const ruta = String(rutaCruda ?? '');
      if (ruta.startsWith('/permisos/mios')) return Promise.resolve({ rol: 'ADMIN', permisos });
      return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 50 });
    });

    mostrar();

    expect(await screen.findByText(/no tiene ninguna contrase/i)).toBeInTheDocument();
  });
});
