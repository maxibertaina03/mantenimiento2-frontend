import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';
import type {
  ActualizarProveedorInput,
  CrearProveedorInput,
  Proveedor,
} from '@/tipos/proveedor';

const claves = {
  base: ['proveedores'] as const,
  lista: (pagina: number, limite: number) => ['proveedores', 'lista', pagina, limite] as const,
};

export function useProveedores(pagina = 1, limite = 100) {
  return useQuery({
    queryKey: claves.lista(pagina, limite),
    queryFn: () =>
      apiRequest<RespuestaPaginada<Proveedor>>('/proveedores', { query: { pagina, limite } }),
  });
}

export function useCrearProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearProveedorInput) =>
      apiRequest<Proveedor>('/proveedores', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.base }),
  });
}

export function useActualizarProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ActualizarProveedorInput }) =>
      apiRequest<Proveedor>(`/proveedores/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.base }),
  });
}

export function useEliminarProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/proveedores/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.base }),
  });
}
