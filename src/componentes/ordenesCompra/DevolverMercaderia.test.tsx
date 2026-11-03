import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Palabra } from '@/lib/factura/interpretarFactura';
import type { OrdenCompra } from '@/tipos/ordenCompra';
import { DevolverMercaderia } from './DevolverMercaderia';

/**
 * Devolver al proveedor: se elige cuánto vuelve de cada renglón, si sale del
 * pañol, y la nota de crédito puede completar cantidades y precios.
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

const p = (texto: string, y: number): Palabra => ({ texto, x: 10, y, alto: 10, pagina: 1 });
vi.mock('@/lib/factura/leerTexto', () => ({
  leerFactura: async () => [
    p('Nota de Crédito', 5),
    p('COD.03', 8),
    p('11202105@ WHITE FILTRO SUC MOT QUEM 7/8 UN. 1,00 93.936,77 21% 113.663,49', 100),
  ],
}));

const renglon = (
  id: string,
  materialId: string,
  nombre: string,
  recibida: number,
  devuelta = 0,
) => ({
  id,
  materialId,
  materialNombre: nombre,
  unidad: 'u',
  cantidad: recibida,
  precioUnitario: null,
  subtotal: null,
  notas: null,
  movimientoId: null,
  descripcionEquipo: null,
  clasificacion: null,
  cantidadRecibida: recibida,
  pendiente: 0,
  cantidadDevuelta: devuelta,
});

const ORDEN = {
  id: 'oc-36',
  numero: 'OC-2026-0036',
  estado: 'RECIBIDA',
  proveedorNombre: 'Moroni',
  renglones: [
    renglon('r1', 'm1', 'Filtro succión 7/8', 2),
    renglon('r2', 'm2', 'Válvula termostática', 1, 1),
  ],
  devoluciones: [],
  estadoDevolucion: 'SIN_DEVOLUCION',
} as unknown as OrdenCompra;

let enviado: unknown = null;

beforeEach(() => {
  enviado = null;
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((ruta: string, opciones?: { body?: unknown }) => {
    if (ruta.startsWith('/permisos/mios')) {
      return Promise.resolve({ rol: 'ADMIN', permisos: ['ordenes.editar', 'ordenes.recibir'] });
    }
    if (ruta.endsWith('/factura/sugerencias')) {
      return Promise.resolve([
        {
          renglonId: 'r1',
          itemIndice: 0,
          puntaje: 85,
          seguridad: 'ALTA',
          porEquivalencia: false,
          precioNeto: 93936.77,
        },
      ]);
    }
    if (ruta.endsWith('/devoluciones')) {
      enviado = opciones?.body;
      return Promise.resolve(ORDEN);
    }
    return Promise.resolve({});
  });
});

function mostrar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onListo = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <DevolverMercaderia orden={ORDEN} onListo={onListo} onCancelar={() => {}} />
    </QueryClientProvider>,
  );
  return onListo;
}

describe('DevolverMercaderia', () => {
  it('solo ofrece lo que llegó y no volvió', () => {
    mostrar();
    expect(screen.getByText('Filtro succión 7/8')).toBeInTheDocument();
    // La válvula ya se devolvió entera.
    expect(screen.queryByText('Válvula termostática')).not.toBeInTheDocument();
  });

  it('«Devolver todo» y lo que ya se usó no sale del pañol', async () => {
    const onListo = mostrar();

    await userEvent.click(screen.getByRole('button', { name: 'Devolver todo' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sale del pañol' }));
    await userEvent.type(screen.getByLabelText('Nº de nota de crédito'), '00008-00000828');
    await userEvent.click(screen.getByRole('button', { name: /Devolver 1 renglón/ }));

    await waitFor(() => expect(onListo).toHaveBeenCalled());
    expect(enviado).toMatchObject({
      notaCredito: '00008-00000828',
      renglones: [{ renglonId: 'r1', cantidad: 2, precioUnitario: null, moverStock: false }],
    });
  });

  it('la nota de crédito completa cantidad y precio', async () => {
    mostrar();
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    // Se habilita cuando llegan los permisos.
    await waitFor(() => expect(input).not.toBeDisabled());
    await userEvent.upload(input, new File(['%PDF'], 'nc.pdf', { type: 'application/pdf' }));

    expect(await screen.findByText(/Se completaron 1 renglones/)).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad a devolver de Filtro succión 7/8')).toHaveValue(1);
    expect(screen.getByLabelText('Precio de Filtro succión 7/8 en la nota de crédito')).toHaveValue(
      93936.77,
    );
  });
});
