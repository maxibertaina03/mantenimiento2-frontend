import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InformesPage } from './InformesPage';
import { MisResultadosPage } from './MisResultadosPage';

/**
 * Los informes: que cada pestaña pida lo suyo, con el período elegido, y que
 * la comparación entre personas no aparezca para quien no la puede ver.
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

const SERIE = [{ tramo: '2026-10-05', PREVENTIVO: 1, CORRECTIVO: 2, MEJORA: 0, cerradas: 1 }];

const PERSONA = {
  usuarioId: 'ana',
  nombre: 'Ana',
  rol: 'MANTENIMIENTO',
  otCerradas: 4,
  otAbiertas: 1,
  tareasHechas: 9,
  tareasVencidas: 1,
  cumplimiento: 90,
  postergaciones: 0,
  pendientesHechos: 2,
  ocCreadas: 0,
};

let permisos: string[] = [];

beforeEach(() => {
  apiRequestMock.mockReset();
  permisos = ['informes.ver'];
  apiRequestMock.mockImplementation((ruta: string) => {
    if (ruta.startsWith('/permisos/mios')) return Promise.resolve({ rol: 'GERENCIA', permisos });
    if (ruta === '/informes/trabajos') {
      return Promise.resolve({
        resumen: {
          abiertas: 3,
          cerradas: 1,
          anuladas: 0,
          siguenAbiertas: 2,
          preventivas: 1,
          correctivas: 2,
          mejoras: 0,
          externas: 0,
          horasParada: 5,
          costoManoObra: 0,
          horasHastaCerrar: 30,
        },
        serie: SERIE,
        equipos: [{ nombre: 'Compresor 1', ordenes: 3, correctivas: 2, horasParada: 5 }],
        sectores: [],
      });
    }
    if (ruta === '/informes/compras') {
      return Promise.resolve({
        resumen: {
          ordenes: 2,
          recibidas: 1,
          borradores: 0,
          anuladas: 0,
          conFaltante: 0,
          monto: 150000,
          sinPrecio: 1,
          diasDeEntrega: 3,
        },
        serie: [{ tramo: '2026-10-05', ordenes: 2, monto: 150000 }],
        materiales: [
          {
            materialId: 'm1',
            material: 'Rulemán 6204',
            unidad: 'u',
            cantidad: 12,
            gastado: 120000,
            precioPromedio: 10000,
            ultimoPrecio: 11000,
            renglonesSinPrecio: 1,
            ordenes: 2,
            proveedores: ['Rulemanes SA'],
          },
        ],
        proveedores: [{ proveedor: 'Rulemanes SA', ordenes: 2, monto: 150000, diasDeEntrega: 3 }],
      });
    }
    if (ruta === '/informes/personal') {
      return Promise.resolve({ personas: [PERSONA], vencidasSinResponsable: 0 });
    }
    if (ruta === '/informes/mios') {
      return Promise.resolve({
        resultado: PERSONA,
        serie: [{ tramo: '2026-10-05', tareasHechas: 9, tareasVencidas: 1, otCerradas: 4 }],
      });
    }
    return Promise.resolve({});
  });
});

function mostrar(pagina: JSX.Element) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{pagina}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const llamadasA = (ruta: string) =>
  apiRequestMock.mock.calls.filter(([r]) => r === ruta) as [
    string,
    { query: Record<string, string> },
  ][];

describe('InformesPage', () => {
  it('arranca con los trabajos del mes, día por día', async () => {
    mostrar(<InformesPage />);

    expect(await screen.findByText('Compresor 1')).toBeInTheDocument();
    expect(screen.getByText('Órdenes abiertas')).toBeInTheDocument();
    const [, { query }] = llamadasA('/informes/trabajos')[0];
    expect(query.agrupar).toBe('dia');
    expect(query.desde.endsWith('-01')).toBe(true);
  });

  it('cambiar el período vuelve a pedir el informe con las fechas nuevas', async () => {
    mostrar(<InformesPage />);
    await screen.findByText('Compresor 1');

    await userEvent.click(screen.getByRole('button', { name: 'Este año' }));

    await waitFor(() => {
      const ultima = llamadasA('/informes/trabajos').at(-1)!;
      expect(ultima[1].query).toMatchObject({ agrupar: 'mes' });
      expect(ultima[1].query.desde.endsWith('-01-01')).toBe(true);
    });
  });

  it('compras muestra la plata y avisa las órdenes sin precio', async () => {
    mostrar(<InformesPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Compras' }));

    expect((await screen.findAllByText('Rulemanes SA')).length).toBeGreaterThan(0);
    expect(screen.getByText('1 orden sin precio, no sumada')).toBeInTheDocument();
    // Lo gastado en cada material, con lo que quedó sin precio.
    expect(screen.getByRole('link', { name: 'Rulemán 6204' })).toBeInTheDocument();
    expect(screen.getByText(/1 sin precio/)).toBeInTheDocument();
  });

  it('sin permiso, no hay pestaña de personal ni se pide', async () => {
    mostrar(<InformesPage />);
    await screen.findByText('Compresor 1');

    expect(screen.queryByRole('tab', { name: 'Personal' })).not.toBeInTheDocument();
    expect(llamadasA('/informes/personal')).toHaveLength(0);
  });

  it('con permiso, compara a las personas', async () => {
    permisos = ['informes.ver', 'informes.personal'];
    mostrar(<InformesPage />);

    await userEvent.click(await screen.findByRole('tab', { name: 'Personal' }));

    expect(await screen.findByText('Resultados por persona')).toBeInTheDocument();
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0);
    expect(screen.getAllByText('90 %').length).toBeGreaterThan(0);
  });
});

describe('MisResultadosPage', () => {
  it('muestra lo propio, sin pedir lo de los demás', async () => {
    mostrar(<MisResultadosPage />);

    expect(await screen.findByText('Cumplimiento')).toBeInTheDocument();
    expect(screen.getByText('90 %')).toBeInTheDocument();
    expect(llamadasA('/informes/personal')).toHaveLength(0);
  });
});
