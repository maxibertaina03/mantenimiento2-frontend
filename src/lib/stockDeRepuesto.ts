import { formatearNumero } from './formato';

/** Lo que hace falta de un repuesto para decir si hay en el pañol. */
export interface RepuestoConStock {
  stockActual: number;
  bajoStock: boolean;
  materialActivo: boolean;
  /** Cuántos lleva la máquina, o null si no se dijo. */
  cantidad: number | null;
  unidad: string;
}

export type ClaseStock = 'ok' | 'bajo' | 'sin' | 'fuera';

/**
 * La etiqueta de stock de un repuesto: lo primero que se mira el día que se
 * rompe la máquina. Verde si hay, ámbar si queda poco o no alcanza para lo que
 * lleva, rojo si no hay nada.
 */
export function stockDeRepuesto(r: RepuestoConStock): { clase: ClaseStock; texto: string } {
  const u = r.unidad ? ` ${r.unidad}` : '';
  if (!r.materialActivo) return { clase: 'fuera', texto: 'Fuera de circulación' };
  if (r.stockActual <= 0) return { clase: 'sin', texto: 'Sin stock' };
  if (r.cantidad !== null && r.stockActual < r.cantidad) {
    return {
      clase: 'bajo',
      texto: `Hay ${formatearNumero(r.stockActual)}${u}: no alcanza`,
    };
  }
  if (r.bajoStock) return { clase: 'bajo', texto: `Quedan ${formatearNumero(r.stockActual)}${u}` };
  return { clase: 'ok', texto: `Hay ${formatearNumero(r.stockActual)}${u}` };
}
