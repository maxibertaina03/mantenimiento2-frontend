import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdenesTrabajoPage } from './OrdenesTrabajoPage';

/**
 * Órdenes de trabajo.
 *
 * Lo que más importa proteger acá es quién puede atar una orden a un equipo:
 * mantenimiento todavía no ve el módulo de equipos, así que carga la orden sin
 * máquina y un administrador la relaciona después.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => {
  class ApiError extends Error {
    constructor(
      public readonly statusCode: number,
      mensaje: string,
    ) {
      super(mensaje);
    }
  }
  class ErrorServidorNoDisponible extends Error {}
  return {
    apiRequest: (...args: unknown[]) => apiRequestMock(...args),
    ApiError,
    ErrorServidorNoDisponible,
  };
});

const ORDEN = {
  id: '11111111-1111-4111-8111-111111111111',
  numero: 'OT-2026-0001',
  titulo: 'Perdida en la bomba de recibo',
  descripcion: 'Pierde por el sello desde el lunes',
  tipo: 'CORRECTIVO',
  estado: 'ABIERTA',
  equipoId: null,
  equipoNombre: null,
  equipoCodigo: null,
  abiertaEn: '2026-09-21T10:00:00.000Z',
  abiertaPorId: 'u1',
  abiertaPorNombre: 'Facundo',
  asignadoAId: 'u1',
  asignadoANombre: 'Facundo',
  resolucion: null,
  cerradaEn: null,
  cerradaPorId: null,
  cerradaPorNombre: null,
  motivoAnulacion: null,
  creadoEn: '2026-09-21T10:00:00.000Z',
  materiales: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      ordenTrabajoId: '11111111-1111-4111-8111-111111111111',
      materialId: 'm1',
      cantidad: 2,
      movimientoId: 'mov-1',
      materialNombre: 'Reten 40x72x10',
      unidad: 'u',
      registradoPorId: 'u1',
      creadoEn: '2026-09-21T11:00:00.000Z',
    },
  ],
};

/** Los permisos que devuelve el backend en cada test. */
let permisos: string[] = [];

beforeEach(() => {
  apiRequestMock.mockReset();
  permisos = ['trabajos.ver', 'trabajos.editar', 'materiales.ver'];

  apiRequestMock.mockImplementation((rutaCruda: string) => {
    const ruta = String(rutaCruda ?? '');
    if (ruta.startsWith('/usuarios/me')) {
      return Promise.resolve({ id: 'u1', nombre: 'Facundo', rol: 'MANTENIMIENTO' });
    }
    if (ruta.startsWith('/permisos/mios')) {
      return Promise.resolve({ rol: 'MANTENIMIENTO', permisos });
    }
    if (ruta.startsWith('/ordenes-trabajo/asignables')) {
      return Promise.resolve([
        { id: 'u1', nombre: 'Facundo' },
        { id: 'u2', nombre: 'Leandro' },
      ]);
    }
    if (/^\/ordenes-trabajo\/[^/]+$/.test(ruta)) {
      return Promise.resolve({
        ...ORDEN,
        resumen: { materialesDistintos: 1, unidadesTotales: 2 },
      });
    }
    if (ruta.startsWith('/ordenes-trabajo')) {
      return Promise.resolve({ datos: [ORDEN], total: 1, pagina: 1, limite: 20 });
    }
    return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
  });
});

function mostrar() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const nodo: ReactNode = (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OrdenesTrabajoPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(nodo);
}

describe('OrdenesTrabajoPage', () => {
  it('lista las ordenes con su numero y lo que se hizo', async () => {
    mostrar();

    expect(await screen.findByText('OT-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Perdida en la bomba de recibo')).toBeInTheDocument();
    // getAllByText: "Correctivo" tambien es una opcion del filtro de tipo.
    expect(screen.getAllByText('Correctivo').length).toBeGreaterThan(0);
  });

  it('el detalle muestra los materiales que salieron del paniol', async () => {
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /^ver$/i }));

    expect(await screen.findByRole('heading', { name: /Orden OT-2026-0001/ })).toBeInTheDocument();
    expect(screen.getByText('Reten 40x72x10')).toBeInTheDocument();
  });

  it('REGRESION: sin permiso de ver equipos no se ofrece atar la orden a una maquina', async () => {
    // Es el caso de mantenimiento hoy. Si el selector apareciera, elegirian
    // cualquier equipo con tal de poder guardar, y eso ensucia el historial de
    // esa maquina con trabajos que no le corresponden.
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /nueva orden/i }));
    await screen.findByRole('heading', { name: /Nueva orden de trabajo/i });

    expect(screen.queryByText(/Equipo \(opcional\)/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Qué pasó/i)).toBeInTheDocument();
  });

  it('con permiso de ver equipos, el selector aparece', async () => {
    permisos = ['trabajos.ver', 'trabajos.editar', 'materiales.ver', 'equipos.ver'];
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /nueva orden/i }));

    expect(await screen.findByText(/Equipo \(opcional\)/i)).toBeInTheDocument();
  });

  it('abrir una orden manda el titulo y el tipo', async () => {
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /nueva orden/i }));
    await usuario.click(screen.getByLabelText(/Qué pasó/i));
    await usuario.paste('Cambio de rodamiento');
    await usuario.click(screen.getByRole('button', { name: /abrir orden/i }));

    await waitFor(() => {
      const alta = apiRequestMock.mock.calls.find(
        (c) => c[0] === '/ordenes-trabajo' && c[1]?.method === 'POST',
      );
      expect(alta?.[1].body).toMatchObject({ titulo: 'Cambio de rodamiento', tipo: 'CORRECTIVO' });
    });
  });

  it('REGRESION: sin permiso de editar no se puede abrir ni cargar nada', async () => {
    // Gerencia mira y no toca. El boton de alta no tiene que estar.
    permisos = ['trabajos.ver'];
    mostrar();

    expect(await screen.findByText('OT-2026-0001')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nueva orden/i })).not.toBeInTheDocument();
  });

  it('una orden cerrada muestra que se hizo y no deja cargar materiales', async () => {
    apiRequestMock.mockImplementation((rutaCruda: string) => {
      const ruta = String(rutaCruda ?? '');
      if (ruta.startsWith('/usuarios/me')) {
        return Promise.resolve({ id: 'u1', nombre: 'Facundo', rol: 'MANTENIMIENTO' });
      }
      if (ruta.startsWith('/permisos/mios')) {
        return Promise.resolve({ rol: 'MANTENIMIENTO', permisos });
      }
      const cerrada = {
        ...ORDEN,
        estado: 'CERRADA',
        resolucion: 'Se cambio el sello mecanico',
        cerradaEn: '2026-09-21T15:00:00.000Z',
        cerradaPorNombre: 'Facundo',
      };
      if (ruta.startsWith('/ordenes-trabajo/asignables')) return Promise.resolve([]);
      if (/^\/ordenes-trabajo\/[^/]+$/.test(ruta)) {
        return Promise.resolve({
          ...cerrada,
          resumen: { materialesDistintos: 1, unidadesTotales: 2 },
        });
      }
      if (ruta.startsWith('/ordenes-trabajo')) {
        return Promise.resolve({ datos: [cerrada], total: 1, pagina: 1, limite: 20 });
      }
      return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
    });

    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(await screen.findByRole('button', { name: /^ver$/i }));

    expect(await screen.findByText('Se cambio el sello mecanico')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ usar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reabrir/i })).toBeInTheDocument();
  });
});

describe('el trabajo es de quien lo tiene asignado', () => {
  /** La misma orden, pero a cargo de otra persona. */
  const deOtro = { ...ORDEN, asignadoAId: 'u2', asignadoANombre: 'Leandro' };

  const mockearDeOtro = () => {
    apiRequestMock.mockImplementation((rutaCruda: string) => {
      const ruta = String(rutaCruda ?? '');
      if (ruta.startsWith('/usuarios/me')) {
        return Promise.resolve({ id: 'u1', nombre: 'Facundo', rol: 'MANTENIMIENTO' });
      }
      if (ruta.startsWith('/permisos/mios')) {
        return Promise.resolve({ rol: 'MANTENIMIENTO', permisos });
      }
      if (ruta.startsWith('/ordenes-trabajo/asignables')) {
        return Promise.resolve([
          { id: 'u1', nombre: 'Facundo' },
          { id: 'u2', nombre: 'Leandro' },
        ]);
      }
      if (/^\/ordenes-trabajo\/[^/]+$/.test(ruta)) {
        return Promise.resolve({ ...deOtro, resumen: { materialesDistintos: 1, unidadesTotales: 2 } });
      }
      if (ruta.startsWith('/ordenes-trabajo')) {
        return Promise.resolve({ datos: [deOtro], total: 1, pagina: 1, limite: 20 });
      }
      return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
    });
  };

  it('la lista dice de quien es cada trabajo', async () => {
    mostrar();
    expect(await screen.findByText('Facundo')).toBeInTheDocument();
    expect(screen.getByText(/\(vos\)/)).toBeInTheDocument();
  });

  it('REGRESION: un trabajo de otro se ve pero no se puede cargar ni cerrar', async () => {
    // Sin esto, "asignada a" seria una etiqueta decorativa y dos personas
    // podrian cargar repuestos sobre el mismo trabajo sin saberlo.
    mockearDeOtro();
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /^ver$/i }));
    await screen.findByRole('heading', { name: /Orden OT-2026-0001/ });

    expect(screen.getByText(/es de Leandro/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ usar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cerrar orden/i })).not.toBeInTheDocument();
    // Pero el material que ya se cargo se ve igual: saber que pasa es de todos.
    expect(screen.getByText('Reten 40x72x10')).toBeInTheDocument();
  });

  it('el trabajo propio si se puede cargar y cerrar', async () => {
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /^ver$/i }));

    expect(await screen.findByRole('button', { name: /\+ usar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar orden/i })).toBeInTheDocument();
  });

  it('al abrir una orden se puede elegir a quien se le asigna', async () => {
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /nueva orden/i }));
    await usuario.click(screen.getByLabelText(/Qué pasó/i));
    await usuario.paste('Cambio de rodamiento');
    await usuario.selectOptions(screen.getByLabelText(/Asignar a/i), 'u2');
    await usuario.click(screen.getByRole('button', { name: /abrir orden/i }));

    await waitFor(() => {
      const alta = apiRequestMock.mock.calls.find(
        (c) => c[0] === '/ordenes-trabajo' && c[1]?.method === 'POST',
      );
      expect(alta?.[1].body).toMatchObject({ asignadoAId: 'u2' });
    });
  });

  it('sin elegir a nadie, no se manda asignado: queda para uno mismo', async () => {
    // El backend lo resuelve asi. Mandar el propio id desde la pantalla seria
    // repetir en dos lados una regla que ya vive en uno.
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /nueva orden/i }));
    await usuario.click(screen.getByLabelText(/Qué pasó/i));
    await usuario.paste('Reviso la bomba');
    await usuario.click(screen.getByRole('button', { name: /abrir orden/i }));

    await waitFor(() => {
      const alta = apiRequestMock.mock.calls.find(
        (c) => c[0] === '/ordenes-trabajo' && c[1]?.method === 'POST',
      );
      expect(alta?.[1].body.asignadoAId).toBeUndefined();
    });
  });

  it('REGRESION: sin el permiso de asignar no se ofrece reasignar', async () => {
    // Es la unica accion que no exige ser el duenio, por eso pide permiso aparte.
    mockearDeOtro();
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /^ver$/i }));
    await screen.findByText(/es de Leandro/i);

    expect(screen.queryByRole('button', { name: /reasignar/i })).not.toBeInTheDocument();
  });

  it('con el permiso, el admin puede pasarle el trabajo a otro', async () => {
    permisos = ['trabajos.ver', 'trabajos.editar', 'trabajos.asignar'];
    mockearDeOtro();
    const usuario = userEvent.setup();
    mostrar();

    await usuario.click(await screen.findByRole('button', { name: /^ver$/i }));
    const selector = await screen.findByLabelText(/Pasarle el trabajo/i);
    // Leandro no aparece: ya la tiene, ofrecerselo no tendria sentido.
    expect(within(selector).queryByRole('option', { name: 'Leandro' })).not.toBeInTheDocument();

    await usuario.selectOptions(selector, 'u1');
    await usuario.click(screen.getByRole('button', { name: /reasignar/i }));

    await waitFor(() => {
      const llamada = apiRequestMock.mock.calls.find((c) => String(c[0]).includes('/reasignar'));
      expect(llamada?.[1].body).toEqual({ asignadoAId: 'u1' });
    });
  });
});

describe('eliminar una orden', () => {
  /** Una orden anulada, que es la unica que se puede borrar. */
  const anulada = { ...ORDEN, estado: 'ANULADA', motivoAnulacion: 'Era de prueba' };

  const mockearAnulada = () => {
    apiRequestMock.mockImplementation((rutaCruda: string, opciones?: { method?: string }) => {
      const ruta = String(rutaCruda ?? '');
      if (ruta.startsWith('/usuarios/me')) {
        return Promise.resolve({ id: 'u1', nombre: 'Maximo', rol: 'ADMIN' });
      }
      if (ruta.startsWith('/permisos/mios')) return Promise.resolve({ rol: 'ADMIN', permisos });
      if (opciones?.method === 'DELETE') return Promise.resolve(undefined);
      if (ruta.startsWith('/ordenes-trabajo/asignables')) return Promise.resolve([]);
      if (/^\/ordenes-trabajo\/[^/]+$/.test(ruta)) {
        return Promise.resolve({ ...anulada, resumen: { materialesDistintos: 1, unidadesTotales: 2 } });
      }
      if (ruta.startsWith('/ordenes-trabajo')) {
        return Promise.resolve({ datos: [anulada], total: 1, pagina: 1, limite: 20 });
      }
      return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
    });
  };

  it('el administrador puede borrar una orden anulada', async () => {
    permisos = ['trabajos.ver', 'trabajos.editar', 'trabajos.eliminar'];
    mockearAnulada();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(await screen.findByRole('button', { name: /^ver$/i }));
    await usuario.click(await screen.findByRole('button', { name: /^eliminar$/i }));

    await waitFor(() => {
      const borrado = apiRequestMock.mock.calls.find((c) => c[1]?.method === 'DELETE');
      expect(borrado?.[0]).toContain('/ordenes-trabajo/');
    });
  });

  it('REGRESION: sin confirmar no se borra nada', async () => {
    // Es la unica accion del modulo que no deja rastro de lo que hubo.
    permisos = ['trabajos.ver', 'trabajos.editar', 'trabajos.eliminar'];
    mockearAnulada();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(await screen.findByRole('button', { name: /^ver$/i }));
    await usuario.click(await screen.findByRole('button', { name: /^eliminar$/i }));

    expect(apiRequestMock.mock.calls.filter((c) => c[1]?.method === 'DELETE')).toHaveLength(0);
  });

  it('REGRESION: sin el permiso de eliminar, el boton no esta', async () => {
    // Mantenimiento abre, carga y cierra, pero no hace desaparecer ordenes.
    permisos = ['trabajos.ver', 'trabajos.editar'];
    mockearAnulada();

    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(await screen.findByRole('button', { name: /^ver$/i }));
    await screen.findByText(/Era de prueba/);

    expect(screen.queryByRole('button', { name: /^eliminar$/i })).not.toBeInTheDocument();
  });

  it('REGRESION: una orden abierta no ofrece eliminar', async () => {
    // Borrar son dos pasos: primero anular, que pide el motivo.
    permisos = ['trabajos.ver', 'trabajos.editar', 'trabajos.eliminar'];
    const usuario = userEvent.setup();
    mostrar();
    await usuario.click(await screen.findByRole('button', { name: /^ver$/i }));
    await screen.findByRole('heading', { name: /Orden OT-2026-0001/ });

    expect(screen.queryByRole('button', { name: /^eliminar$/i })).not.toBeInTheDocument();
  });
});

describe('TrabajosDelEquipo', () => {
  it('REGRESION: sin permiso de ver trabajos, la ficha del equipo no pide nada', async () => {
    // Pedirlo igual daria un 403 y una pantalla con un error rojo por una
    // seccion que esa persona ni tendria que ver.
    permisos = ['equipos.ver'];
    const { TrabajosDelEquipo } = await import('@/componentes/TrabajosDelEquipo');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TrabajosDelEquipo equipoId="eq-7" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        apiRequestMock.mock.calls.filter((c) => String(c[0]).startsWith('/ordenes-trabajo')),
      ).toHaveLength(0);
    });
  });

  it('muestra las ordenes del equipo con lo que se uso', async () => {
    permisos = ['equipos.ver', 'trabajos.ver'];
    const { TrabajosDelEquipo } = await import('@/componentes/TrabajosDelEquipo');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TrabajosDelEquipo equipoId="eq-7" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('OT-2026-0001')).toBeInTheDocument();
    expect(screen.getByText(/Reten 40x72x10 \(2 u\)/)).toBeInTheDocument();
  });
});
