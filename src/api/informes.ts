import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type {
  InformeCompras,
  InformeMio,
  InformePanol,
  InformePersonal,
  InformeTrabajos,
  PeriodoInforme,
} from '@/tipos/informe';

export const clavesInformes = {
  base: ['informes'] as const,
  de: (que: string, periodo: PeriodoInforme) => ['informes', que, periodo] as const,
};

/**
 * Un informe del período. Mientras llega el del período nuevo se sigue viendo
 * el anterior: los gráficos no parpadean en blanco cada vez que se cambia la
 * fecha.
 */
function useInforme<T>(que: string, periodo: PeriodoInforme, habilitado: boolean) {
  return useQuery({
    enabled: habilitado,
    queryKey: clavesInformes.de(que, periodo),
    queryFn: () =>
      apiRequest<T>(`/informes/${que}`, {
        query: { desde: periodo.desde, hasta: periodo.hasta, agrupar: periodo.agrupar },
      }),
    placeholderData: keepPreviousData,
  });
}

export const useInformeTrabajos = (periodo: PeriodoInforme, habilitado = true) =>
  useInforme<InformeTrabajos>('trabajos', periodo, habilitado);

export const useInformeCompras = (periodo: PeriodoInforme, habilitado = true) =>
  useInforme<InformeCompras>('compras', periodo, habilitado);

export const useInformePersonal = (periodo: PeriodoInforme, habilitado = true) =>
  useInforme<InformePersonal>('personal', periodo, habilitado);

export const useInformePanol = (periodo: PeriodoInforme, habilitado = true) =>
  useInforme<InformePanol>('panol', periodo, habilitado);

/** Lo de quien está usando el sistema. No pide permiso: cada uno ve lo suyo. */
export const useInformeMio = (periodo: PeriodoInforme, habilitado = true) =>
  useInforme<InformeMio>('mios', periodo, habilitado);
