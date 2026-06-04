export type TipoMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE';
export type MotivoMovimiento = 'COMPRA' | 'TRABAJO' | 'AJUSTE' | 'DEVOLUCION' | 'OTRO';

export const TIPOS_MOVIMIENTO: TipoMovimiento[] = ['ENTRADA', 'SALIDA', 'AJUSTE'];
export const MOTIVOS_MOVIMIENTO: MotivoMovimiento[] = [
  'COMPRA',
  'TRABAJO',
  'AJUSTE',
  'DEVOLUCION',
  'OTRO',
];

/**
 * Motivos válidos por tipo de movimiento (debe coincidir con la validación del backend).
 * - ENTRADA suma stock: COMPRA u OTRO.
 * - SALIDA resta stock: TRABAJO, DEVOLUCION (al proveedor) u OTRO.
 * - AJUSTE fija el stock: AJUSTE u OTRO.
 */
export const MOTIVOS_POR_TIPO: Record<TipoMovimiento, MotivoMovimiento[]> = {
  ENTRADA: ['COMPRA', 'OTRO'],
  SALIDA: ['TRABAJO', 'DEVOLUCION', 'OTRO'],
  AJUSTE: ['AJUSTE', 'OTRO'],
};

export interface Movimiento {
  id: string;
  materialId: string;
  materialNombre: string | null;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: number;
  fecha: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  usuarioId: string | null;
  usuarioNombre: string | null;
  referenciaTrabajo: string | null;
  notas: string | null;
  creadoEn: string;
}

/** Ítem de historial embebido en el material (sin materialId ni creadoEn). */
export interface HistorialMovimiento {
  id: string;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: number;
  fecha: string;
  proveedorId: string | null;
  usuarioId: string | null;
  referenciaTrabajo: string | null;
  notas: string | null;
}

export interface CrearMovimientoInput {
  materialId: string;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: number;
  fecha?: string;
  proveedorId?: string;
  usuarioId?: string;
  referenciaTrabajo?: string;
  notas?: string;
}

export interface FiltrosMovimientos {
  materialId?: string;
  tipo?: TipoMovimiento;
  motivo?: MotivoMovimiento;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina?: number;
  limite?: number;
}
