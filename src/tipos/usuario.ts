export type RolUsuario = 'ADMIN' | 'OPERARIO';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  idExterno: string | null;
  rol: RolUsuario;
  creadoEn: string;
  actualizadoEn: string;
}
