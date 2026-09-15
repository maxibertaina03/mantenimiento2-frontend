import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La pantalla que reparte permisos.
 *
 * Lo que protege: que lo que se marca sea exactamente lo que se guarda, y que
 * al administrador no se le pueda quitar la llave. Un error acá deja gente sin
 * poder trabajar, o peor, deja el sistema sin nadie capaz de arreglarlo.
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

const { PermisosPage } = await import('./PermisosPage');

const CATALOGO = [
  { permiso: 'ordenes.ver', grupo: 'Compras', etiqueta: 'Ver órdenes de compra' },
  { permiso: 'ordenes.editar', grupo: 'Compras', etiqueta: 'Crear, editar y anular órdenes' },
  { permiso: 'materiales.ver', grupo: 'Materiales', etiqueta: 'Ver el listado y las fichas' },
  {
    permiso: 'permisos.administrar',
    grupo: 'Administración',
    etiqueta: 'Cambiar qué puede hacer cada rol',
  },
];

function servidor(porRol: Record<string, string[]> = {}) {
  const guardados: { rol: string; permisos: string[] }[] = [];
  apiRequestMock.mockImplementation((rutaCruda: string, config?: { method?: string; body?: unknown }) => {
    const ruta = String(rutaCruda ?? '');
    if (config?.method === 'PUT') {
      const rol = ruta.split('/').pop() as string;
      const permisos = (config.body as { permisos: string[] }).permisos;
      guardados.push({ rol, permisos });
      return Promise.resolve(permisos);
    }
    if (ruta === '/permisos/catalogo') return Promise.resolve(CATALOGO);
    if (ruta === '/permisos') {
      return Promise.resolve({
        ADMIN: CATALOGO.map((c) => c.permiso),
        GERENCIA: ['ordenes.ver', 'materiales.ver'],
        ADMINISTRATIVO: ['ordenes.ver'],
        MANTENIMIENTO: [],
        ...porRol,
      });
    }
    return Promise.resolve({});
  });
  return guardados;
}

function mostrar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PermisosPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('PermisosPage', () => {
  it('muestra los permisos agrupados, con su nombre en castellano', async () => {
    servidor();
    mostrar();

    expect(await screen.findByText('Compras')).toBeInTheDocument();
    expect(screen.getByText('Materiales')).toBeInTheDocument();
    expect(screen.getByLabelText('Ver órdenes de compra')).toBeInTheDocument();
  });

  it('arranca con lo que el rol tiene guardado', async () => {
    servidor();
    mostrar();

    // Gerencia empieza seleccionado.
    await waitFor(() => expect(screen.getByLabelText('Ver órdenes de compra')).toBeChecked());
    expect(screen.getByLabelText('Ver el listado y las fichas')).toBeChecked();
    expect(screen.getByLabelText('Crear, editar y anular órdenes')).not.toBeChecked();
  });

  it('REGRESION: guarda exactamente lo marcado', async () => {
    // Si guardara otra cosa, alguien quedaria con permisos que nadie le dio, o
    // sin los que si le dieron, y nadie sabria por que.
    const guardados = servidor();
    mostrar();

    await waitFor(() => expect(screen.getByLabelText('Ver órdenes de compra')).toBeChecked());
    await userEvent.click(screen.getByLabelText('Crear, editar y anular órdenes'));
    await userEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    await waitFor(() => expect(guardados).toHaveLength(1));
    expect(guardados[0].rol).toBe('GERENCIA');
    expect([...guardados[0].permisos].sort()).toEqual([
      'materiales.ver',
      'ordenes.editar',
      'ordenes.ver',
    ]);
  });

  it('sin cambios no deja guardar', async () => {
    servidor();
    mostrar();

    await waitFor(() => expect(screen.getByLabelText('Ver órdenes de compra')).toBeChecked());
    expect(screen.getByRole('button', { name: /Guardar cambios/i })).toBeDisabled();
  });

  it('deshacer vuelve a lo guardado', async () => {
    servidor();
    mostrar();

    await waitFor(() => expect(screen.getByLabelText('Ver órdenes de compra')).toBeChecked());
    await userEvent.click(screen.getByLabelText('Ver órdenes de compra'));
    expect(screen.getByLabelText('Ver órdenes de compra')).not.toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: /Deshacer/i }));
    expect(screen.getByLabelText('Ver órdenes de compra')).toBeChecked();
  });

  it('REGRESION: al administrador no se le puede destildar la llave', async () => {
    // Si se pudiera, y es el unico administrador, el sistema queda sin nadie
    // capaz de volver a habilitarlo y hay que arreglarlo por fuera.
    servidor();
    mostrar();

    await waitFor(() => expect(screen.getByLabelText('Ver órdenes de compra')).toBeChecked());
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'ADMIN');

    await waitFor(() =>
      expect(screen.getByLabelText('Cambiar qué puede hacer cada rol')).toBeDisabled(),
    );
  });

  it('avisa por que esa casilla esta bloqueada', async () => {
    servidor();
    mostrar();

    await waitFor(() => expect(screen.getByLabelText('Ver órdenes de compra')).toBeChecked());
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'ADMIN');

    expect(await screen.findByText(/sin nadie capaz de volver a habilitarlo/i)).toBeInTheDocument();
  });

  it('cambiar de rol trae lo de ese rol', async () => {
    servidor();
    mostrar();

    await waitFor(() => expect(screen.getByLabelText('Ver órdenes de compra')).toBeChecked());
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'MANTENIMIENTO');

    await waitFor(() =>
      expect(screen.getByLabelText('Ver órdenes de compra')).not.toBeChecked(),
    );
  });
});
