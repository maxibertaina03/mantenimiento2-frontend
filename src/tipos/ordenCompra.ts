export type EstadoOrdenCompra = 'BORRADOR' | 'EMITIDA' | 'RECIBIDA' | 'ANULADA';

/**
 * Etiquetas del ciclo de la orden, en el lenguaje del depósito:
 *   Orden creada        -> se está armando, todavía se puede editar
 *   Pendiente de recibo -> ya se imprimió y se le mandó al proveedor
 *   Finalizada          -> llegó la mercadería y se sumó al stock
 *
 * Los nombres internos (BORRADOR/EMITIDA/RECIBIDA) se mantienen en la base
 * para no migrar datos; solo cambia lo que ve el usuario.
 */
export const ETIQUETA_ESTADO_ORDEN: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'Orden creada',
  EMITIDA: 'Pendiente de recibo',
  RECIBIDA: 'Finalizada',
  ANULADA: 'Anulada',
};

/** Una maquina de planta, o una herramienta que merece ficha propia. */
export const CLASIFICACIONES_EQUIPO = ['EQUIPO', 'HERRAMIENTA'] as const;
export type ClasificacionEquipo = (typeof CLASIFICACIONES_EQUIPO)[number];

export const ETIQUETA_CLASIFICACION: Record<ClasificacionEquipo, string> = {
  EQUIPO: 'Equipo',
  HERRAMIENTA: 'Herramienta',
};

/** En plural, para las pestanias y los titulos de listas. */
export const ETIQUETA_CLASIFICACION_PLURAL: Record<ClasificacionEquipo, string> = {
  EQUIPO: 'Equipos',
  HERRAMIENTA: 'Herramientas',
};

export interface RenglonOrden {
  id: string;
  /** Nulo cuando el renglon es de un equipo y no de un material del paniol. */
  materialId: string | null;
  materialNombre: string | null;
  unidad: string | null;
  cantidad: number;
  precioUnitario: number | null;
  subtotal: number | null;
  notas: string | null;
  movimientoId: string | null;

  /** Que equipo se compra, cuando el renglon no es de material. */
  descripcionEquipo: string | null;
  clasificacion: ClasificacionEquipo | null;
}

/**
 * Qué se compra en un renglón: el material del pañol, o el equipo.
 *
 * Un renglón de equipo no tiene material, y mostrar solo `materialNombre`
 * lo dejaba en blanco en la pantalla, el PDF y el mensaje al proveedor.
 */
export function nombreDelRenglon(r: Pick<RenglonOrden, 'materialNombre' | 'descripcionEquipo'>) {
  return r.materialNombre ?? r.descripcionEquipo ?? null;
}

export interface OrdenCompra {
  id: string;
  numero: string;
  estado: EstadoOrdenCompra;
  proveedorId: string;
  proveedorNombre: string | null;
  proveedorCuit: string | null;
  /** Para ofrecer el envío por correo. */
  proveedorEmail: string | null;
  /** Para ofrecer el envío por WhatsApp. */
  proveedorTelefono: string | null;
  fecha: string;
  observaciones: string | null;
  creadoPorNombre: string | null;
  emitidaEn: string | null;
  recibidaEn: string | null;
  recibidaPorNombre: string | null;
  /** Comprobante con el que llegó la mercadería. */
  remito: string | null;
  factura: string | null;
  renglones: RenglonOrden[];
  total: number | null;
  editable: boolean;
  creadoEn: string;
}

export interface RenglonInput {
  /** Uno o el otro, nunca los dos: lo hace cumplir el backend. */
  materialId?: string;
  descripcionEquipo?: string;
  clasificacion?: ClasificacionEquipo;
  cantidad: number;
  precioUnitario?: number;
  notas?: string;
}

export interface CrearOrdenInput {
  proveedorId: string;
  observaciones?: string;
  renglones: RenglonInput[];
}

export type ActualizarOrdenInput = Partial<CrearOrdenInput>;

export interface RecibirOrdenInput {
  fechaRecepcion?: string;
  /** Remito o factura: hace falta al menos uno para cerrar la orden. */
  remito?: string;
  factura?: string;
  notas?: string;
}
