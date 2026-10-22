import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tarea } from '@/tipos/tarea';
import { MisTareasDeHoy } from './MisTareasDeHoy';

/**
 * Hoy: lo importante a la vista y las rutinas de todos los días juntas en un
 * renglón, para que no tapen un service o una tarea programada.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00.000Z`;
};

const tarea = (id: string, extra: Partial<Tarea>): Tarea => ({
  id,
  titulo: 'Tarea',
  descripcion: null,
  fecha: hoyIso(),
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
  creadoEn: hoyIso(),
  ...extra,
});

let tareas: Tarea[] = [];

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((ruta: string) => {
    if (ruta.startsWith('/permisos/mios')) {
      return Promise.resolve({ rol: 'MANTENIMIENTO', permisos: ['tareas.ver', 'tareas.editar'] });
    }
    if (ruta === '/calendario/mias') return Promise.resolve(tareas);
    return Promise.resolve(null);
  });
});

function mostrar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MisTareasDeHoy />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MisTareasDeHoy', () => {
  it('el service muestra primero el equipo, y las rutinas van juntas y plegadas', async () => {
    tareas = [
      tarea('s1', { titulo: 'Purga', equipoId: 'e1', equipoNombre: 'Compresor 1', planId: 'p1' }),
      tarea('r1', { titulo: 'Recorrida de tableros', planId: 'p-diario', cadaDias: 1 }),
      tarea('r2', { titulo: 'Limpiar filtros', rutinaId: 'rut2', cadaDias: 1 }),
    ];
    mostrar();

    expect(await screen.findByText('Compresor 1')).toBeInTheDocument();
    expect(screen.getByText('Purga')).toBeInTheDocument();
    // Las rutinas no se listan una por una: un solo renglón con cuántas son.
    expect(screen.getByText('Tareas de todos los días')).toBeInTheDocument();
    expect(screen.getByText(/2 pendientes/)).toBeInTheDocument();
    expect(screen.queryByText('Recorrida de tableros')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Tareas de todos los días/ }));
    expect(screen.getByText('Recorrida de tableros')).toBeInTheDocument();
    expect(screen.getByText('Limpiar filtros')).toBeInTheDocument();
  });

  it('sin rutinas no aparece el renglón de rutinas', async () => {
    tareas = [tarea('m1', { titulo: 'Cambiar lámpara del pasillo' })];
    mostrar();
    expect(await screen.findByText('Cambiar lámpara del pasillo')).toBeInTheDocument();
    expect(screen.queryByText('Tareas de todos los días')).not.toBeInTheDocument();
  });
});
