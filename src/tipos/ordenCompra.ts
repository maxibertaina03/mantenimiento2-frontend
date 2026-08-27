export type EstadoOrdenCompra = 'BORRADOR' | 'EMITIDA' | 'RECIBIDA' | 'ANULADA';

export const ETIQUETA_ESTADO_ORDEN: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'Borrador',
  EMITIDA: 'Emitida',
  RECIBIDA: 'Recibida',
  ANULADA: 'Anulada',
};

export interface RenglonOrden {
  id: string;
  materialId: string;
  materialNombre: string | null;
  unidad: string | null;
  cantidad: number;
  precioUnitario: number | null;
  subtotal: number | null;
  notas: string | null;
  movimientoId: string | null;
}

export interface OrdenCompra {
  id: string;
  numero: string;
  estado: EstadoOrdenCompra;
  proveedorId: string;
  proveedorNombre: string | null;
  proveedorCuit: string | null;
  fecha: string;
  fechaEntregaEstimada: string | null;
  observaciones: string | null;
  creadoPorNombre: string | null;
  emitidaEn: string | null;
  recibidaEn: string | null;
  recibidaPorNombre: string | null;
  renglones: RenglonOrden[];
  total: number | null;
  editable: boolean;
  creadoEn: string;
}

export interface RenglonInput {
  materialId: string;
  cantidad: number;
  precioUnitario?: number;
  notas?: string;
}

export interface CrearOrdenInput {
  proveedorId: string;
  fechaEntregaEstimada?: string;
  observaciones?: string;
  renglones: RenglonInput[];
}

export type ActualizarOrdenInput = Partial<CrearOrdenInput>;

export interface RecibirOrdenInput {
  fechaRecepcion?: string;
  remito?: string;
  notas?: string;
}
