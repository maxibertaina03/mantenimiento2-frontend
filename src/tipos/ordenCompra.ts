export type EstadoOrdenCompra = 'BORRADOR' | 'EMITIDA' | 'RECIBIDA' | 'ANULADA';

/**
 * Etiquetas del ciclo de la orden, en el lenguaje del depósito:
 *   Borrador  -> se está armando, todavía se puede editar
 *   Pendiente de recibo -> ya se imprimió y se le mandó al proveedor
 *   Finalizada -> llegó la mercadería y se sumó al stock
 *
 * Los nombres internos (EMITIDA/RECIBIDA) se mantienen en la base para no
 * migrar datos; solo cambia lo que ve el usuario.
 */
export const ETIQUETA_ESTADO_ORDEN: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'Borrador',
  EMITIDA: 'Pendiente de recibo',
  RECIBIDA: 'Finalizada',
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
