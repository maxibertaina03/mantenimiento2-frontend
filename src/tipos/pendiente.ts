/**
 * Un pendiente del anotador de mantenimiento: lo que quedó por hacer
 * («comprar tal cosa», «mandar a reparar tal otra»), a la vista de todos.
 */
export interface Pendiente {
  id: string;
  texto: string;
  urgente: boolean;
  asignadoAId: string | null;
  asignadoANombre: string | null;
  equipoId: string | null;
  equipoNombre: string | null;
  creadoPorId: string | null;
  creadoPorNombre: string | null;
  creadoEn: string;
  /** Vacío: sigue pendiente. */
  hechaEn: string | null;
  hechaPorNombre: string | null;
  /** Si era sobre una máquina, la orden de trabajo que se registró al hacerlo. */
  ordenTrabajoId: string | null;
  ordenTrabajoNumero: string | null;
}

export interface DatosPendiente {
  texto: string;
  urgente?: boolean;
  asignadoAId?: string | null;
  equipoId?: string | null;
}
