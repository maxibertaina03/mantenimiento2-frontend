import { useMisPermisos } from '@/api/permisos';

/**
 * Los permisos, escritos igual que en el servidor.
 *
 * Son una copia, y eso tiene un riesgo: que se desincronicen. Se acepta porque
 * la pantalla necesita saber qué ofrecer ANTES de pedir nada, y porque el costo
 * de equivocarse acá es chico. Si acá sobra un permiso, la pantalla ofrece un
 * botón que el servidor va a rechazar con un mensaje claro. Si falta, esconde
 * algo que el usuario sí podía hacer.
 *
 * Lo que nunca pasa es lo contrario: que esconder un botón acá sea lo único que
 * impide una acción. Quien decide es el servidor, siempre.
 */
export const P = {
  MATERIALES_VER: 'materiales.ver',
  MATERIALES_EDITAR: 'materiales.editar',
  MOVIMIENTOS_VER: 'movimientos.ver',
  MOVIMIENTOS_CREAR: 'movimientos.crear',
  MOVIMIENTOS_EDITAR: 'movimientos.editar',
  CATALOGOS_VER: 'catalogos.ver',
  CATALOGOS_EDITAR: 'catalogos.editar',
  PROVEEDORES_VER: 'proveedores.ver',
  PROVEEDORES_EDITAR: 'proveedores.editar',
  ORDENES_VER: 'ordenes.ver',
  ORDENES_EDITAR: 'ordenes.editar',
  ORDENES_RECIBIR: 'ordenes.recibir',
  ORDENES_ENVIAR: 'ordenes.enviar',
  TRABAJOS_VER: 'trabajos.ver',
  TRABAJOS_EDITAR: 'trabajos.editar',
  TRABAJOS_ELIMINAR: 'trabajos.eliminar',
  TRABAJOS_ASIGNAR: 'trabajos.asignar',
  EQUIPOS_VER: 'equipos.ver',
  EQUIPOS_EDITAR: 'equipos.editar',
  SERVICIOS_VER: 'servicios.ver',
  SERVICIOS_EDITAR: 'servicios.editar',
  IT_VER: 'it.ver',
  IT_EDITAR: 'it.editar',
  CREDENCIALES_VER: 'credenciales.ver',
  CREDENCIALES_REVELAR: 'credenciales.revelar',
  CREDENCIALES_EDITAR: 'credenciales.editar',
  USUARIOS_ADMINISTRAR: 'usuarios.administrar',
  PERMISOS_ADMINISTRAR: 'permisos.administrar',
} as const;

export type Permiso = (typeof P)[keyof typeof P];

/**
 * Si el usuario que está mirando puede hacer estas cosas.
 *
 * Mientras los permisos se están cargando devuelve `false`: es preferible que
 * un botón aparezca un instante después a que aparezca y desaparezca, o peor,
 * que alguien lo apriete y le rebote.
 */
export function usePuede(): (...permisos: Permiso[]) => boolean {
  const { data } = useMisPermisos();
  const tiene = new Set(data?.permisos ?? []);
  return (...permisos: Permiso[]) => permisos.every((p) => tiene.has(p));
}

/** Si ya se sabe qué puede hacer, para no parpadear mientras carga. */
export function usePermisosListos(): boolean {
  const { isSuccess } = useMisPermisos();
  return isSuccess;
}
