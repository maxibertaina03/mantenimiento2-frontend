import type { HistorialMovimiento } from './movimiento';

export interface Material {
  id: string;
  nombre: string;
  categoriaId: string;
  categoriaNombre: string | null;
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
  unidad: string;
  stockMinimo?: number;
  notas?: string;
}

export type ActualizarMaterialInput = Partial<CrearMaterialInput>;
