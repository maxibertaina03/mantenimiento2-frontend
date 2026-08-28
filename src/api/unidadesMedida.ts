import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { CrearUnidadInput, UnidadMedida } from '@/tipos/unidadMedida';

const claves = {
  todas: ['unidades-medida'] as const,
};

/**
 * @param soloActivas para el desplegable del formulario: las unidades dadas de
 * baja no se ofrecen al cargar, pero siguen existiendo para los materiales que
 * ya las usan.
 */
export function useUnidadesMedida(soloActivas = false) {
  return useQuery({
    queryKey: [...claves.todas, { soloActivas }],
    queryFn: () =>
      apiRequest<UnidadMedida[]>(`/unidades-medida${soloActivas ? '?soloActivas=true' : ''}`),
    staleTime: 60_000,
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: claves.todas });
  // El símbolo de la unidad se muestra al lado del stock de cada material.
  qc.invalidateQueries({ queryKey: ['materiales'] });
}

export function useCrearUnidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: CrearUnidadInput) =>
      apiRequest<UnidadMedida>('/unidades-medida', { method: 'POST', body: datos }),
    onSuccess: () => invalidar(qc),
  });
}

export function useActualizarUnidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...datos }: { id: string } & Partial<CrearUnidadInput>) =>
      apiRequest<UnidadMedida>(`/unidades-medida/${id}`, { method: 'PATCH', body: datos }),
    onSuccess: () => invalidar(qc),
  });
}

export function useEliminarUnidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/unidades-medida/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidar(qc),
  });
}
