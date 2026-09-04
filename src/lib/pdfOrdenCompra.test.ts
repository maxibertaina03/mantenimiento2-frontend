import { beforeEach, describe, expect, it, vi } from 'vitest';
import { descargarPdfOrdenCompra } from './pdfOrdenCompra';
import type { OrdenCompra } from '@/tipos/ordenCompra';

/**
 * El PDF se arma con jsPDF. Acá no validamos el binario: verificamos que la
 * orden se traduzca al documento con los datos que el proveedor necesita ver
 * (número, proveedor, CUIT, renglones y total) y que el archivo se nombre por
 * el número de orden.
 */
const textos: string[] = [];
const guardados: string[] = [];
/** Opciones que el código le pasa a autotable (lo que nos interesa verificar). */
interface OpcionesTabla {
  head: string[][];
  body: string[][];
}
const tablas: OpcionesTabla[] = [];

// jsdom no dispara onload en imagenes, asi que el logo cae en su plazo de
// espera. Se acorta para que los tests no esperen 3 segundos cada uno.
vi.stubGlobal(
  'Image',
  class {
    onerror: (() => void) | null = null;
    set src(_valor: string) {
      setTimeout(() => this.onerror?.(), 0);
    }
  },
);

vi.mock('jspdf', () => {
  class JsPDFFalso {
    internal = {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
    };
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    setLineWidth() {}
    setFont() {}
    setFontSize() {}
    roundedRect() {}
    rect() {}
    addImage() {}
    triangle() {}
    circle() {}
    line() {}
    splitTextToSize(texto: string) {
      return [texto];
    }
    text(contenido: string | string[]) {
      textos.push(...(Array.isArray(contenido) ? contenido : [contenido]));
    }
    save(nombre: string) {
      guardados.push(nombre);
    }
  }
  return { default: JsPDFFalso };
});

vi.mock('jspdf-autotable', () => ({
  default: (doc: { lastAutoTable?: { finalY: number } }, opciones: OpcionesTabla) => {
    tablas.push(opciones);
    // El plugin real deja lastAutoTable en el documento.
    doc.lastAutoTable = { finalY: 120 };
  },
}));

const orden: OrdenCompra = {
  id: 'oc-1',
  numero: 'OC-2026-0007',
  estado: 'EMITIDA',
  proveedorId: 'prov-1',
  proveedorNombre: 'Ferretería Central',
  proveedorCuit: '30-12345678-9',
  proveedorEmail: 'ventas@ferreteria.com.ar',
  proveedorTelefono: '3564 123456',
  fecha: '2026-08-25T10:00:00.000Z',
  observaciones: 'Entregar en portería',
  creadoPorNombre: 'Maxi',
  emitidaEn: '2026-08-25T11:00:00.000Z',
  recibidaEn: null,
  recibidaPorNombre: null,
  remito: null,
  factura: null,
  renglones: [
    {
      id: 'r1',
      materialId: 'm1',
      materialNombre: 'Cable 2.5mm',
      unidad: 'm',
      cantidad: 100,
      precioUnitario: 1250.5,
      subtotal: 125050,
      notas: null,
      movimientoId: null,
    },
  ],
  total: 125050,
  editable: false,
  creadoEn: '2026-08-25T10:00:00.000Z',
};

beforeEach(() => {
  textos.length = 0;
  guardados.length = 0;
  tablas.length = 0;
});

/** Todo el texto del PDF junto, para buscar sin importar la posición. */
const contenido = () => textos.join(' | ');

describe('PDF de la orden de compra', () => {
  it('el archivo se llama como el número de orden', async () => {
    await descargarPdfOrdenCompra(orden);
    expect(guardados).toEqual(['OC-2026-0007.pdf']);
  });

  it('incluye el nombre de la empresa', async () => {
    await descargarPdfOrdenCompra(orden);
    expect(contenido()).toContain('LÁCTEOS LAS TRES S.R.L.');
  });

  it('incluye el número de orden y el título del documento', async () => {
    await descargarPdfOrdenCompra(orden);
    expect(contenido()).toContain('ORDEN DE COMPRA');
    expect(contenido()).toContain('OC-2026-0007');
  });

  it('incluye el proveedor y su CUIT', async () => {
    await descargarPdfOrdenCompra(orden);
    expect(contenido()).toContain('Ferretería Central');
    expect(contenido()).toContain('CUIT: 30-12345678-9');
  });

  it('muestra la fecha de emisión en formato dd/mm/aaaa', async () => {
    await descargarPdfOrdenCompra(orden);
    expect(contenido()).toContain('25/08/2026');
  });

  it('REGRESION: no imprime el estado interno de la orden', async () => {
    await descargarPdfOrdenCompra(orden);
    // El proveedor recibe un pedido, no el estado de nuestro circuito interno.
    expect(contenido()).not.toContain('Estado');
    expect(contenido()).not.toContain('EMITIDA');
  });

  it('REGRESION: no imprime fecha de entrega estimada (se saco del sistema)', async () => {
    await descargarPdfOrdenCompra(orden);
    expect(contenido()).not.toContain('Entrega estimada');
  });

  it('lleva el detalle a una tabla con los renglones', async () => {
    await descargarPdfOrdenCompra(orden);
    expect(tablas).toHaveLength(1);
    expect(tablas[0].body).toEqual([
      ['1', 'Cable 2.5mm', '100', 'm', '$ 1.250,50', '$ 125.050,00'],
    ]);
  });

  it('con precios, la tabla incluye las columnas de importe', async () => {
    await descargarPdfOrdenCompra(orden);
    expect(tablas[0].head[0]).toContain('P. unitario');
    expect(tablas[0].head[0]).toContain('Subtotal');
  });

  it('sin precios, omite las columnas de importe y el total', async () => {
    const sinPrecio: OrdenCompra = {
      ...orden,
      total: null,
      renglones: [{ ...orden.renglones[0], precioUnitario: null, subtotal: null }],
    };
    await descargarPdfOrdenCompra(sinPrecio);
    expect(tablas[0].head[0]).not.toContain('P. unitario');
    expect(contenido()).not.toContain('TOTAL');
  });

  it('imprime el total cuando todos los renglones tienen precio', async () => {
    await descargarPdfOrdenCompra(orden);
    expect(contenido()).toContain('TOTAL');
    expect(contenido()).toContain('$ 125.050,00');
  });

  it('incluye las observaciones', async () => {
    await descargarPdfOrdenCompra(orden);
    expect(contenido()).toContain('Entregar en portería');
  });

  it('deja los espacios de firma', async () => {
    await descargarPdfOrdenCompra(orden);
    expect(contenido()).toContain('Solicitado por');
    expect(contenido()).toContain('Autorizado por');
  });

  it('una orden sin observaciones no rompe', async () => {
    await expect(
      descargarPdfOrdenCompra({ ...orden, observaciones: null }),
    ).resolves.toBeUndefined();
    expect(guardados).toHaveLength(1);
  });
});
