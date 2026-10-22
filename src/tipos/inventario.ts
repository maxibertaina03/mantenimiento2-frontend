/** Una toma de inventario: contar lo que hay en el pañol y ajustar el stock. */
export type EstadoToma = 'ABIERTA' | 'CERRADA' | 'ANULADA';

/**
 * Qué pasó con un renglón al confirmar. RECONTAR: el material se movió
 * después de contarlo, y ajustarlo a ciegas pisaría ese movimiento.
 */
export type ResultadoRenglon = 'AJUSTADO' | 'SIN_DIFERENCIA' | 'RECONTAR';

export const ETIQUETA_ESTADO_TOMA: Record<EstadoToma, string> = {
  ABIERTA: 'Abierta',
  CERRADA: 'Cerrada',
  ANULADA: 'Anulada',
};

export interface TomaInventario {
  id: string;
  numero: string;
  categoriaId: string | null;
  categoriaNombre: string | null;
  estanteriaId: string | null;
  estanteriaNombre: string | null;
  estado: EstadoToma;
  notas: string | null;
  abiertaEn: string;
  abiertaPorNombre: string | null;
  cerradaEn: string | null;
  cerradaPorNombre: string | null;
  motivoAnulacion: string | null;
  totalRenglones: number;
  contados: number;
}

export interface RenglonToma {
  id: string;
  materialId: string;
  materialNombre: string;
  unidad: string;
  estanteriaId: string | null;
  estanteriaNombre: string | null;
  fila: number | null;
  /** Lo que se contó; null mientras no se cuenta. */
  contado: number | null;
  /** Lo que figuraba al contarlo. */
  stockAlContar: number | null;
  /** Lo que figura ahora. */
  stockActual: number;
  contadoEn: string | null;
  contadoPorNombre: string | null;
  resultado: ResultadoRenglon | null;
}

export interface ResumenToma {
  total: number;
  contados: number;
  sinContar: number;
  conDiferencia: number;
  ajustados: number;
  sinDiferencia: number;
  recontar: number;
}

/** Un material que se cambió de lugar durante la toma. */
export interface Reubicacion {
  id: string;
  materialId: string;
  materialNombre: string;
  desdeEstanteria: string | null;
  desdeFila: number | null;
  haciaEstanteria: string | null;
  haciaFila: number | null;
  hechaEn: string;
  hechaPorNombre: string | null;
}

export interface DetalleToma {
  toma: TomaInventario;
  renglones: RenglonToma[];
  resumen: ResumenToma;
  /** Lo que se cambió de lugar durante la toma. */
  reubicaciones: Reubicacion[];
}

export interface ResultadoConfirmacion extends DetalleToma {
  ajustados: number;
  sinDiferencia: number;
  recontar: number;
  errores: { materialNombre: string; motivo: string }[];
}

/** De qué es la toma, en palabras: «Electricidad», «Estantería A», «Todo el pañol». */
export function alcanceDeToma(
  t: Pick<TomaInventario, 'categoriaNombre' | 'estanteriaNombre'>,
): string {
  const partes = [t.categoriaNombre, t.estanteriaNombre && `Estantería ${t.estanteriaNombre}`];
  return partes.filter(Boolean).join(' · ') || 'Todo el pañol';
}
