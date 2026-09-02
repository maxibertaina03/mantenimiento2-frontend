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

export const CRITICIDADES = ['ALTA', 'MEDIA', 'BAJA'] as const;
export type Criticidad = (typeof CRITICIDADES)[number];

export const ETIQUETA_CRITICIDAD: Record<Criticidad, string> = {
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
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
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  ubicacionId: string | null;
  ubicacionNombre: string | null;
  tipoId: string | null;
  tipoNombre: string | null;
  estado: EstadoEquipo;
  criticidad: Criticidad;
  fotoUrl: string | null;
  proveedorId: string | null;
  proveedorNombre: string | null;
  horasUso: number | null;
  fechaAlta: string | null;
  garantiaHasta: string | null;
  /** Derivado en el servidor: no está guardado en la base. */
  garantiaVencida: boolean;
}

export interface CrearEquipoInput {
  nombre: string;
  codigoInterno?: string | null;
  descripcion?: string | null;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  ubicacionId?: string | null;
  tipoId?: string | null;
  proveedorId?: string | null;
  criticidad?: Criticidad;
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
  estado?: EstadoEquipo;
  criticidad?: Criticidad;
  garantiaVencida?: boolean;
  ordenarPor?: 'nombre' | 'codigo' | 'ubicacion' | 'criticidad';
  direccion?: 'asc' | 'desc';
}

// ── Importación desde la carpeta de fotos ──
export type Advertencia = 'posible_equipo_it' | 'posible_duplicado' | 'nombre_automatico';

export interface EquipoDetectado {
  nombre: string;
  ubicacion: string;
  ruta: string;
  advertencias: Advertencia[];
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
