/**
 * Órdenes de trabajo: para qué se usó lo que salió del pañol.
 *
 * Los tipos son un reflejo del dominio del backend. Se repiten acá y no se
 * comparten porque son dos proyectos que se despliegan por separado: un paquete
 * compartido obligaría a publicar una versión por cada cambio de un campo.
 */
export const ESTADOS_ORDEN_TRABAJO = ['ABIERTA', 'CERRADA', 'ANULADA'] as const;
export type EstadoOrdenTrabajo = (typeof ESTADOS_ORDEN_TRABAJO)[number];

export const ETIQUETA_ESTADO_TRABAJO: Record<EstadoOrdenTrabajo, string> = {
  ABIERTA: 'Abierta',
  CERRADA: 'Cerrada',
  ANULADA: 'Anulada',
};

export const TIPOS_TRABAJO = ['PREVENTIVO', 'CORRECTIVO', 'MEJORA'] as const;
export type TipoTrabajo = (typeof TIPOS_TRABAJO)[number];

export const ETIQUETA_TIPO_TRABAJO: Record<TipoTrabajo, string> = {
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
  MEJORA: 'Mejora',
};

export interface MaterialUsado {
  id: string;
  ordenTrabajoId: string;
  materialId: string;
  cantidad: number;
  /** La salida de stock que generó cargarlo. */
  movimientoId: string;
  materialNombre: string;
  unidad: string;
  registradoPorId: string | null;
  creadoEn: string;
}

export interface OrdenTrabajo {
  id: string;
  numero: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoTrabajo;
  estado: EstadoOrdenTrabajo;
  equipoId: string | null;
  equipoNombre: string | null;
  equipoCodigo: string | null;
  abiertaEn: string;
  abiertaPorId: string | null;
  abiertaPorNombre: string | null;
  resolucion: string | null;
  cerradaEn: string | null;
  cerradaPorId: string | null;
  cerradaPorNombre: string | null;
  motivoAnulacion: string | null;
  creadoEn: string;
  materiales: MaterialUsado[];
}

export interface OrdenTrabajoConResumen extends OrdenTrabajo {
  resumen: { materialesDistintos: number; unidadesTotales: number };
}

export interface CrearOrdenTrabajoInput {
  titulo: string;
  descripcion?: string | null;
  tipo: TipoTrabajo;
  equipoId?: string | null;
}

export interface FiltrosOrdenesTrabajo {
  buscar?: string;
  estado?: EstadoOrdenTrabajo;
  tipo?: TipoTrabajo;
  equipoId?: string;
}
