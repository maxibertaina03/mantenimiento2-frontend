import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stockDeRepuesto } from '@/lib/stockDeRepuesto';
import type { Equipo, RepuestoEquipo } from '@/tipos/equipo';
import { AtajosRepuestos } from './AtajosRepuestos';
import { RepuestosEquipo } from './RepuestosEquipo';

/**
 * Los repuestos de cada equipo: la lista en la ficha y los atajos al cargar
 * lo que se usó en una reparación.
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

const EQUIPO = { id: 'eq-1', nombre: 'Bomba de recibo', estado: 'OPERATIVO' } as Equipo;

const repuesto = (extra: Partial<RepuestoEquipo>): RepuestoEquipo => ({
  id: 'rep-1',
  equipoId: 'eq-1',
  materialId: 'mat-reten',
  materialNombre: 'Retén 40x72x10',
  unidad: 'u',
  cantidad: 2,
  notas: 'lado motor',
  stockActual: 10,
  stockMinimo: 2,
  bajoStock: false,
  materialActivo: true,
  ubicacion: 'Estantería A · fila 3',
  creadoEn: '2026-10-02T10:00:00.000Z',
  ...extra,
});

let lista: RepuestoEquipo[] = [];
let permisos = ['equipos.ver', 'equipos.editar', 'materiales.ver'];
const pedidos: { ruta: string; opciones?: { method?: string; body?: unknown } }[] = [];

beforeEach(() => {
  lista = [];
  permisos = ['equipos.ver', 'equipos.editar', 'materiales.ver'];
  pedidos.length = 0;
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation(
    (rutaCruda: string, opciones?: { method?: string; body?: unknown }) => {
      const ruta = String(rutaCruda ?? '');
      pedidos.push({ ruta, opciones });
      if (ruta.startsWith('/usuarios/me')) return Promise.resolve({ id: 'u1', nombre: 'Facundo' });
      if (ruta.startsWith('/permisos/mios')) return Promise.resolve({ rol: 'MANTENIMIENTO', permisos });
      if (ruta === '/equipos/eq-1/repuestos' && opciones?.method === 'POST') {
        lista = [...lista, repuesto({ id: 'rep-2', materialId: 'mat-rod', materialNombre: 'Rodamiento 6205' })];
        return Promise.resolve(lista);
      }
      if (ruta === '/equipos/eq-1/repuestos') return Promise.resolve(lista);
      if (ruta.startsWith('/materiales')) {
        return Promise.resolve({
          datos: [
            { id: 'mat-reten', nombre: 'Retén 40x72x10', unidad: 'u', activo: true, stockActual: 10 },
            { id: 'mat-rod', nombre: 'Rodamiento 6205', unidad: 'u', activo: true, stockActual: 4 },
          ],
          total: 2,
          pagina: 1,
          limite: 20,
        });
      }
      return Promise.resolve({ datos: [], total: 0, pagina: 1, limite: 20 });
    },
  );
});

function mostrar(nodo: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{nodo}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('la etiqueta de stock de un repuesto', () => {
  const base = { stockActual: 10, bajoStock: false, materialActivo: true, cantidad: 2, unidad: 'u' };

  it('verde si hay; ámbar si queda poco o no alcanza; rojo si no hay', () => {
    expect(stockDeRepuesto(base)).toEqual({ clase: 'ok', texto: 'Hay 10 u' });
    expect(stockDeRepuesto({ ...base, stockActual: 3, bajoStock: true }).clase).toBe('bajo');
    // Lleva 2 y queda 1: aunque no esté bajo el mínimo, no alcanza para el cambio.
    expect(stockDeRepuesto({ ...base, stockActual: 1 })).toEqual({
      clase: 'bajo',
      texto: 'Hay 1 u: no alcanza',
    });
    expect(stockDeRepuesto({ ...base, stockActual: 0 })).toEqual({ clase: 'sin', texto: 'Sin stock' });
    expect(stockDeRepuesto({ ...base, materialActivo: false }).clase).toBe('fuera');
  });
});

describe('Repuestos en la ficha del equipo', () => {
  it('lista cada repuesto con lo que lleva, la nota, dónde está y el stock', async () => {
    lista = [repuesto({})];
    mostrar(<RepuestosEquipo equipo={EQUIPO} />);

    expect(await screen.findByRole('link', { name: 'Retén 40x72x10' })).toHaveAttribute(
      'href',
      '/materiales/mat-reten',
    );
    expect(screen.getByText('Lleva 2 u · lado motor')).toBeInTheDocument();
    expect(screen.getByText('📍 Estantería A · fila 3')).toBeInTheDocument();
    expect(screen.getByText('Hay 10 u')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Repuestos (1)' })).toBeInTheDocument();
  });

  it('avisa arriba cuántos no tienen stock', async () => {
    lista = [repuesto({ stockActual: 0 })];
    mostrar(<RepuestosEquipo equipo={EQUIPO} />);
    expect(await screen.findByText(/1 sin stock/)).toBeInTheDocument();
  });

  it('se agrega un material del pañol con cantidad y nota', async () => {
    const usuario = userEvent.setup();
    mostrar(<RepuestosEquipo equipo={EQUIPO} />);

    await usuario.click(await screen.findByRole('button', { name: '+ Agregar repuesto' }));
    await usuario.click(screen.getByRole('textbox', { name: /qué material/i }));
    await usuario.click(await screen.findByText('Rodamiento 6205'));
    await usuario.type(screen.getByRole('spinbutton', { name: /cuántos lleva/i }), '2');
    await usuario.type(screen.getByRole('textbox', { name: /nota/i }), 'lado bomba');
    await usuario.click(screen.getByRole('button', { name: 'Agregar «Rodamiento 6205»' }));

    const alta = pedidos.find((p) => p.opciones?.method === 'POST');
    expect(alta?.opciones?.body).toEqual({ materialId: 'mat-rod', cantidad: 2, notas: 'lado bomba' });
    expect(await screen.findByRole('link', { name: 'Rodamiento 6205' })).toBeInTheDocument();
  });

  it('REGRESION: elegir uno que ya está avisa y no deja agregarlo dos veces', async () => {
    lista = [repuesto({})];
    const usuario = userEvent.setup();
    mostrar(<RepuestosEquipo equipo={EQUIPO} />);

    await usuario.click(await screen.findByRole('button', { name: '+ Agregar repuesto' }));
    await usuario.click(screen.getByRole('textbox', { name: /qué material/i }));
    // El de la lista desplegable, no los botones ✎ / ✕ de la fila.
    const desplegable = await screen.findByText((_, el) => el?.classList.contains('combo-lista') ?? false);
    await usuario.click(within(desplegable).getByText(/Retén 40x72x10/));

    expect(screen.getByText(/Ya está en la lista/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar «Retén 40x72x10»' })).toBeDisabled();
  });

  it('sin permiso para editar equipos, la lista se ve pero no se toca', async () => {
    permisos = ['equipos.ver'];
    lista = [repuesto({})];
    mostrar(<RepuestosEquipo equipo={EQUIPO} />);

    await screen.findByRole('link', { name: 'Retén 40x72x10' });
    expect(screen.queryByRole('button', { name: '+ Agregar repuesto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sacar/ })).not.toBeInTheDocument();
  });
});

describe('Atajos de repuestos al cargar lo que se usó', () => {
  it('un toque carga el repuesto con la cantidad que lleva la máquina', async () => {
    lista = [repuesto({})];
    const onUsar = vi.fn();
    const usuario = userEvent.setup();
    mostrar(<AtajosRepuestos equipoId="eq-1" yaCargados={[]} onUsar={onUsar} />);

    await usuario.click(await screen.findByRole('button', { name: /Retén 40x72x10/ }));
    expect(onUsar).toHaveBeenCalledWith({
      materialId: 'mat-reten',
      nombre: 'Retén 40x72x10',
      unidad: 'u',
      cantidad: 2,
    });
  });

  it('los que ya se cargaron no se ofrecen; los sin stock se ven pero no se pueden usar', async () => {
    lista = [
      repuesto({}),
      repuesto({ id: 'rep-2', materialId: 'mat-rod', materialNombre: 'Rodamiento 6205', stockActual: 0 }),
    ];
    mostrar(<AtajosRepuestos equipoId="eq-1" yaCargados={['mat-reten']} onUsar={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /Rodamiento 6205/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Retén 40x72x10/ })).not.toBeInTheDocument();
  });
});
