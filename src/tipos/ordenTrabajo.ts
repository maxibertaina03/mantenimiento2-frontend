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

/** Quien hizo el trabajo: la planta o un tercero. */
export const EJECUTORES = ['INTERNO', 'EXTERNO'] as const;
export type Ejecutor = (typeof EJECUTORES)[number];

export const ETIQUETA_EJECUTOR: Record<Ejecutor, string> = {
  INTERNO: 'En fábrica',
  EXTERNO: 'Servicio externo',
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
  /** Cuándo se hizo el trabajo, que no es cuándo se abrió la orden. */
  fecha: string;
  ejecutor: Ejecutor;
  proveedorId: string | null;
  proveedorNombre: string | null;
  costoManoObra: number | null;
  horasParada: number | null;
  planId: string | null;
  planNombre: string | null;
  abiertaEn: string;
  abiertaPorId: string | null;
  abiertaPorNombre: string | null;
  /** Quién tiene que hacer el trabajo. Solo esa persona puede terminarlo. */
  asignadoAId: string;
  asignadoANombre: string | null;
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
  /** Si no viene, la orden queda para quien la abre. */
  asignadoAId?: string | null;

  /** Cuándo se hizo. Si no viene, ahora. */
  fecha?: string;
  ejecutor?: Ejecutor;
  proveedorId?: string | null;
  costoManoObra?: number | null;
  horasParada?: number | null;
  planId?: string | null;

  /**
   * Si viene, el trabajo ya está hecho y la orden nace cerrada con este texto.
   * Es el camino desde la ficha de una máquina.
   */
  resolucion?: string;
  /** Lo que se usó. Sale del pañol igual que en una orden abierta. */
  materiales?: { materialId: string; cantidad: number }[];
}

/** Lo que se puede cargar recién al cerrar, que es cuando se sabe. */
export interface CerrarOrdenTrabajoInput {
  resolucion: string;
  ejecutor?: Ejecutor;
  proveedorId?: string | null;
  costoManoObra?: number | null;
  horasParada?: number | null;
}

/** Alguien que puede hacerse cargo de una orden. */
export interface UsuarioAsignable {
  id: string;
  nombre: string;
}

export interface FiltrosOrdenesTrabajo {
  buscar?: string;
  estado?: EstadoOrdenTrabajo;
  tipo?: TipoTrabajo;
  equipoId?: string;
  asignadoAId?: string;
}
