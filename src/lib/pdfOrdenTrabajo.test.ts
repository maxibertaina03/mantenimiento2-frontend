import { beforeEach, describe, expect, it, vi } from 'vitest';
import { descargarPdfOrdenTrabajo } from './pdfOrdenTrabajo';
import type { Equipo } from '@/tipos/equipo';
import type { OrdenTrabajo } from '@/tipos/ordenTrabajo';
import type { Proveedor } from '@/tipos/proveedor';

/**
 * El papel que acompaña a un motor que se manda a un taller: no se valida el
 * binario, sino que diga qué equipo es, a dónde va y qué hay que hacerle.
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
    getTextWidth(texto: string) {
      return texto.length * 1.5;
    }
    addPage() {}
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

const orden: OrdenTrabajo = {
  id: 'ot-1',
  numero: 'OT-2026-0012',
  titulo: 'Rebobinar motor de la bomba de recibo',
  descripcion: 'Se quemó el bobinado. Revisar rodamientos.',
  tipo: 'CORRECTIVO',
  estado: 'ABIERTA',
  equipoId: 'eq-1',
  equipoNombre: 'Motor 15 HP',
  equipoCodigo: 'MOT-015',
  equipoItId: null,
  equipoItNombre: null,
  equipoItCodigo: null,
  fecha: '2026-10-01T10:00:00.000Z',
  ejecutor: 'EXTERNO',
  proveedorId: 'prov-1',
  proveedorNombre: 'Rebobinados Sur',
  costoManoObra: null,
  horasParada: null,
  planId: null,
  planNombre: null,
  abiertaEn: '2026-10-01T10:00:00.000Z',
  abiertaPorId: 'u1',
  abiertaPorNombre: 'Maxi',
  asignadoAId: 'u2',
  asignadoANombre: 'Jose',
  resolucion: null,
  cerradaEn: null,
  cerradaPorId: null,
  cerradaPorNombre: null,
  motivoAnulacion: null,
  creadoEn: '2026-10-01T10:00:00.000Z',
  materiales: [],
};

const equipo = {
  id: 'eq-1',
  nombre: 'Motor 15 HP',
  codigoInterno: 'MOT-015',
  marcaNombre: 'WEG',
  modeloNombre: 'W22',
  numeroSerie: 'SN-998877',
  ubicacionNombre: 'Sala de bombas',
  tipoNombre: 'Motor eléctrico',
  equipoPadreNombre: 'Bomba de recibo',
} as Equipo;

const proveedor = {
  id: 'prov-1',
  nombre: 'Rebobinados Sur',
  cuit: '30-11111111-2',
  telefono: '3564 555000',
  email: null,
} as Proveedor;

beforeEach(() => {
  textos.length = 0;
  guardados.length = 0;
  tablas.length = 0;
});

const contenido = () => textos.join(' | ');

describe('PDF de la orden de trabajo', () => {
  it('lleva el membrete, el título y el número; el archivo se llama como la orden', async () => {
    await descargarPdfOrdenTrabajo(orden, { equipo, proveedor });
    expect(contenido()).toContain('LÁCTEOS LAS TRES S.R.L.');
    expect(contenido()).toContain('ORDEN DE TRABAJO');
    expect(contenido()).toContain('OT-2026-0012');
    expect(guardados).toEqual(['OT-2026-0012.pdf']);
  });

  it('dice qué equipo es, con lo que hace falta para reconocerlo', async () => {
    await descargarPdfOrdenTrabajo(orden, { equipo, proveedor });
    const c = contenido();
    expect(c).toContain('Motor 15 HP');
    expect(c).toContain('Marca y modelo: WEG W22');
    expect(c).toContain('N° de serie: SN-998877');
    expect(c).toContain('Ubicación: Sala de bombas');
    expect(c).toContain('Montado en: Bomba de recibo');
  });

  it('dice a qué taller va, con cómo ubicarlo', async () => {
    await descargarPdfOrdenTrabajo(orden, { equipo, proveedor });
    const c = contenido();
    expect(c).toContain('SE ENVÍA A');
    expect(c).toContain('Rebobinados Sur');
    expect(c).toContain('CUIT: 30-11111111-2');
    expect(c).toContain('Tel.: 3564 555000');
  });

  it('dice qué hay que hacerle, y deja lugar para que el taller complete', async () => {
    await descargarPdfOrdenTrabajo(orden, { equipo, proveedor });
    const c = contenido();
    expect(c).toContain('Rebobinar motor de la bomba de recibo');
    expect(c).toContain('Se quemó el bobinado. Revisar rodamientos.');
    expect(c).toContain('PARA COMPLETAR POR EL TALLER');
    expect(c).toContain('Retiró (Logística)');
  });

  it('sin la ficha del equipo ni del taller, sale igual con los nombres de la orden', async () => {
    await descargarPdfOrdenTrabajo(orden);
    const c = contenido();
    expect(c).toContain('Motor 15 HP');
    expect(c).toContain('Código: MOT-015');
    expect(c).toContain('Rebobinados Sur');
  });

  it('un trabajo hecho en fábrica no habla de taller ni de logística', async () => {
    await descargarPdfOrdenTrabajo({ ...orden, ejecutor: 'INTERNO', proveedorId: null, proveedorNombre: null });
    const c = contenido();
    expect(c).not.toContain('SE ENVÍA A');
    expect(c).not.toContain('Logística');
  });

  it('cerrada, muestra lo que se hizo y los materiales en una tabla', async () => {
    await descargarPdfOrdenTrabajo(
      {
        ...orden,
        estado: 'CERRADA',
        resolucion: 'Volvió rebobinado y con rodamientos nuevos',
        cerradaEn: '2026-10-08T10:00:00.000Z',
        costoManoObra: 85000,
        materiales: [
          {
            id: 'mu1',
            ordenTrabajoId: 'ot-1',
            materialId: 'm1',
            cantidad: 2,
            movimientoId: 'mov1',
            materialNombre: 'Rodamiento 6205',
            unidad: 'u',
            registradoPorId: null,
            creadoEn: '2026-10-08T10:00:00.000Z',
          },
        ],
      },
      { equipo, proveedor },
    );
    const c = contenido();
    expect(c).toContain('TRABAJO REALIZADO');
    expect(c).toContain('Volvió rebobinado y con rodamientos nuevos');
    expect(c).not.toContain('PARA COMPLETAR POR EL TALLER');
    expect(tablas[0].body[0]).toContain('Rodamiento 6205');
  });
});
