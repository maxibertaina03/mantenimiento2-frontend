/**
 * Las solicitudes de trabajo: lo que un sector le avisa a mantenimiento.
 *
 * Reflejo del dominio del backend (`dominio/solicitud.ts`).
 */
export const ESTADOS_SOLICITUD = ['NUEVA', 'EN_CURSO', 'RESUELTA', 'RECHAZADA'] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const URGENCIAS = ['BAJA', 'NORMAL', 'URGENTE'] as const;
export type Urgencia = (typeof URGENCIAS)[number];

export const ETIQUETA_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  NUEVA: 'Nueva',
  EN_CURSO: 'En curso',
  RESUELTA: 'Resuelta',
  RECHAZADA: 'Rechazada',
};

export const CLASE_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  NUEVA: 'badge badge-aviso',
  EN_CURSO: 'badge badge-entrada',
  RESUELTA: 'badge badge-ok',
  RECHAZADA: 'badge badge-error',
};

export const ETIQUETA_URGENCIA: Record<Urgencia, string> = {
  BAJA: 'Baja',
  NORMAL: 'Normal',
  URGENTE: 'Urgente / máquina parada',
};

/** Hasta cuántas fotos lleva una solicitud. */
export const MAX_FOTOS_SOLICITUD = 3;

export interface Solicitud {
  id: string;
  numero: string;
  descripcion: string;
  sectorId: string;
  sectorNombre: string;
  equipoId: string | null;
  equipoNombre: string | null;
  urgencia: Urgencia;
  estado: EstadoSolicitud;
  solicitadaPorId: string | null;
  solicitadaPorNombre: string | null;
  creadoEn: string;
  revisadaPorId: string | null;
  revisadaPorNombre: string | null;
  revisadaEn: string | null;
  motivoRechazo: string | null;
  notaResolucion: string | null;
  resueltaEn: string | null;
  ordenTrabajoId: string | null;
  ordenTrabajoNumero: string | null;
  ordenTrabajoAsignadoANombre: string | null;
  fotos: { id: string; nombre: string }[];
}

export interface OpcionesSolicitud {
  sectores: { id: string; nombre: string; equipos: { id: string; nombre: string }[] }[];
  /** El sector del usuario, para que venga elegido. */
  miSectorId: string | null;
}

export interface NuevaSolicitudInput {
  descripcion: string;
  sectorId: string;
  equipoId?: string;
  urgencia: Urgencia;
  fotos: { imagenBase64: string; nombreArchivo: string }[];
}

export interface FiltrosSolicitudes {
  estado?: EstadoSolicitud;
  sectorId?: string;
  urgencia?: Urgencia;
}
