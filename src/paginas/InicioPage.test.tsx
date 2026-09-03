import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InicioPage } from './InicioPage';

/**
 * La pantalla de entrada.
 *
 * Antes era el listado de 920 materiales, que no contesta ninguna pregunta:
 * hay que saber de antemano qué buscar. Estos tests fijan que muestre lo
 * pendiente y, sobre todo, que no diga "todo en orden" cuando en realidad no
 * puede saberlo.
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

const material = (over = {}) => ({
  id: 'm1',
  nombre: 'Rodamiento 6204',
  categoriaId: 'c1',
  categoriaNombre: 'Rodamientos',
  unidadId: 'u1',
  unidadNombre: 'Unidad',
  unidad: 'u',
  stockActual: 1,
  stockMinimo: 5,
  bajoStock: true,
  activo: true,
  notas: null,
  creadoEn: '2026-01-01',
  actualizadoEn: '2026-01-01',
  ...over,
});

const plan = (over = {}) => ({
  id: 'p1',
  equipoId: 'e1',
  equipoNombre: 'Compresor 1',
  ubicacionNombre: 'Caldera',
  nombre: 'Cambio de aceite',
  proximaFecha: '2026-09-10',
  diasParaVencer: 3,
  estado: 'POR_VENCER',
  ...over,
});

/** Respuestas del servidor. Lo que no se declare vuelve vacío. */
function servidor(opciones: {
  rol?: 'ADMIN' | 'OPERARIO';
  bajoStock?: unknown[];
  planes?: unknown[];
  ordenes?: unknown[];
  cobertura?: { enUso: number; conMinimo: number; sinMinimo: number; bajoStock: number };
}) {
  apiRequestMock.mockImplementation((rutaCruda: string) => {
    // Alguna llamada llega sin ruta y el mock explotaba con un error que no
    // decia nada. Se normaliza y cae en el `return null` del final.
    const ruta = String(rutaCruda ?? '');
    if (ruta.startsWith('/usuarios/me')) {
      return Promise.resolve({ id: 'u1', nombre: 'Máximo', rol: opciones.rol ?? 'ADMIN' });
    }
    if (ruta.startsWith('/materiales/bajo-stock')) {
      return Promise.resolve(opciones.bajoStock ?? []);
    }
    if (ruta.startsWith('/materiales/cobertura-alertas')) {
      return Promise.resolve(
        opciones.cobertura ?? { enUso: 10, conMinimo: 10, sinMinimo: 0, bajoStock: 0 },
      );
    }
    if (ruta.startsWith('/equipos/planes/vencen')) return Promise.resolve(opciones.planes ?? []);
    if (ruta.startsWith('/ordenes-compra')) {
      return Promise.resolve({
        datos: opciones.ordenes ?? [],
        total: (opciones.ordenes ?? []).length,
        pagina: 1,
        limite: 6,
      });
    }
    return Promise.resolve(null);
  });
}

function mostrar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const envuelto: ReactNode = (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <InicioPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(envuelto);
}

beforeEach(() => apiRequestMock.mockReset());

describe('InicioPage', () => {
  it('lista lo que hay que reponer', async () => {
    servidor({ bajoStock: [material()] });
    mostrar();

    expect(await screen.findByText('Rodamiento 6204')).toBeInTheDocument();
    expect(screen.getByText(/quedan 1 u de 5/)).toBeInTheDocument();
  });

  it('muestra los services que vencen', async () => {
    servidor({ planes: [plan()] });
    mostrar();

    expect(await screen.findByText('Compresor 1')).toBeInTheDocument();
  });

  it('cuenta aparte los services ya vencidos', async () => {
    // Es lo que hay que atender hoy, no la semana que viene.
    servidor({ planes: [plan({ estado: 'VENCIDO', diasParaVencer: -4 })] });
    mostrar();

    expect(await screen.findByText('1 vencidos')).toBeInTheDocument();
  });

  it('REGRESION: a un operario no le muestra mantenimiento', async () => {
    // El modulo de Equipos es solo para admins: pedirlo le daria 403 y le
    // llenaria la consola de errores sin que nada este mal.
    servidor({ rol: 'OPERARIO', planes: [plan()] });
    mostrar();

    await screen.findByText(/No hay nada pendiente/);
    expect(screen.queryByText('Compresor 1')).not.toBeInTheDocument();
    expect(apiRequestMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/equipos/planes/vencen'),
      expect.anything(),
    );
  });

  it('lista la mercaderia por llegar', async () => {
    servidor({
      ordenes: [{ id: 'o1', numero: 'OC-0007', proveedorNombre: 'Fraluga' }],
    });
    mostrar();

    expect(await screen.findByText('OC-0007')).toBeInTheDocument();
    expect(screen.getByText('Fraluga')).toBeInTheDocument();
  });

  it('una orden sin proveedor no deja el renglon a medias', async () => {
    servidor({ ordenes: [{ id: 'o1', numero: 'OC-0007', proveedorNombre: null }] });
    mostrar();

    expect(await screen.findByText('sin proveedor')).toBeInTheDocument();
  });

  it('sin nada pendiente lo dice', async () => {
    servidor({});
    mostrar();

    expect(await screen.findByText(/No hay nada pendiente/)).toBeInTheDocument();
  });

  it('REGRESION: avisa cuando la alerta de bajo stock esta ciega', async () => {
    // Sin minimo cargado un material puede quedar en cero sin que nadie se
    // entere, y la pantalla diria "no hay nada pendiente". Callarlo seria peor
    // que no tener la pantalla.
    servidor({ cobertura: { enUso: 920, conMinimo: 135, sinMinimo: 785, bajoStock: 0 } });
    mostrar();

    expect(await screen.findByText(/785 de 920 materiales/)).toBeInTheDocument();
  });

  it('con todos los minimos cargados no molesta con el aviso', async () => {
    servidor({ cobertura: { enUso: 920, conMinimo: 920, sinMinimo: 0, bajoStock: 0 } });
    mostrar();

    await screen.findByText(/No hay nada pendiente/);
    expect(screen.queryByText(/no tienen stock/)).not.toBeInTheDocument();
  });
});
