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
  /** Órdenes EMITIDAS: mercadería por llegar. */
  ordenes?: unknown[];
  /** Órdenes en BORRADOR: armadas y sin mandar. */
  borradores?: unknown[];
  equipos?: { total: number; porEstado: Record<string, number>; sinPlan: number };
  cobertura?: { enUso: number; conMinimo: number; sinMinimo: number; bajoStock: number };
}) {
  apiRequestMock.mockImplementation((rutaCruda: string, config?: { query?: Record<string, unknown> }) => {
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
    if (ruta.startsWith('/equipos/resumen')) {
      return Promise.resolve(
        opciones.equipos ?? { total: 326, porEstado: { OPERATIVO: 326 }, sinPlan: 0 },
      );
    }
    if (ruta.startsWith('/ordenes-compra')) {
      // El mismo endpoint sirve las dos listas: se distinguen por el estado.
      const datos =
        config?.query?.estado === 'BORRADOR'
          ? (opciones.borradores ?? [])
          : (opciones.ordenes ?? []);
      return Promise.resolve({ datos, total: datos.length, pagina: 1, limite: 6 });
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

describe('InicioPage — equipos parados', () => {
  it('muestra los equipos que no estan trabajando', async () => {
    // Es lo unico de la pantalla que frena la produccion, por eso va primero.
    servidor({
      equipos: { total: 326, porEstado: { OPERATIVO: 320, EN_REPARACION: 4, FUERA_DE_SERVICIO: 2 }, sinPlan: 0 },
    });
    mostrar();

    expect(await screen.findByText('En reparación')).toBeInTheDocument();
    expect(screen.getByText('Fuera de servicio')).toBeInTheDocument();
    expect(screen.getByText('4 de 326 equipos')).toBeInTheDocument();
  });

  it('con todo operativo, el bloque no aparece', async () => {
    servidor({ equipos: { total: 326, porEstado: { OPERATIVO: 326 }, sinPlan: 0 } });
    mostrar();

    await screen.findByText(/No hay nada pendiente/);
    expect(screen.queryByText(/equipos parados/i)).not.toBeInTheDocument();
  });

  it('REGRESION: a un operario no se le pide el resumen de equipos', async () => {
    // El modulo es solo para admins: el pedido le daria 403.
    servidor({ rol: 'OPERARIO' });
    mostrar();

    await screen.findByText(/No hay nada pendiente/);
    expect(apiRequestMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/equipos/resumen'),
      expect.anything(),
    );
  });
});

describe('InicioPage — ordenes sin enviar', () => {
  it('lista las que quedaron armadas y sin mandar', async () => {
    // Trabajo empezado que nadie termino: el proveedor no sabe que existe.
    servidor({ borradores: [{ id: 'o9', numero: 'OC-0012', proveedorNombre: 'Fraluga' }] });
    mostrar();

    expect(await screen.findByText('OC-0012')).toBeInTheDocument();
    expect(screen.getByText(/todavía no las recibió/i)).toBeInTheDocument();
  });

  it('REGRESION: no se mezclan con las que ya salieron', async () => {
    // Las dos listas salen del mismo endpoint y solo las separa el estado.
    servidor({
      ordenes: [{ id: 'o1', numero: 'OC-0007', proveedorNombre: 'Fraluga' }],
      borradores: [{ id: 'o9', numero: 'OC-0012', proveedorNombre: 'Fraluga' }],
    });
    mostrar();

    const porLlegar = (await screen.findByText('Mercadería por llegar')).closest('.panel')!;
    const sinEnviar = screen.getByText('Órdenes sin enviar').closest('.panel')!;

    expect(porLlegar).toHaveTextContent('OC-0007');
    expect(porLlegar).not.toHaveTextContent('OC-0012');
    expect(sinEnviar).toHaveTextContent('OC-0012');
    expect(sinEnviar).not.toHaveTextContent('OC-0007');
  });
});

describe('InicioPage — de que no puede avisar el sistema', () => {
  it('avisa de los equipos sin ningun plan', async () => {
    // Sin plan, un equipo nunca genera un recordatorio, y eso no se ve en la
    // pantalla de servicios: ahi solo aparece lo que SI tiene plan.
    servidor({
      equipos: { total: 326, porEstado: { OPERATIVO: 326 }, sinPlan: 326 },
      cobertura: { enUso: 911, conMinimo: 911, sinMinimo: 0, bajoStock: 0 },
    });
    mostrar();

    expect(await screen.findByText(/326 de 326 equipos/)).toBeInTheDocument();
    expect(screen.getByText(/nunca van a generar un aviso/i)).toBeInTheDocument();
  });

  it('junta los dos huecos en un solo bloque', async () => {
    servidor({
      equipos: { total: 326, porEstado: { OPERATIVO: 326 }, sinPlan: 326 },
      cobertura: { enUso: 911, conMinimo: 112, sinMinimo: 799, bajoStock: 0 },
    });
    mostrar();

    // Las dos consultas resuelven por separado: se espera cada una.
    expect(await screen.findByText(/799 de 911 materiales/)).toBeInTheDocument();
    expect(await screen.findByText(/326 de 326 equipos/)).toBeInTheDocument();
  });

  it('sin huecos, no molesta con el bloque', async () => {
    servidor({
      equipos: { total: 326, porEstado: { OPERATIVO: 326 }, sinPlan: 0 },
      cobertura: { enUso: 911, conMinimo: 911, sinMinimo: 0, bajoStock: 0 },
    });
    mostrar();

    await screen.findByText(/No hay nada pendiente/);
    expect(screen.queryByText(/no te puede avisar/i)).not.toBeInTheDocument();
  });

  it('a un operario no se le muestra el hueco de los equipos', async () => {
    // No ve el modulo, asi que no puede hacer nada al respecto.
    servidor({
      rol: 'OPERARIO',
      cobertura: { enUso: 911, conMinimo: 112, sinMinimo: 799, bajoStock: 0 },
    });
    mostrar();

    expect(await screen.findByText(/799 de 911 materiales/)).toBeInTheDocument();
    expect(screen.queryByText(/equipos/i)).not.toBeInTheDocument();
  });
});
