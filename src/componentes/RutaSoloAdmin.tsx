import type { ReactNode } from 'react';
import { useUsuarioActual } from '@/api/usuarios';
import { Cargando, EstadoVacio } from './Estados';

/**
 * Envuelve una ruta reservada a administradores.
 *
 * El control real está en el backend (GuardRoles); esto es para que la UI no
 * muestre una pantalla que va a fallar con 403, y para dar un mensaje claro a
 * quien llegue por la URL directa.
 */
export function RutaSoloAdmin({ children }: { children: ReactNode }) {
  const { data: usuario, isLoading } = useUsuarioActual();

  if (isLoading) return <Cargando />;

  if (usuario?.rol !== 'ADMIN') {
    return (
      <EstadoVacio>
        Esta sección es solo para el área de sistemas. Si necesitás acceso, pedíselo a un
        administrador.
      </EstadoVacio>
    );
  }

  return <>{children}</>;
}
