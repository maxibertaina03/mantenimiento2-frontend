import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterialConHistorial, UltimoInventario } from '@/tipos/material';
import { MaterialDetallePage } from './MaterialDetallePage';

/**
 * La ficha del material: la foto para reconocerlo y cuándo se lo contó por
 * última vez.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

const MATERIAL: MaterialConHistorial = {
  id: 'm1',
  nombre: 'Retén bomba Grundfos',
  categoriaId: 'c1',
  categoriaNombre: 'Repuestos',
  unidadId: 'u1',
  unidadNombre: 'Unidad',
  unidad: 'u',
  stockActual: 9,
  stockMinimo: 0,
  bajoStock: false,
  activo: true,
  estanteriaId: null,
  estanteriaNombre: null,
  fila: null,
  qrGeneradoEn: null,
  fotoUrl: null,
  notas: null,
  creadoEn: '2026-06-01T10:00:00.000Z',
  actualizadoEn: '2026-06-01T10:00:00.000Z',
  movimientos: [],
  ultimoInventario: null,
};

let material: MaterialConHistorial;
let permisos: string[];

function mostrar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/materiales/m1']}>
        <Routes>
          <Route path="/materiales/:id" element={<MaterialDetallePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  material = MATERIAL;
  permisos = ['materiales.ver', 'materiales.editar', 'inventario.ver'];
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((ruta: string) => {
    if (ruta.startsWith('/permisos/mios')) return Promise.resolve({ rol: 'ADMIN', permisos });
    if (ruta === '/materiales/m1/historial') return Promise.resolve(material);
    if (ruta === '/materiales/fotos/estado') return Promise.resolve({ disponible: true });
    return Promise.resolve([]);
  });
});

const toma: UltimoInventario = {
  origen: 'TOMA',
  fecha: '2026-10-16T12:00:00.000Z',
  contado: 9,
  figuraba: 10,
  resultado: 'AJUSTADO',
  tomaId: 't1',
  tomaNumero: 'TI-2026-0001',
  porNombre: 'Facundo',
};

describe('MaterialDetallePage', () => {
  it('dice cuándo se contó por última vez, con el enlace a la toma', async () => {
    material = { ...MATERIAL, ultimoInventario: toma };
    mostrar();
    expect(await screen.findByText('Último inventario')).toBeInTheDocument();
    expect(screen.getByText(/16\/10\/2026/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'TI-2026-0001' })).toHaveAttribute(
      'href',
      '/inventario/t1',
    );
    expect(
      screen.getByText(/Se contaron 9 u, figuraban 10 · se ajustó · Facundo/),
    ).toBeInTheDocument();
  });

  it('un ajuste a mano también cuenta, y lo dice', async () => {
    material = {
      ...MATERIAL,
      ultimoInventario: {
        ...toma,
        origen: 'AJUSTE',
        figuraba: null,
        resultado: null,
        tomaId: null,
        tomaNumero: null,
        contado: 4,
        porNombre: null,
      },
    };
    mostrar();
    expect(await screen.findByText('Ajuste a mano a 4 u')).toBeInTheDocument();
  });

  it('si nunca se contó, lo dice', async () => {
    mostrar();
    expect(await screen.findByText('Nunca se contó')).toBeInTheDocument();
  });

  it('muestra la foto y deja cambiarla a quien puede editar', async () => {
    material = { ...MATERIAL, fotoUrl: 'https://x/materiales/m1/reten.jpg' };
    mostrar();
    expect(await screen.findByRole('img', { name: 'Retén bomba Grundfos' })).toHaveAttribute(
      'src',
      'https://x/materiales/m1/reten.jpg',
    );
    expect(await screen.findByText('Cambiar la foto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sacar la foto' })).toBeInTheDocument();
  });

  it('sin foto, ofrece subirla', async () => {
    mostrar();
    expect(await screen.findByText('Subí una foto del material')).toBeInTheDocument();
  });

  it('quien solo mira ve la foto pero no la puede cambiar', async () => {
    permisos = ['materiales.ver'];
    material = { ...MATERIAL, fotoUrl: 'https://x/materiales/m1/reten.jpg' };
    mostrar();
    expect(await screen.findByRole('img', { name: 'Retén bomba Grundfos' })).toBeInTheDocument();
    expect(screen.queryByText('Cambiar la foto')).not.toBeInTheDocument();
  });
});
