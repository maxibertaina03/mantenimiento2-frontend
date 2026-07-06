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
