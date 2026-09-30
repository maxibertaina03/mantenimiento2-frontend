import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';

/**
 * El manual en PDF de un equipo o una herramienta.
 *
 * Como los comprobantes, no trae la dirección del archivo: para abrirlo se
 * pide un enlace aparte, que vence a los cinco minutos.
 */
export interface Manual {
  id: string;
  nombre: string;
  tamanoBytes: number;
  subidoEn: string;
  subidoPor: string | null;
}

/** El mismo tope que aplica el servidor: 25 MB por PDF. */
export const MAXIMO_BYTES_MANUAL = 25 * 1024 * 1024;

export const clavesManuales = {
  de: (equipoId: string) => ['equipos', equipoId, 'manuales'] as const,
};

export function useManuales(equipoId: string) {
  return useQuery({
    queryKey: clavesManuales.de(equipoId),
    queryFn: () =>
      apiRequest<{ disponible: boolean; manuales: Manual[] }>(`/equipos/${equipoId}/manuales`),
    enabled: !!equipoId,
  });
}

/**
 * Pide el enlace para abrir un manual. Mutación y no consulta: el enlace
 * vence, y reusarlo desde la memoria daría un error que no explica nada.
 */
export function useEnlaceManual() {
  return useMutation({
    mutationFn: ({ equipoId, id }: { equipoId: string; id: string }) =>
      apiRequest<{ url: string; vence: string }>(`/equipos/${equipoId}/manuales/${id}/enlace`),
  });
}

/** Sube el PDF como archivo, no dentro de un JSON: un manual pesa varios megas. */
export function useSubirManual(equipoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (archivo: File) => {
      const datos = new FormData();
      datos.append('archivo', archivo);
      // El nombre va aparte, como texto, para que los acentos lleguen bien.
      datos.append('nombre', archivo.name);
      return apiRequest<Manual>(`/equipos/${equipoId}/manuales`, { method: 'POST', body: datos });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesManuales.de(equipoId) }),
  });
}

export function useBorrarManual(equipoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/equipos/${equipoId}/manuales/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesManuales.de(equipoId) }),
  });
}
