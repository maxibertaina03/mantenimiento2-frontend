import type { HistorialMovimiento } from './movimiento';

export interface Material {
  id: string;
  nombre: string;
  categoriaId: string;
  categoriaNombre: string | null;
  unidadId: string | null;
  unidadNombre: string | null;
  /** Símbolo de la unidad, o "" si el material todavía no tiene una cargada. */
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  bajoStock: boolean;
  /** false = jubilado: conserva su historial pero ya no se ofrece al cargar. */
  activo: boolean;
  /** Dónde está guardado en el depósito. Ambos null si todavía no se ubicó. */
  estanteriaId: string | null;
  estanteriaNombre: string | null;
  fila: number | null;
  /** Cuándo se imprimió su etiqueta QR. null = todavía no tiene. */
  qrGeneradoEn: string | null;
  notas: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** Material con su historial completo de movimientos. */
export interface MaterialConHistorial extends Material {
  movimientos: HistorialMovimiento[];
}

export interface CrearMaterialInput {
  nombre: string;
  /** Dónde va guardado. La fila necesita la estantería; sola no ubica nada. */
  estanteriaId?: string | null;
  fila?: number | null;
  categoriaId: string;
  /** Id del catálogo de unidades. Obligatorio al crear. */
  unidadId: string;
  stockMinimo?: number;
  notas?: string;
}

export type ActualizarMaterialInput = Partial<CrearMaterialInput> & {
  /** Sacar de circulación (false) o volver a ponerlo en uso (true). */
  activo?: boolean;
};

/** Qué materiales trae el listado. Por defecto, solo los que están en uso. */
export type VistaMaterial = 'activos' | 'inactivos' | 'todos';
