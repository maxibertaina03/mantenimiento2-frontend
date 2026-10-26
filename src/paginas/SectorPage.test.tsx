import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrdenTrabajo } from '@/tipos/ordenTrabajo';
import { SectorPage } from './SectorPage';
import { SectoresPage } from './SectoresPage';

/**
 * Los sectores: la lista con su actividad, y cada sector con sus trabajos y
 * los de sus máquinas por separado. Desde el sector se registra un trabajo
 * sobre el sector.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const orden = (id: string, titulo: string, extra: Partial<OrdenTrabajo> = {}) =>
  ({
    id,
    numero: `OT-2026-${id}`,
    titulo,
    descripcion: null,
    tipo: 'CORRECTIVO',
    estado: 'CERRADA',
    equipoId: null,
    equipoNombre: null,
    equipoCodigo: null,
    equipoItId: null,
    equipoItNombre: null,
    equipoItCodigo: null,
    ubicacionId: null,
    ubicacionNombre: null,
    fecha: '2026-10-20T12:00:00.000Z',
    ejecutor: 'INTERNO',
    proveedorId: null,
    proveedorNombre: null,
    costoManoObra: null,
    horasParada: null,
    asignadoANombre: 'facundo',
    materiales: [],
    ...extra,
  }) as unknown as OrdenTrabajo;

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation(
    (ruta: string, config?: { method?: string; query?: Record<string, string> }) => {
      if (ruta.startsWith('/permisos/mios')) {
        return Promise.resolve({ rol: 'ADMIN', permisos: ['trabajos.ver', 'trabajos.editar'] });
      }
      if (ruta === '/sectores') {
        return Promise.resolve([
          {
            id: 's1',
            nombre: 'Saladero',
            maquinas: 2,
            trabajosDelSector: 1,
            trabajosDeSusMaquinas: 3,
            ultimoTrabajo: { fecha: '2026-10-20T12:00:00.000Z', titulo: 'Instalación eléctrica' },
            horasParadaDelSector: 3,
            horasParadaDeSusMaquinas: 1.5,
          },
          {
            id: 's2',
            nombre: 'Caldera',
            maquinas: 0,
            trabajosDelSector: 0,
            trabajosDeSusMaquinas: 0,
            ultimoTrabajo: null,
            horasParadaDelSector: 0,
            horasParadaDeSusMaquinas: 0,
          },
        ]);
      }
      if (ruta === '/sectores/s1') {
        return Promise.resolve({
          id: 's1',
          nombre: 'Saladero',
          maquinas: [{ id: 'e1', nombre: 'Tina 1', codigo: null, estado: 'OPERATIVO' }],
          delSector: { trabajos: 1, horasParada: 3, costoManoObra: 0 },
          deSusMaquinas: { trabajos: 1, horasParada: 1.5, costoManoObra: 0 },
        });
      }
      if (ruta === '/ordenes-trabajo' && config?.method === 'POST') {
        return Promise.resolve(orden('9', 'nuevo'));
      }
      if (ruta === '/ordenes-trabajo') {
        const deMaquinas = config?.query?.deSusMaquinas === 'true';
        return Promise.resolve({
          datos: deMaquinas
            ? [orden('2', 'Cambio de válvula', { equipoId: 'e1', equipoNombre: 'Tina 1' })]
            : [orden('1', 'Instalación eléctrica', { ubicacionId: 's1', ubicacionNombre: 'Saladero' })],
          total: 1,
          pagina: 1,
          limite: 50,
        });
      }
      return Promise.resolve(null);
    },
  );
});

function mostrar(ruta: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/sectores" element={<SectoresPage />} />
          <Route path="/sectores/:id" element={<SectorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Sectores', () => {
  it('lista los sectores con su actividad, y se buscan por nombre', async () => {
    const usuario = userEvent.setup();
    mostrar('/sectores');
    const saladero = await screen.findByRole('link', { name: /Saladero/ });
    expect(saladero).toHaveAttribute('href', '/sectores/s1');
    expect(saladero).toHaveTextContent('1 del sector');
    expect(saladero).toHaveTextContent('3 en sus máquinas');
    expect(screen.getByText('Sin trabajos registrados')).toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Buscar un sector'), 'cald');
    expect(screen.queryByRole('link', { name: /Saladero/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Caldera/ })).toBeInTheDocument();
  });

  it('el sector separa sus trabajos de los de sus máquinas', async () => {
    const usuario = userEvent.setup();
    mostrar('/sectores/s1');
    expect(await screen.findByText('Instalación eléctrica')).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith('/ordenes-trabajo', {
      query: expect.objectContaining({ ubicacionId: 's1', deSusMaquinas: undefined }),
    });

    await usuario.click(screen.getByRole('tab', { name: /Trabajos en sus máquinas/ }));
    expect(await screen.findByText('Cambio de válvula')).toBeInTheDocument();
    expect(screen.getByText('Tina 1')).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith('/ordenes-trabajo', {
      query: expect.objectContaining({ ubicacionId: 's1', deSusMaquinas: 'true' }),
    });
  });

  it('«Registrar trabajo» desde el sector lo carga sobre el sector', async () => {
    const usuario = userEvent.setup();
    mostrar('/sectores/s1');
    await usuario.click(await screen.findByRole('button', { name: /Registrar trabajo/ }));
    const ventana = await screen.findByRole('dialog');
    expect(within(ventana).getByText('Registrar trabajo en Saladero')).toBeInTheDocument();

    await usuario.type(within(ventana).getByLabelText(/¿Qué pasó\?/), 'Instalación eléctrica');
    await usuario.type(within(ventana).getByLabelText(/¿Qué se hizo\?/), 'Línea nueva');
    await usuario.click(within(ventana).getByRole('button', { name: 'Registrar trabajo' }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith('/ordenes-trabajo', {
        method: 'POST',
        body: expect.objectContaining({
          titulo: 'Instalación eléctrica',
          ubicacionId: 's1',
          equipoId: undefined,
          resolucion: 'Línea nueva',
        }),
      }),
    );
  });
});
