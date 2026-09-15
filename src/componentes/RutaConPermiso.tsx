import type { ReactNode } from 'react';
import { useMisPermisos } from '@/api/permisos';
import { type Permiso } from '@/lib/permisos';
import { Cargando, EstadoVacio } from './Estados';

/**
 * Envuelve una ruta que necesita permisos.
 *
 * El control real está en el servidor, que rechaza lo que no corresponde. Esto
 * es para que nadie llegue a una pantalla que va a devolver 403 en cada
 * consulta, y para que quien entre por la dirección directa lea por qué no
 * puede en vez de ver una pantalla rota.
 */
export function RutaConPermiso({
  permisos,
  children,
}: {
  permisos: Permiso[];
  children: ReactNode;
}) {
  const { data, isLoading } = useMisPermisos();

  if (isLoading) return <Cargando />;

  const tiene = new Set(data?.permisos ?? []);
  if (!permisos.every((p) => tiene.has(p))) {
    return (
      <EstadoVacio>
        Tu rol no tiene acceso a esta sección. Si la necesitás para trabajar, pedísela al
        administrador: se habilita marcando una casilla.
      </EstadoVacio>
    );
  }

  return <>{children}</>;
}
