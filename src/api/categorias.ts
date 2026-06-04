import { useQuery } from '@tanstack/react-query';
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
