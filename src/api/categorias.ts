import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { Categoria } from '@/tipos/categoria';

const claves = {
  todas: ['categorias'] as const,
};

export function useCategorias() {
  return useQuery({
    queryKey: claves.todas,
    queryFn: () => apiRequest<Categoria[]>('/categorias-material'),
  });
}

export function useCrearCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nombre: string) =>
      apiRequest<Categoria>('/categorias-material', { method: 'POST', body: { nombre } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.todas }),
  });
}

export function useActualizarCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...datos }: { id: string; nombre?: string; descripcion?: string }) =>
      apiRequest<Categoria>(`/categorias-material/${id}`, { method: 'PATCH', body: datos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claves.todas });
      // El nombre de la categoría se muestra en el listado de materiales.
      qc.invalidateQueries({ queryKey: ['materiales'] });
    },
  });
}

export function useEliminarCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/categorias-material/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.todas }),
  });
}
