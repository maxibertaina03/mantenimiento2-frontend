import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';
import type {
  ActualizarMaterialInput,
  CrearMaterialInput,
  Material,
  MaterialConHistorial,
} from '@/tipos/material';

export const clavesMateriales = {
  base: ['materiales'] as const,
  lista: (pagina: number, limite: number) => ['materiales', 'lista', pagina, limite] as const,
  bajoStock: ['materiales', 'bajo-stock'] as const,
  detalle: (id: string) => ['materiales', 'detalle', id] as const,
  historial: (id: string) => ['materiales', 'historial', id] as const,
};

export function useMateriales(pagina = 1, limite = 20) {
  return useQuery({
    queryKey: clavesMateriales.lista(pagina, limite),
    queryFn: () =>
      apiRequest<RespuestaPaginada<Material>>('/materiales', { query: { pagina, limite } }),
  });
}

/** Trae TODOS los materiales (recorriendo páginas) para exportar. */
export async function obtenerTodosLosMateriales(): Promise<Material[]> {
  const limite = 100;
  const acumulado: Material[] = [];
  let pagina = 1;
  for (;;) {
    const resp = await apiRequest<RespuestaPaginada<Material>>('/materiales', {
      query: { pagina, limite },
    });
    acumulado.push(...resp.datos);
    if (acumulado.length >= resp.total || resp.datos.length === 0) break;
    pagina += 1;
  }
  return acumulado;
}

export function useMaterialesBajoStock() {
  return useQuery({
    queryKey: clavesMateriales.bajoStock,
    queryFn: () => apiRequest<Material[]>('/materiales/bajo-stock'),
  });
}

export function useMaterial(id: string) {
  return useQuery({
    queryKey: clavesMateriales.detalle(id),
    queryFn: () => apiRequest<Material>(`/materiales/${id}`),
    enabled: !!id,
  });
}

export function useMaterialConHistorial(id: string) {
  return useQuery({
    queryKey: clavesMateriales.historial(id),
    queryFn: () => apiRequest<MaterialConHistorial>(`/materiales/${id}/historial`),
    enabled: !!id,
  });
}

export function useCrearMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearMaterialInput) =>
      apiRequest<Material>('/materiales', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesMateriales.base }),
  });
}

export function useActualizarMaterial(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActualizarMaterialInput) =>
      apiRequest<Material>(`/materiales/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesMateriales.base }),
  });
}

export function useEliminarMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/materiales/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesMateriales.base }),
  });
}
