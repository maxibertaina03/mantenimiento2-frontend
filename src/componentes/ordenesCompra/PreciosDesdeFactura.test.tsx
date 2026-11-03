import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Palabra } from '@/lib/factura/interpretarFactura';
import type { OrdenCompra } from '@/tipos/ordenCompra';
import { PreciosDesdeFactura } from './PreciosDesdeFactura';

/**
 * Cargar precios desde la factura: lo seguro viene tildado, lo dudoso no, y
 * «Confirmar» manda solo lo tildado, con lo que hay que aprender.
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

// La lectura del archivo (pdf.js / OCR) no corre en las pruebas: devuelve
// las palabras de una factura B inventada.
const p = (texto: string, y: number): Palabra => ({ texto, x: 10, y, alto: 10, pagina: 1 });
vi.mock('@/lib/factura/leerTexto', () => ({
  leerFactura: async () => [
    p('FACTURA B', 5),
    p('4 ROD. 6204 2RS 6.050,00 24.200,00', 100),
    p('2 CORREA A-40 12.100,00 24.200,00', 120),
  ],
}));

const renglon = (id: string, materialId: string, nombre: string, cantidad: number) => ({
  id,
  materialId,
  materialNombre: nombre,
  unidad: 'u',
  cantidad,
  precioUnitario: null,
  subtotal: null,
  notas: null,
  movimientoId: null,
  descripcionEquipo: null,
  clasificacion: null,
  cantidadRecibida: 0,
  pendiente: cantidad,
});

const ORDEN = {
  id: 'oc-1',
  numero: 'OC-0001',
  estado: 'EMITIDA',
  proveedorId: 'prov-1',
  proveedorNombre: 'Rodamientos Sur',
  proveedorCuit: null,
  renglones: [renglon('r1', 'm1', 'Rulemán 6204', 4), renglon('r2', 'm2', 'Correa A40', 2)],
} as unknown as OrdenCompra;

let confirmado: unknown = null;

beforeEach(() => {
  // jsdom no tiene URL de objetos: la factura se muestra al lado con una.
  URL.createObjectURL = vi.fn(() => 'blob:factura');
  URL.revokeObjectURL = vi.fn();
  confirmado = null;
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((ruta: string, opciones?: { body?: unknown }) => {
    if (ruta.startsWith('/permisos/mios')) {
      return Promise.resolve({ rol: 'ADMIN', permisos: ['ordenes.editar'] });
    }
    if (ruta.endsWith('/comprobantes')) return Promise.resolve([]);
    if (ruta.endsWith('/factura/sugerencias')) {
      return Promise.resolve([
        {
          renglonId: 'r1',
          itemIndice: 0,
          puntaje: 90,
          seguridad: 'ALTA',
          porEquivalencia: false,
          precioNeto: 5000,
        },
        {
          renglonId: 'r2',
          itemIndice: 1,
          puntaje: 40,
          seguridad: 'BAJA',
          porEquivalencia: false,
          precioNeto: 10000,
        },
      ]);
    }
    if (ruta.endsWith('/factura/confirmar')) {
      confirmado = opciones?.body;
      return Promise.resolve(ORDEN);
    }
    return Promise.resolve({});
  });
});

async function abrirYLeer() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onListo = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <PreciosDesdeFactura orden={ORDEN} onListo={onListo} onCerrar={() => {}} />
    </QueryClientProvider>,
  );
  const archivo = new File(['%PDF'], 'factura.pdf', { type: 'application/pdf' });
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  await userEvent.upload(input, archivo);
  await screen.findByText(/Confirmar y cargar/);
  return onListo;
}

describe('PreciosDesdeFactura', () => {
  it('muestra la factura leída al lado de la revisión', async () => {
    await abrirYLeer();
    expect(screen.getByRole('region', { name: 'La factura leída' })).toBeInTheDocument();
    expect(screen.getByTitle('Factura en PDF')).toHaveAttribute('src', 'blob:factura');
  });

  it('lee la factura, detecta la B y propone: lo seguro tildado, lo dudoso no', async () => {
    await abrirYLeer();

    expect(screen.getByLabelText('Tipo de factura')).toHaveValue('B');
    const sugerir = apiRequestMock.mock.calls.find(([r]) => r.endsWith('/factura/sugerencias'))!;
    expect(sugerir[1].body).toMatchObject({ letra: 'B' });
    const casillas = screen.getAllByRole('checkbox', { name: 'Cargar' });
    expect(casillas.map((c) => (c as HTMLInputElement).checked)).toEqual([true, false]);
    expect(screen.getByText('Seguro')).toBeInTheDocument();
    expect(screen.getByText('Dudoso')).toBeInTheDocument();
  });

  it('confirmar manda solo lo tildado, con la equivalencia a aprender', async () => {
    const onListo = await abrirYLeer();

    await userEvent.click(screen.getByRole('button', { name: /Confirmar y cargar 1 precio/ }));

    await waitFor(() => expect(onListo).toHaveBeenCalled());
    expect(confirmado).toEqual({
      precios: [{ renglonId: 'r1', precioUnitario: 5000 }],
      equivalencias: [
        { materialId: 'm1', codigoProveedor: null, descripcionProveedor: 'ROD. 6204 2RS' },
      ],
    });
  });

  it('pasar a factura A recalcula el precio sin sacar IVA', async () => {
    await abrirYLeer();

    await userEvent.selectOptions(screen.getByLabelText('Tipo de factura'), 'A');

    expect(screen.getByLabelText('Precio sin IVA de Rulemán 6204')).toHaveValue(6050);
  });
});
