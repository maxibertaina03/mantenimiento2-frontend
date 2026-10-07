import type { ClasificacionEquipo } from './ordenCompra';
export const ESTADOS_EQUIPO = [
  'OPERATIVO',
  'EN_REPARACION',
  'FUERA_DE_SERVICIO',
  'DADO_DE_BAJA',
] as const;
export type EstadoEquipo = (typeof ESTADOS_EQUIPO)[number];

export const ETIQUETA_ESTADO_EQUIPO: Record<EstadoEquipo, string> = {
  OPERATIVO: 'Operativo',
  EN_REPARACION: 'En reparación',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
  DADO_DE_BAJA: 'Dado de baja',
};

/**
 * Desde qué estados se puede pasar a cada otro.
 *
 * Es una copia de la regla que vive en el dominio del backend, y está acá con
 * un solo fin: no ofrecer en el desplegable una opción que el servidor va a
 * rechazar. El backend sigue siendo el que decide — esto es cortesía con quien
 * usa la pantalla, no una validación.
 */
export const TRANSICIONES_ESTADO: Record<EstadoEquipo, readonly EstadoEquipo[]> = {
  OPERATIVO: ['EN_REPARACION', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA'],
  EN_REPARACION: ['OPERATIVO', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA'],
  FUERA_DE_SERVICIO: ['OPERATIVO', 'EN_REPARACION', 'DADO_DE_BAJA'],
  DADO_DE_BAJA: [],
};

export interface Equipo {
  id: string;
  codigoInterno: string | null;
  nombre: string;
  descripcion: string | null;
  /** Marca y modelo salen de catálogos: viaja el id y el nombre para mostrar. */
  marcaId: string | null;
  marcaNombre: string | null;
  modeloId: string | null;
  modeloNombre: string | null;
  numeroSerie: string | null;
  ubicacionId: string | null;
  ubicacionNombre: string | null;
  tipoId: string | null;
  tipoNombre: string | null;
  estado: EstadoEquipo;
  /**
   * Si es una maquina de planta o una herramienta.
   *
   * Es una categoria por encima del tipo: una prensa es un EQUIPO de tipo
   * "Prensa"; una amoladora es una HERRAMIENTA.
   */
  clasificacion: ClasificacionEquipo;
  fotoUrl: string | null;
  proveedorId: string | null;
  proveedorNombre: string | null;
  horasUso: number | null;
  fechaAlta: string | null;
  garantiaHasta: string | null;
  /** Derivado en el servidor: no está guardado en la base. */
  garantiaVencida: boolean;
  /** En qué máquina está montado hoy (la electrobomba en la desnatadora), o null. */
  equipoPadreId: string | null;
  equipoPadreNombre: string | null;
  /** Cuántos equipos tiene montados, en el primer nivel. */
  cantidadComponentes: number;
  /** Cuándo se imprimió su etiqueta QR. null = todavía no tiene. */
  qrGeneradoEn: string | null;
}

export interface CrearEquipoInput {
  /** Maquina de planta o herramienta. Por defecto, maquina. */
  clasificacion?: ClasificacionEquipo;
  nombre: string;
  codigoInterno?: string | null;
  descripcion?: string | null;
  marcaId?: string | null;
  modeloId?: string | null;
  numeroSerie?: string | null;
  ubicacionId?: string | null;
  tipoId?: string | null;
  proveedorId?: string | null;
  fotoUrl?: string | null;
  horasUso?: number | null;
  fechaAlta?: string | null;
  garantiaHasta?: string | null;
}

export type ActualizarEquipoInput = Partial<CrearEquipoInput> & { estado?: EstadoEquipo };

export interface FiltrosEquipos {
  buscar?: string;
  ubicacionId?: string;
  tipoId?: string;
  marcaId?: string;
  modeloId?: string;
  estado?: EstadoEquipo;
  /** Solo maquinas, o solo herramientas. */
  clasificacion?: ClasificacionEquipo;
  garantiaVencida?: boolean;
  /** Solo los que todavía no tienen etiqueta QR impresa. */
  sinQr?: boolean;
  ordenarPor?: 'nombre' | 'codigo' | 'ubicacion';
  direccion?: 'asc' | 'desc';
}

// ── Importación desde la carpeta de fotos ──
export type Advertencia = 'posible_equipo_it' | 'posible_duplicado' | 'nombre_automatico';

export interface EquipoDetectado {
  nombre: string;
  ubicacion: string;
  ruta: string;
  advertencias: Advertencia[];
  /** Sale de la carpeta: lo que esta en "Taller" son herramientas. */
  clasificacion: ClasificacionEquipo;
}

export interface DeteccionImportacion {
  equipos: EquipoDetectado[];
  descartados: { ruta: string; motivo: string }[];
  ubicaciones: string[];
}

export interface ResultadoImportacionEquipos {
  creados: number;
  yaExistian: number;
  ubicacionesCreadas: string[];
  fallidos: { nombre: string; motivo: string }[];
}

// ── Planes de mantenimiento ──
export const ESTADOS_PLAN = ['VENCIDO', 'POR_VENCER', 'AL_DIA'] as const;
export type EstadoPlan = (typeof ESTADOS_PLAN)[number];

export const ETIQUETA_ESTADO_PLAN: Record<EstadoPlan, string> = {
  VENCIDO: 'Vencido',
  POR_VENCER: 'Por vencer',
  AL_DIA: 'Al día',
};

export interface PlanMantenimiento {
  id: string;
  equipoId: string;
  nombre: string;
  tareas: string | null;
  periodicidadDias: number;
  /** Los días que se trabaja: 0 domingo … 6 sábado. */
  diasSemana: number[];
  proximaFecha: string;
  activo: boolean;
  estado: EstadoPlan;
  /** Negativo si ya venció. */
  diasParaVencer: number;
}

/** Un plan que vence, con los datos de su equipo para la pantalla del día. */
export interface PlanQueVence extends PlanMantenimiento {
  equipoNombre: string;
  equipoEstado: string;
  ubicacionNombre: string | null;
}

export interface CrearPlanInput {
  nombre: string;
  tareas?: string | null;
  periodicidadDias: number;
  diasSemana?: number[];
  proximaFecha: string;
}

/** Un equipo montado dentro de otro, como se lista en la ficha de la máquina. */
export interface ComponenteEquipo {
  id: string;
  nombre: string;
  estado: EstadoEquipo;
  tipoNombre: string | null;
  clasificacion: ClasificacionEquipo;
  montadoDesde: string | null;
  cantidadComponentes: number;
}

/** Un tramo en que un equipo estuvo montado en una máquina. */
export interface MontajeEquipo {
  id: string;
  equipoPadreId: string;
  equipoPadreNombre: string;
  desde: string;
  /** null mientras sigue montado ahí. */
  hasta: string | null;
  motivo: string | null;
  registradoPorNombre: string | null;
}

/** Un material del pañol que lleva un equipo: un repuesto de su lista. */
export interface RepuestoEquipo {
  id: string;
  equipoId: string;
  materialId: string;
  materialNombre: string;
  /** Símbolo de la unidad, o "" si el material no tiene una cargada. */
  unidad: string;
  /** Cuántos lleva la máquina, o null si no se dijo. */
  cantidad: number | null;
  notas: string | null;
  stockActual: number;
  stockMinimo: number;
  bajoStock: boolean;
  /** false si el material se sacó de circulación en el pañol. */
  materialActivo: boolean;
  /** Dónde está en el depósito: «Estantería A · fila 3», o null. */
  ubicacion: string | null;
  creadoEn: string;
}

/** Un equipo que lleva un material, para la ficha del material. */
export interface EquipoQueUsaMaterial {
  repuestoId: string;
  equipoId: string;
  equipoNombre: string;
  equipoEstado: EstadoEquipo;
  ubicacionNombre: string | null;
  fotoUrl: string | null;
  cantidad: number | null;
  notas: string | null;
}
