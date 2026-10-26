import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { DetalleDeSector, SectorConActividad } from '@/tipos/sector';

export const clavesSectores = {
  base: ['sectores'] as const,
  detalle: (id: string) => ['sectores', id] as const,
};

/** Los sectores de la planta con su actividad. */
export function useSectores(habilitado = true) {
  return useQuery({
    enabled: habilitado,
    queryKey: clavesSectores.base,
    queryFn: () => apiRequest<SectorConActividad[]>('/sectores'),
  });
}

/** Un sector: sus máquinas y los totales del sector y de sus máquinas. */
export function useSector(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: clavesSectores.detalle(id),
    queryFn: () => apiRequest<DetalleDeSector>(`/sectores/${id}`),
  });
}
