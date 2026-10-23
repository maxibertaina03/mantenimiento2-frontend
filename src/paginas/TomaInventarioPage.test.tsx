import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetalleToma, RenglonToma } from '@/tipos/inventario';
import { TomaInventarioPage } from './TomaInventarioPage';

/**
 * Contar: a ciegas mientras se cuenta, lo contado se guarda al salir del
 * campo, y antes de ajustar se ve qué va a pasar.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const renglon = (id: string, nombre: string, extra: Partial<RenglonToma> = {}): RenglonToma => ({
  id,
  materialId: `mat-${id}`,
  materialNombre: nombre,
  unidad: 'u',
  estanteriaId: 'est-a',
  estanteriaNombre: 'A',
  fila: 1,
  contado: null,
  stockAlContar: null,
  stockActual: 10,
  contadoEn: null,
  contadoPorNombre: null,
  resultado: null,
  ...extra,
});

const DETALLE: DetalleToma = {
  toma: {
    id: 'toma-1',
    numero: 'TI-2026-0001',
    categoriaId: 'c1',
    categoriaNombre: 'Electricidad',
    estanteriaId: null,
    estanteriaNombre: null,
    estado: 'ABIERTA',
    notas: null,
    abiertaEn: '2026-10-16T10:00:00.000Z',
    abiertaPorNombre: 'Facundo',
    cerradaEn: null,
    cerradaPorNombre: null,
    motivoAnulacion: null,
    totalRenglones: 3,
    contados: 1,
  },
  renglones: [
    renglon('r1', 'Cable 2,5 mm'),
    renglon('r2', 'Llave térmica'),
    renglon('r3', 'Cinta aisladora', { contado: 6, stockAlContar: 8, contadoPorNombre: 'Facundo' }),
  ],
  resumen: {
    total: 3,
    contados: 1,
    sinContar: 2,
    conDiferencia: 1,
    ajustados: 0,
    sinDiferencia: 0,
    recontar: 0,
  },
  reubicaciones: [],
};

function mostrar() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/inventario/toma-1']}>
        <Routes>
          <Route path="/inventario/:id" element={<TomaInventarioPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation(
    (ruta: string, config?: { method?: string; body?: unknown }) => {
      if (ruta.startsWith('/permisos/mios')) {
        return Promise.resolve({
          rol: 'ADMIN',
          permisos: ['inventario.ver', 'inventario.contar', 'inventario.ajustar'],
        });
      }
      if (ruta === '/tomas-inventario/toma-1') return Promise.resolve(DETALLE);
      if (ruta === '/estanterias-material') {
        return Promise.resolve([
          { id: 'est-a', nombre: 'A', orden: 1, activo: true, materiales: 3 },
          { id: 'est-b', nombre: 'B', orden: 2, activo: true, materiales: 0 },
        ]);
      }
      if (ruta.endsWith('/reubicar')) return Promise.resolve(renglon('r1', 'Cable 2,5 mm'));
      if (ruta.endsWith('/contar-en-cero')) {
        return Promise.resolve({ ...DETALLE, contadosEnCero: 1, salteados: [] });
      }
      if (config?.method === 'PATCH') {
        const contado = (config.body as { contado: number }).contado;
        return Promise.resolve(renglon('r1', 'Cable 2,5 mm', { contado, stockAlContar: 10 }));
      }
      if (ruta.endsWith('/confirmar')) {
        return Promise.resolve({
          ...DETALLE,
          toma: { ...DETALLE.toma, estado: 'CERRADA' },
          ajustados: 1,
          sinDiferencia: 0,
          recontar: 0,
          errores: [],
        });
      }
      return Promise.resolve(null);
    },
  );
});

describe('TomaInventarioPage', () => {
  it('arranca en «Por contar» y no muestra cuánto figura: se cuenta a ciegas', async () => {
    mostrar();
    expect(await screen.findByText('Cable 2,5 mm')).toBeInTheDocument();
    expect(screen.queryByText('Cinta aisladora')).not.toBeInTheDocument(); // ya contada
    expect(screen.queryByText(/Figuraba/)).not.toBeInTheDocument();
  });

  it('se puede reubicar un material: elige estantería y fila, y se guarda', async () => {
    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(await screen.findByRole('button', { name: 'Reubicar Cable 2,5 mm' }));
    const ventana = await screen.findByRole('dialog');
    // Al mismo lugar no deja guardar.
    expect(within(ventana).getByRole('button', { name: /^Reubicar$/ })).toBeDisabled();

    await usuario.selectOptions(await within(ventana).findByRole('combobox'), 'est-b');
    const fila = within(ventana).getByRole('spinbutton');
    await usuario.clear(fila);
    await usuario.type(fila, '4');
    await usuario.click(within(ventana).getByRole('button', { name: /^Reubicar$/ }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/tomas-inventario/toma-1/renglones/r1/reubicar',
        { method: 'POST', body: { estanteriaId: 'est-b', fila: 4 } },
      ),
    );
  });

  it('lo reubicado se lista en la toma', async () => {
    apiRequestMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/permisos/mios')) {
        return Promise.resolve({ rol: 'ADMIN', permisos: ['inventario.ver'] });
      }
      if (ruta === '/tomas-inventario/toma-1') {
        return Promise.resolve({
          ...DETALLE,
          reubicaciones: [
            {
              id: 'x1',
              materialId: 'mat-r1',
              materialNombre: 'Cable 2,5 mm',
              desdeEstanteria: 'A',
              desdeFila: 1,
              haciaEstanteria: 'B',
              haciaFila: 4,
              hechaEn: '2026-10-22T12:00:00.000Z',
              hechaPorNombre: 'Facundo',
            },
          ],
        });
      }
      return Promise.resolve(null);
    });
    mostrar();
    expect(await screen.findByText(/Reubicados en esta toma · 1/)).toBeInTheDocument();
    expect(screen.getByText(/A · fila 1 → B · fila 4/)).toBeInTheDocument();
    // Sin permiso de contar, no aparece el botón.
    expect(screen.queryByRole('button', { name: /^Reubicar / })).not.toBeInTheDocument();
  });

  it('lo que figura en 0 va a «En cero», y se confirma junto', async () => {
    const usuario = userEvent.setup();
    const conCero: DetalleToma = {
      ...DETALLE,
      renglones: [...DETALLE.renglones, renglon('r4', 'Fusible 10 A', { stockActual: 0 })],
    };
    apiRequestMock.mockImplementation(
      (ruta: string, config?: { method?: string; body?: unknown }) => {
        if (ruta.startsWith('/permisos/mios')) {
          return Promise.resolve({
            rol: 'ADMIN',
            permisos: ['inventario.ver', 'inventario.contar'],
          });
        }
        if (ruta === '/tomas-inventario/toma-1') return Promise.resolve(conCero);
        if (ruta.endsWith('/contar-en-cero')) {
          return Promise.resolve({
            ...conCero,
            contadosEnCero: 1,
            salteados: [],
            body: config?.body,
          });
        }
        return Promise.resolve(null);
      },
    );
    mostrar();
    // En «Por contar» no está, pero se avisa.
    expect(await screen.findByText('Cable 2,5 mm')).toBeInTheDocument();
    expect(screen.queryByText('Fusible 10 A')).not.toBeInTheDocument();
    expect(screen.getByText(/que figuran en 0/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('tab', { name: /En cero/ }));
    expect(screen.getByText('Fusible 10 A')).toBeInTheDocument();
    expect(screen.queryByText('Cable 2,5 mm')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /Confirmar que están en 0/ }));
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /Sí, están en 0/ }),
    );
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/tomas-inventario/toma-1/contar-en-cero', {
        method: 'POST',
        body: { renglonIds: ['r4'] },
      }),
    );
  });

  it('lo contado se guarda al salir del campo', async () => {
    const usuario = userEvent.setup();
    mostrar();
    const campo = await screen.findByLabelText('Contado de Cable 2,5 mm');
    await usuario.type(campo, '7,5');
    await usuario.tab();

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/tomas-inventario/toma-1/renglones/r1', {
        method: 'PATCH',
        body: { contado: 7.5 },
      }),
    );
  });

  it('en «Con diferencia» se ve cuánto figuraba y cuánto falta', async () => {
    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(await screen.findByRole('tab', { name: /con diferencia/i }));
    expect(screen.getByText(/Figuraba 8/)).toBeInTheDocument();
    expect(screen.getByText(/faltan 2/)).toBeInTheDocument();
  });

  it('antes de ajustar dice qué va a pasar, y lo no contado no se toca', async () => {
    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(await screen.findByRole('button', { name: /confirmar y ajustar/i }));
    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText(/no se tocan/)).toBeInTheDocument();
    expect(
      within(modal).getByText(/Cinta aisladora: figuraba 8, se contaron 6/),
    ).toBeInTheDocument();

    await usuario.click(within(modal).getByRole('button', { name: 'Ajustar el stock' }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/tomas-inventario/toma-1/confirmar', {
        method: 'POST',
      }),
    );
    expect(await screen.findByText(/Toma cerrada/)).toBeInTheDocument();
  });
});
