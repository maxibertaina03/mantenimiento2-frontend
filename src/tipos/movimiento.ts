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

export interface Movimiento {
  id: string;
  materialId: string;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: number;
  fecha: string;
  proveedorId: string | null;
  usuarioId: string | null;
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
