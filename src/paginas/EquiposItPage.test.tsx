import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EquiposItPage } from './EquiposItPage';

/**
 * La pantalla de informatica abierta desde un QR.
 *
 * La etiqueta pegada en la PC lleva a /equipos-it?equipo=<id>. Si la pantalla
 * ignorara el parametro, el que escanea parado frente al equipo cae en el
 * listado de 65 y tiene que buscarlo a mano, que es lo que el QR venia a
 * evitar. Y varios son el mismo modelo, asi que buscarlo a mano no es trivial.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const pc = {
  id: 'pc-1',
  codigoInterno: 'PC12',
  qrGeneradoEn: null,
  tipoId: 't-1',
  tipoNombre: 'PC',
  llevaEspecificaciones: true,
  estado: 'EN_USO',
  marcaId: null,
  marcaNombre: 'Dell',
  modeloId: null,
  modeloNombre: 'Optiplex',
  numeroSerie: null,
  procesador: null,
  memoriaRamGb: null,
  discoTipo: null,
  discoCapacidadGb: null,
  sistemaOperativo: null,
  direccionIp: null,
  direccionMac: null,
  nombreEnRed: null,
  accesoRemoto: 'NINGUNO',
  accesoRemotoId: null,
  ubicacionId: null,
  ubicacionNombre: 'Oficina',
  proveedorId: null,
  proveedorNombre: null,
  fechaCompra: null,
  garantiaHasta: null,
  notas: null,
  responsableId: null,
  responsableNombre: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  actualizadoEn: '2026-01-01T00:00:00.000Z',
};

const TRABAJO = {
  id: 'ot-1',
  numero: 'OT-2026-0003',
  titulo: 'La PC no arrancaba',
  descripcion: null,
  tipo: 'CORRECTIVO',
  estado: 'CERRADA',
  equipoId: null,
  equipoNombre: null,
  equipoCodigo: null,
  equipoItId: 'pc-1',
  equipoItNombre: 'Dell Optiplex',
  equipoItCodigo: 'PC12',
  fecha: '2026-09-20T00:00:00.000Z',
  ejecutor: 'INTERNO',
  proveedorId: null,
  proveedorNombre: null,
  costoManoObra: null,
  horasParada: null,
  planId: null,
  planNombre: null,
  abiertaEn: '2026-09-20T00:00:00.000Z',
  abiertaPorId: null,
  abiertaPorNombre: null,
  asignadoAId: null,
  asignadoANombre: null,
  resolucion: 'Se cambio la fuente',
  cerradaEn: '2026-09-20T00:00:00.000Z',
  cerradaPorId: null,
  cerradaPorNombre: null,
  motivoAnulacion: null,
  creadoEn: '2026-09-20T00:00:00.000Z',
  materiales: [],
};

let permisos: string[] = [];
let trabajos: unknown[] = [];

function servidor({ existe = true }: { existe?: boolean } = {}) {
  apiRequestMock.mockImplementation((rutaCruda: string) => {
    const ruta = String(rutaCruda ?? '');
    if (ruta.startsWith('/permisos/mios')) return Promise.resolve({ rol: 'ADMIN', permisos });
    if (ruta === '/equipos-it/resumen') {
      return Promise.resolve({
        total: 1,
        porTipo: [{ tipoId: 't-1', nombre: 'PC', cantidad: 1 }],
        porEstado: [{ estado: 'EN_USO', cantidad: 1 }],
      });
    }
    if (ruta === '/equipos-it/pc-1') {
      return existe ? Promise.resolve(pc) : Promise.reject(new Error('404'));
    }
    if (ruta.startsWith('/ordenes-trabajo')) {
      return Promise.resolve({ datos: trabajos, total: trabajos.length, pagina: 1, limite: 20 });
    }
    if (ruta.startsWith('/equipos-it')) {
      return Promise.resolve({ datos: [pc], total: 1, pagina: 1, limite: 20 });
    }
    if (ruta.startsWith('/credenciales')) {
      return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
    }
    return Promise.resolve([]);
  });
}

function mostrar(ruta: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const nodo: ReactNode = (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <EquiposItPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(nodo);
}

beforeEach(() => {
  apiRequestMock.mockReset();
  permisos = ['it.ver', 'it.editar', 'trabajos.ver', 'trabajos.editar'];
  trabajos = [];
});

describe('EquiposItPage abierta desde un QR', () => {
  it('REGRESION: con ?equipo=<id> abre la ficha de ese equipo', async () => {
    servidor();
    mostrar('/equipos-it?equipo=pc-1');

    expect(await screen.findByRole('heading', { name: 'Dell Optiplex' })).toBeInTheDocument();
  });

  it('sin el parametro no abre ninguna ficha', async () => {
    servidor();
    mostrar('/equipos-it');

    // En la lista la marca y el modelo van en elementos distintos, asi que se
    // espera el codigo interno, que si es un texto solo.
    await screen.findByText('PC12');
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Dell Optiplex' })).not.toBeInTheDocument(),
    );
  });
});

describe('EquiposItPage — mantenimiento del equipo', () => {
  it('la ficha muestra los trabajos que se le hicieron', async () => {
    trabajos = [TRABAJO];
    servidor();
    mostrar('/equipos-it?equipo=pc-1');

    expect(await screen.findByText('OT-2026-0003')).toBeInTheDocument();
    expect(screen.getByText(/Se cambio la fuente/)).toBeInTheDocument();
  });

  it('sin trabajos lo dice, en vez de dejar el hueco vacio', async () => {
    servidor();
    mostrar('/equipos-it?equipo=pc-1');

    expect(await screen.findByText(/no se registró ningún trabajo/i)).toBeInTheDocument();
  });

  it('REGRESION: sin permiso de ver trabajos no se pide el historial', async () => {
    // Sin la guarda, la seccion salia a pedir ordenes igual y se comia un 403
    // que el usuario ve como un error rojo en la ficha de su PC.
    permisos = ['it.ver'];
    servidor();
    mostrar('/equipos-it?equipo=pc-1');

    await screen.findByRole('heading', { name: 'Dell Optiplex' });
    await waitFor(() =>
      expect(screen.queryByText(/Historial de trabajos/i)).not.toBeInTheDocument(),
    );
    expect(apiRequestMock.mock.calls.some((c) => String(c[0]).startsWith('/ordenes-trabajo'))).toBe(
      false,
    );
  });

  it('se puede registrar un trabajo desde la ficha', async () => {
    servidor();
    mostrar('/equipos-it?equipo=pc-1');

    expect(await screen.findByRole('button', { name: /registrar trabajo/i })).toBeInTheDocument();
  });
});
