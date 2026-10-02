import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MisTareasDeHoy } from '@/componentes/MisTareasDeHoy';
import { ServiciosPage } from './ServiciosPage';

/**
 * Un service se da por hecho desde Servicios, desde Hoy o desde el calendario,
 * y en los tres casos es la MISMA tarea del calendario la que se completa: si
 * hubiera un camino aparte, el calendario seguiría mostrando pendiente algo que
 * ya se hizo.
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

const PURGA = {
  id: 'plan-1',
  equipoId: 'eq-1',
  equipoNombre: 'Compresor 1',
  equipoEstado: 'OPERATIVO',
  ubicacionNombre: 'Caldera',
  nombre: 'Purga de agua',
  tareas: null,
  periodicidadDias: 1,
  proximaFecha: '2026-09-30T00:00:00.000Z',
  diasParaVencer: -2,
  estado: 'VENCIDO',
  activo: true,
};

const tareaDelPlan = (asignado: { id: string; nombre: string } | null) => ({
  id: 'tarea-purga',
  titulo: 'Purga de agua',
  descripcion: null,
  fecha: '2026-09-30T00:00:00.000Z',
  estado: 'PENDIENTE',
  asignadoAId: asignado?.id ?? null,
  asignadoANombre: asignado?.nombre ?? null,
  equipoId: 'eq-1',
  equipoNombre: 'Compresor 1',
  equipoItId: null,
  equipoItNombre: null,
  planId: 'plan-1',
  planNombre: 'Purga de agua',
  rutinaId: null,
  rutinaTitulo: null,
  ordenTrabajoId: null,
  ordenTrabajoNumero: null,
});

let tarea = tareaDelPlan(null);
let permisos = ['tareas.ver', 'tareas.editar', 'equipos.ver'];
const pedidos: string[] = [];

beforeEach(() => {
  tarea = tareaDelPlan(null);
  permisos = ['tareas.ver', 'tareas.editar', 'equipos.ver'];
  pedidos.length = 0;
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((rutaCruda: string) => {
    const ruta = String(rutaCruda ?? '');
    pedidos.push(ruta);
    if (ruta.startsWith('/usuarios/me')) return Promise.resolve({ id: 'u1', nombre: 'Facundo' });
    if (ruta.startsWith('/permisos/mios')) return Promise.resolve({ rol: 'MANTENIMIENTO', permisos });
    if (ruta.startsWith('/equipos/planes/vencen')) return Promise.resolve([PURGA]);
    if (ruta === '/calendario/planes/plan-1/tarea') return Promise.resolve(tarea);
    if (ruta === '/calendario/mias') return Promise.resolve([tarea]);
    return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
  });
});

function mostrar(nodo: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{nodo}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Servicios — dar un service por hecho', () => {
  it('abre la misma tarea del calendario para darla por hecha', async () => {
    const usuario = userEvent.setup();
    mostrar(<ServiciosPage />);

    await usuario.click(await screen.findByRole('button', { name: 'Dar por hecho' }));

    expect(pedidos).toContain('/calendario/planes/plan-1/tarea');
    expect(await screen.findByRole('heading', { name: 'Dar por hecha: Purga de agua' })).toBeInTheDocument();
  });

  it('REGRESION: si el service es de otro, avisa en vez de abrir algo que va a fallar', async () => {
    tarea = tareaDelPlan({ id: 'u2', nombre: 'Leandro' });
    const usuario = userEvent.setup();
    mostrar(<ServiciosPage />);

    await usuario.click(await screen.findByRole('button', { name: 'Dar por hecho' }));

    expect(await screen.findByText(/está asignado a Leandro/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Dar por hecha/ })).not.toBeInTheDocument();
  });

  it('sin permiso para hacer tareas no se ofrece', async () => {
    permisos = ['tareas.ver', 'equipos.ver'];
    mostrar(<ServiciosPage />);

    await screen.findByText('Compresor 1');
    expect(screen.queryByRole('button', { name: 'Dar por hecho' })).not.toBeInTheDocument();
  });
});

describe('Hoy — lo que hay que hacer', () => {
  it('muestra las sin responsable, dice que las puede hacer cualquiera, y se dan por hechas desde ahí', async () => {
    const usuario = userEvent.setup();
    mostrar(<MisTareasDeHoy />);

    expect(await screen.findByText(/la puede hacer cualquiera/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Darla por hecha' }));

    expect(await screen.findByRole('heading', { name: 'Dar por hecha: Purga de agua' })).toBeInTheDocument();
  });

  it('sin permiso para hacer tareas, se ven pero no se ofrece el botón', async () => {
    permisos = ['tareas.ver'];
    mostrar(<MisTareasDeHoy />);

    await screen.findByText('Purga de agua');
    expect(screen.queryByRole('button', { name: 'Darla por hecha' })).not.toBeInTheDocument();
  });
});
