import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EquipoPage } from './EquipoPage';

/**
 * La página de un equipo: encabezado con lo de todos los días, pestañas con
 * contadores, y un resumen con lo que hay que mirar.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));
vi.mock('@/componentes/FotoEquipo', () => ({ FotoEquipo: () => null }));

const BOMBA = {
  id: 'eq-1',
  nombre: 'Bomba de leche pasteurizador',
  codigoInterno: 'B-07',
  ubicacionNombre: 'Pretratamiento de leche',
  tipoNombre: 'Bomba',
  marcaNombre: 'WEG',
  modeloNombre: null,
  numeroSerie: 'W22-118842',
  estado: 'OPERATIVO',
  fotoUrl: null,
  qrGeneradoEn: null,
  garantiaVencida: false,
  equipoPadreId: null,
  equipoPadreNombre: null,
  cantidadComponentes: 0,
  descripcion: null,
  proveedorNombre: null,
  horasUso: null,
  fechaAlta: null,
  garantiaHasta: null,
};

const plan = (extra: object) => ({
  id: 'plan-1',
  equipoId: 'eq-1',
  nombre: 'Cambio de sello',
  tareas: null,
  periodicidadDias: 90,
  proximaFecha: '2026-09-29T00:00:00.000Z',
  activo: true,
  estado: 'VENCIDO',
  diasParaVencer: -3,
  ...extra,
});

const repuesto = (extra: object) => ({
  id: 'rep-1',
  equipoId: 'eq-1',
  materialId: 'mat-1',
  materialNombre: 'Caja para rodamientos 62mm',
  unidad: 'u',
  cantidad: 2,
  notas: null,
  stockActual: 1,
  stockMinimo: 0,
  bajoStock: false,
  materialActivo: true,
  ubicacion: null,
  creadoEn: '2026-10-02T10:00:00.000Z',
  ...extra,
});

let planes: object[] = [];
let repuestos: object[] = [];
let existe = true;

beforeEach(() => {
  planes = [];
  repuestos = [];
  existe = true;
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((rutaCruda: string) => {
    const ruta = String(rutaCruda ?? '');
    if (ruta.startsWith('/usuarios/me')) return Promise.resolve({ id: 'u1', nombre: 'Facundo' });
    if (ruta.startsWith('/permisos/mios')) {
      return Promise.resolve({
        rol: 'MANTENIMIENTO',
        permisos: ['equipos.ver', 'equipos.editar', 'trabajos.ver', 'trabajos.editar'],
      });
    }
    if (ruta === '/equipos/eq-1') {
      return existe ? Promise.resolve(BOMBA) : Promise.reject(new Error('404'));
    }
    if (ruta === '/equipos/eq-1/planes') return Promise.resolve(planes);
    if (ruta === '/equipos/eq-1/repuestos') return Promise.resolve(repuestos);
    if (ruta === '/equipos/eq-1/manuales') return Promise.resolve({ disponible: true, manuales: [] });
    if (ruta === '/equipos/almacen/estado') return Promise.resolve({ disponible: false });
    if (ruta.startsWith('/ordenes-trabajo')) {
      return Promise.resolve({
        datos: [
          {
            id: 'ot-11',
            numero: 'OT-2026-0011',
            titulo: 'Purga de agua',
            fecha: '2026-10-01T12:00:00.000Z',
            materiales: [],
          },
        ],
        total: 12,
        pagina: 1,
        limite: 20,
      });
    }
    return Promise.resolve([]);
  });
});

/** Muestra la dirección actual, para comprobar a qué pestaña lleva cada cosa. */
function Direccion() {
  const l = useLocation();
  return <output data-testid="direccion">{l.pathname + l.search}</output>;
}

function mostrar(ruta = '/equipos/eq-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/equipos/:id" element={<EquipoPage />} />
        </Routes>
        <Direccion />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('La página del equipo', () => {
  it('el encabezado tiene el nombre, el estado y las acciones de todos los días', async () => {
    mostrar();
    expect(
      await screen.findByRole('heading', { name: 'Bomba de leche pasteurizador' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Operativo')).toBeInTheDocument();
    // Los botones dependen de los permisos, que llegan después.
    expect(await screen.findByRole('button', { name: '+ Registrar trabajo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '✎ Editar' })).toBeInTheDocument();
  });

  it('las pestañas cuentan lo que hay, y en ámbar lo que hay que mirar', async () => {
    planes = [plan({})];
    repuestos = [repuesto({})];
    mostrar();

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Repuestos/ })).toHaveTextContent('Repuestos1'),
    );
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Trabajos/ })).toHaveTextContent('Trabajos12'),
    );
    // El service vencido pone en ámbar el contador de Planes.
    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: /Planes/ }).querySelector('.contador-pestana-alerta'),
      ).not.toBeNull(),
    );
  });

  it('el resumen junta lo urgente, y cada renglón lleva a su pestaña', async () => {
    planes = [plan({})];
    repuestos = [repuesto({})];
    const usuario = userEvent.setup();
    mostrar();

    expect(await screen.findByText('Service «Cambio de sello»')).toBeInTheDocument();
    expect(screen.getByText('Vencido hace 3 días')).toBeInTheDocument();
    // Lleva 2 y queda 1.
    expect(await screen.findByText('Hay 1 u: no alcanza')).toBeInTheDocument();
    expect(await screen.findByText('OT-2026-0011')).toBeInTheDocument();

    await usuario.click(screen.getByText('Caja para rodamientos 62mm'));
    expect(screen.getByTestId('direccion')).toHaveTextContent('/equipos/eq-1?pestana=repuestos');
    expect(screen.getByRole('tab', { name: /Repuestos/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('sin nada pendiente, lo dice', async () => {
    mostrar();
    expect(await screen.findByText(/Todo en orden/)).toBeInTheDocument();
  });

  it('la pestaña viene en la dirección: un enlace puede llevar directo a una', async () => {
    repuestos = [repuesto({})];
    mostrar('/equipos/eq-1?pestana=repuestos');
    expect(await screen.findByRole('tab', { name: /Repuestos/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByRole('button', { name: '+ Agregar repuesto' })).toBeInTheDocument();
  });

  it('un equipo que no existe lo dice, con la salida a la lista', async () => {
    existe = false;
    mostrar();
    expect(await screen.findByText(/ya no está en el sistema/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver todos los equipos' })).toHaveAttribute(
      'href',
      '/equipos',
    );
  });
});
