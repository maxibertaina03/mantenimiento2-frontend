import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TableroTareas } from './TableroTareas';
import type { Tarea } from '@/tipos/tarea';

/**
 * El tablero: qué se puede mover y adónde va cada movimiento. Arrastrar con el
 * mouse usa lo mismo que «Mover a…», que es lo que se prueba acá.
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

const tarea = (id: string, titulo: string, cambios: Partial<Tarea> = {}): Tarea => ({
  id,
  titulo,
  descripcion: null,
  fecha: new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z',
  fechaOriginal: null,
  estado: 'PENDIENTE',
  asignadoAId: 'u1',
  asignadoANombre: 'Facundo',
  equipoId: null,
  equipoNombre: null,
  equipoItId: null,
  equipoItNombre: null,
  planId: null,
  planNombre: null,
  rutinaId: null,
  rutinaTitulo: null,
  ordenTrabajoId: null,
  ordenTrabajoNumero: null,
  creadaPorId: 'u1',
  creadoEn: '2026-09-22T10:00:00.000Z',
  ...cambios,
});

let permisos: string[] = [];

beforeEach(() => {
  apiRequestMock.mockReset();
  permisos = ['tareas.ver', 'tareas.editar'];
  apiRequestMock.mockImplementation((ruta: string, opciones?: { method?: string }) => {
    if (ruta.startsWith('/usuarios/me')) {
      return Promise.resolve({ id: 'u1', nombre: 'Facundo', rol: 'MANTENIMIENTO' });
    }
    if (ruta.startsWith('/permisos/mios')) {
      return Promise.resolve({ rol: 'MANTENIMIENTO', permisos });
    }
    if (ruta === '/calendario/tablero') {
      return Promise.resolve({
        pendientes: [
          tarea('t1', 'Cambiar correa'),
          tarea('t2', 'Engrasar rodillos', { asignadoAId: 'u2', asignadoANombre: 'Leandro' }),
        ],
        enProceso: [
          tarea('t3', 'Revisar bomba', {
            estado: 'EN_PROCESO',
            enProcesoDesde: new Date().toISOString(),
          }),
        ],
        hechas: [],
        ordenesAbiertas: [
          {
            id: 'o1',
            numero: 'OT-2026-0160',
            titulo: 'Cambiar o-ring',
            sobre: 'Tina 2',
            asignadoAId: 'u1',
            asignadoANombre: 'Facundo',
            abiertaEn: new Date().toISOString(),
            cerradaEn: null,
            tallerNombre: null,
            solicitudNumero: 'SOL-2026-0001',
            urgencia: 'URGENTE',
          },
        ],
        ordenesCerradas: [],
        solicitudesNuevas: [
          {
            id: 's1',
            numero: 'SOL-2026-0002',
            descripcion: 'No arranca la cinta 3',
            sectorNombre: 'Envasado',
            equipoNombre: 'Cinta 3',
            urgencia: 'URGENTE',
            solicitadaPorNombre: 'Envasado',
            creadoEn: new Date().toISOString(),
          },
        ],
      });
    }
    if (ruta === '/solicitudes/s1') {
      return Promise.resolve({
        id: 's1',
        numero: 'SOL-2026-0002',
        descripcion: 'No arranca la cinta 3',
        sectorId: 'sec',
        sectorNombre: 'Envasado',
        equipoId: 'eq',
        equipoNombre: 'Cinta 3',
        urgencia: 'URGENTE',
        estado: 'NUEVA',
        solicitadaPorId: 'u9',
        solicitadaPorNombre: 'Envasado',
        creadoEn: new Date().toISOString(),
        revisadaPorId: null,
        revisadaPorNombre: null,
        revisadaEn: null,
        motivoRechazo: null,
        notaResolucion: null,
        resueltaEn: null,
        ordenTrabajoId: null,
        ordenTrabajoNumero: null,
        ordenTrabajoAsignadoANombre: null,
        fotos: [],
      });
    }
    if (ruta.startsWith('/ordenes-trabajo/asignables')) {
      return Promise.resolve([{ id: 'u1', nombre: 'Facundo', puedeTrabajar: true }]);
    }
    if (opciones?.method === 'POST') return Promise.resolve(tarea('x', 'x'));
    return Promise.resolve([]);
  });
});

function abrir() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TableroTareas colores={new Map()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const llamadas = () =>
  apiRequestMock.mock.calls
    .filter(([, o]) => (o as { method?: string } | undefined)?.method === 'POST')
    .map(([ruta]) => ruta);

describe('TableroTareas', () => {
  it('reparte las tarjetas en las tres columnas', async () => {
    abrir();
    const pendiente = await screen.findByLabelText('Pendiente');
    expect(within(pendiente).getByText('Cambiar correa')).toBeInTheDocument();
    expect(within(screen.getByLabelText('En proceso')).getByText('Revisar bomba')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Listo')).getByText(/no se terminó nada/)).toBeInTheDocument();
  });

  it('«Mover a» En proceso la toma, y a Pendiente la suelta', async () => {
    abrir();
    await userEvent.selectOptions(
      await screen.findByLabelText('Mover «Cambiar correa» a'),
      'enProceso',
    );
    await userEvent.selectOptions(screen.getByLabelText('Mover «Revisar bomba» a'), 'pendientes');
    await waitFor(() =>
      expect(llamadas()).toEqual(['/calendario/t1/tomar', '/calendario/t3/soltar']),
    );
  });

  it('a Listo abre el cierre de siempre, sin llamar a nada todavía', async () => {
    abrir();
    await userEvent.selectOptions(
      await screen.findByLabelText('Mover «Cambiar correa» a'),
      'hechas',
    );
    expect(await screen.findByText('Hecha, sin novedad')).toBeInTheDocument();
    expect(llamadas()).toEqual([]);
  });

  it('la de otro no se mueve; el encargado sí puede', async () => {
    const { unmount } = abrir();
    await screen.findByText('Engrasar rodillos');
    expect(screen.queryByLabelText('Mover «Engrasar rodillos» a')).not.toBeInTheDocument();
    unmount();

    permisos = ['tareas.ver', 'tareas.editar', 'tareas.asignar'];
    abrir();
    expect(await screen.findByLabelText('Mover «Engrasar rodillos» a')).toBeInTheDocument();
  });

  it('la orden abierta va en proceso y la solicitud nueva en pendiente', async () => {
    permisos = ['tareas.ver', 'tareas.editar', 'trabajos.editar', 'solicitudes.gestionar'];
    abrir();
    expect(
      within(await screen.findByLabelText('En proceso')).getByText('Orden OT-2026-0160'),
    ).toBeInTheDocument();
    expect(within(screen.getByLabelText('Pendiente')).getByText('Solicitud SOL-2026-0002')).toBeInTheDocument();
    // Una orden abierta solo va a Listo.
    const moverOrden = screen.getByLabelText('Mover «Tina 2» a');
    expect([...moverOrden.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Mover a…',
      'Listo',
    ]);
  });

  it('llevar la solicitud a En proceso abre «generar la orden», sin llamar a nada', async () => {
    permisos = ['tareas.ver', 'tareas.editar', 'trabajos.editar', 'solicitudes.gestionar'];
    abrir();
    await userEvent.selectOptions(await screen.findByLabelText('Mover «Cinta 3» a'), 'enProceso');
    expect(await screen.findByLabelText('Quién la hace')).toBeInTheDocument();
    expect(llamadas()).toEqual([]);
  });

  it('sin permiso sobre solicitudes, la tarjeta se ve pero no se mueve', async () => {
    abrir();
    await screen.findByText('Solicitud SOL-2026-0002');
    expect(screen.queryByLabelText('Mover «Cinta 3» a')).not.toBeInTheDocument();
  });
});
