/**
 * El calendario: lo que hay que hacer, con fecha y con dueño.
 *
 * Reflejo del dominio del backend. Se repite acá y no se comparte porque son
 * dos proyectos que se despliegan por separado.
 */
export const ESTADOS_TAREA = ['PENDIENTE', 'HECHA', 'CANCELADA'] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

export const ETIQUETA_ESTADO_TAREA: Record<EstadoTarea, string> = {
  PENDIENTE: 'Pendiente',
  HECHA: 'Hecha',
  CANCELADA: 'Cancelada',
};

export interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  /** El día en que hay que hacerla, en ISO. */
  fecha: string;
  estado: EstadoTarea;
  asignadoAId: string | null;
  asignadoANombre: string | null;
  equipoId: string | null;
  equipoNombre: string | null;
  /** O el equipo de informática. Uno de los dos, nunca los dos. */
  equipoItId: string | null;
  equipoItNombre: string | null;
  planId: string | null;
  planNombre: string | null;
  rutinaId: string | null;
  rutinaTitulo: string | null;
  ordenTrabajoId: string | null;
  ordenTrabajoNumero: string | null;
  creadaPorId: string | null;
  creadoEn: string;
}

export interface Calendario {
  desde: string;
  hasta: string;
  tareas: Tarea[];
}

export interface Rutina {
  id: string;
  titulo: string;
  descripcion: string | null;
  cadaDias: number;
  desde: string;
  hasta: string | null;
  equipoId: string | null;
  equipoNombre: string | null;
  /** O el equipo de informática. Uno de los dos, nunca los dos. */
  equipoItId: string | null;
  equipoItNombre: string | null;
  asignadoAId: string | null;
  asignadoANombre: string | null;
  activa: boolean;
  creadoEn: string;
}

export interface CrearTareaInput {
  titulo: string;
  descripcion?: string | null;
  fecha: string;
  asignadoAId?: string | null;
  equipoId?: string | null;
  equipoItId?: string | null;
}

export interface CrearRutinaInput {
  titulo: string;
  descripcion?: string | null;
  cadaDias: number;
  desde: string;
  hasta?: string | null;
  equipoId?: string | null;
  equipoItId?: string | null;
  asignadoAId?: string | null;
}

export interface CompletarTareaInput {
  resolucion: string;
  materiales?: { materialId: string; cantidad: number }[];
  costoManoObra?: number | null;
  horasParada?: number | null;
}

/** Cada cuánto se repite, en palabras. */
export function comoSeRepite(cadaDias: number): string {
  if (cadaDias === 1) return 'Todos los días';
  if (cadaDias === 7) return 'Todas las semanas';
  if (cadaDias === 15) return 'Cada quince días';
  if (cadaDias === 30) return 'Todos los meses';
  return `Cada ${cadaDias} días`;
}
