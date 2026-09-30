import type { RenglonInput } from '@/tipos/ordenCompra';

/** Un renglón mientras se arma la orden de compra, antes de mandarla. */
export interface RenglonBorrador extends Omit<RenglonInput, 'cantidad'> {
  /**
   * Identifica al renglón mientras se arma la orden.
   *
   * Antes alcanzaba con el material, porque no había otra cosa que comprar.
   * Ahora un renglón puede ser de un equipo, que todavía no existe y no tiene
   * id: por eso hace falta una clave propia.
   */
  clave: string;
  /** Se guarda para mostrar el nombre sin volver a pedirlo a la API. */
  materialNombre: string;
  unidad: string;
  /**
   * Vacía mientras no se cargó. Los renglones escaneados con la pistola nacen
   * así: se escanean los diez de corrido y las cantidades se ponen después,
   * sentado, en la tabla. La orden no se puede crear hasta que estén todas.
   */
  cantidad: number | undefined;
}

/**
 * Lo que se le manda al servidor de cada renglón.
 *
 * REGRESION: antes se copiaban solo material, cantidad y precio. Un renglón de
 * equipo salía sin su descripción, el servidor lo rechazaba ("cada renglón
 * tiene que decir qué se compra") y no había forma de comprar un equipo desde
 * la pantalla.
 *
 * Los renglones sin cantidad se descartan (`flatMap`): no son una orden de
 * compra válida, y el botón de crear ya no se habilita mientras quede alguno.
 */
export function renglonesParaEnviar(renglones: RenglonBorrador[]): RenglonInput[] {
  return renglones.flatMap((r): RenglonInput[] => {
    if (r.cantidad === undefined) return [];
    const base = { cantidad: r.cantidad, precioUnitario: r.precioUnitario };
    return r.descripcionEquipo
      ? [{ ...base, descripcionEquipo: r.descripcionEquipo, clasificacion: r.clasificacion }]
      : [{ ...base, materialId: r.materialId }];
  });
}
