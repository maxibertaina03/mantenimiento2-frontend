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
  categoriaId: string;
  /** Id del catálogo de unidades. Obligatorio al crear. */
  unidadId: string;
  stockMinimo?: number;
  notas?: string;
}

export type ActualizarMaterialInput = Partial<CrearMaterialInput>;
