import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import { clavesEquipos } from './equipos';

/**
 * Las otras fotos de un equipo: la chapa característica, el tablero. La
 * principal no está acá: es la `fotoUrl` del equipo.
 */
export interface FotoDeEquipo {
  id: string;
  url: string;
  descripcion: string | null;
  subidoEn: string;
  subidoPor: string | null;
}

/** El mismo tope que aplica el servidor. */
export const MAXIMO_FOTOS_POR_EQUIPO = 12;

export const clavesFotos = {
  de: (equipoId: string) => ['equipos', equipoId, 'fotos'] as const,
};

export function useFotosDeEquipo(equipoId: string) {
  return useQuery({
    queryKey: clavesFotos.de(equipoId),
    queryFn: () => apiRequest<FotoDeEquipo[]>(`/equipos/${equipoId}/fotos`),
    enabled: !!equipoId,
  });
}

export function useSubirFotoDeEquipo(equipoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: { imagenBase64: string; nombreArchivo: string; descripcion?: string }) =>
      apiRequest<FotoDeEquipo>(`/equipos/${equipoId}/fotos`, {
        method: 'POST',
        body: datos,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesFotos.de(equipoId) }),
  });
}

export function useDescribirFoto(equipoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, descripcion }: { id: string; descripcion: string }) =>
      apiRequest<FotoDeEquipo>(`/equipos/${equipoId}/fotos/${id}`, {
        method: 'PATCH',
        body: { descripcion },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesFotos.de(equipoId) }),
  });
}

/** Cambia la principal: se refresca el equipo entero, que la muestra en la lista. */
export function useUsarComoPrincipal(equipoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/equipos/${equipoId}/fotos/${id}/principal`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesEquipos.base }),
  });
}

export function useBorrarFotoDeEquipo(equipoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/equipos/${equipoId}/fotos/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesFotos.de(equipoId) }),
  });
}
