/**
 * Unidad de medida del catálogo.
 *
 * Antes la unidad era texto libre en cada material, así que "lt", "Lt" y
 * "litros" eran tres unidades distintas y cualquier reporte que agrupara por
 * unidad daba números que no cerraban. Ahora hay una sola fila por unidad.
 */
export interface UnidadMedida {
  id: string;
  /** Nombre completo, el que se lee en el desplegable. Ej: "Litro". */
  nombre: string;
  /** Abreviatura que acompaña a las cantidades. Ej: "lt". */
  simbolo: string;
  orden: number;
  activo: boolean;
  /** Cuántos materiales la usan: si es > 0 no se puede borrar. */
  materiales: number;
}

export interface CrearUnidadInput {
  nombre: string;
  simbolo: string;
  orden?: number;
  activo?: boolean;
}
