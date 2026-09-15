import type { Rol } from '@/api/permisos';

/**
 * El rol sale de la lista compartida con la pantalla de permisos.
 *
 * Antes esto era `'ADMIN' | 'OPERARIO'` escrito a mano, y por eso el
 * desplegable de Usuarios seguía ofreciendo dos roles cuando ya había cuatro:
 * el servidor rechazaba "OPERARIO" y no se entendía por qué.
 */
export type RolUsuario = Rol;

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  idExterno: string | null;
  rol: RolUsuario;
  creadoEn: string;
  actualizadoEn: string;
}
