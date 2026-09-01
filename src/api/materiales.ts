import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';
import type {
  ActualizarMaterialInput,
  CrearMaterialInput,
  Material,
  MaterialConHistorial,
} from '@/tipos/material';

/** Filtros del listado. Todo opcional: sin nada, trae el catálogo entero. */
export interface FiltrosMateriales {
  buscar?: string;
  categoriaId?: string;
  unidadId?: string;
  /** Al menos este stock. */
  stockMin?: number;
  /** Como mucho este stock. */
  stockMax?: number;
  /** Solo los que están en (o por debajo de) su stock mínimo. */
  bajoStock?: boolean;
  /** Solo los que todavía no tienen unidad cargada. */
  sinUnidad?: boolean;
  ordenarPor?: 'nombre' | 'stock' | 'categoria' | 'unidad';
  direccion?: 'asc' | 'desc';
}

export const clavesMateriales = {
  base: ['materiales'] as const,
  lista: (pagina: number, limite: number, filtros: FiltrosMateriales) =>
    ['materiales', 'lista', pagina, limite, filtros] as const,
  bajoStock: ['materiales', 'bajo-stock'] as const,
  detalle: (id: string) => ['materiales', 'detalle', id] as const,
  historial: (id: string) => ['materiales', 'historial', id] as const,
};

export function useMateriales(pagina = 1, limite = 20, filtros: FiltrosMateriales | string = {}) {
  // Acepta un string por comodidad de quien solo busca por nombre (el combo).
  const f: FiltrosMateriales = typeof filtros === 'string' ? { buscar: filtros } : filtros;

  return useQuery({
    queryKey: clavesMateriales.lista(pagina, limite, f),
    queryFn: () =>
      apiRequest<RespuestaPaginada<Material>>('/materiales', {
        query: {
          pagina,
          limite,
          buscar: f.buscar || undefined,
          categoriaId: f.categoriaId || undefined,
          unidadId: f.unidadId || undefined,
          // `?? undefined` y no `||`: con `||` un 0 se descartaría, y "stock
          // exactamente 0" es justo el filtro más útil para ver qué falta.
          stockMin: f.stockMin ?? undefined,
          stockMax: f.stockMax ?? undefined,
          bajoStock: f.bajoStock ? 'true' : undefined,
          sinUnidad: f.sinUnidad ? 'true' : undefined,
          ordenarPor: f.ordenarPor || undefined,
          direccion: f.direccion || undefined,
        },
      }),
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

/** Cuántos materiales todavía no tienen unidad cargada. */
export function useMaterialesSinUnidad() {
  return useQuery({
    queryKey: ['materiales', 'sin-unidad'],
    queryFn: () => apiRequest<{ sinUnidad: number }>('/materiales/sin-unidad'),
    staleTime: 30_000,
  });
}

/**
 * Pone una unidad por defecto a los materiales que no tienen.
 *
 * Los materiales importados de los listados viejos vinieron sin unidad;
 * asignarlas de a una no es viable. Por defecto NO pisa las que ya están
 * cargadas, para no borrar lo corregido a mano.
 */
export function useAsignarUnidadMasiva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: { unidadId: string; soloSinUnidad?: boolean }) =>
      apiRequest<{ actualizados: number; sinUnidad: number }>(
        '/materiales/asignar-unidad-masiva',
        { method: 'POST', body: datos },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materiales'] });
      qc.invalidateQueries({ queryKey: ['unidades-medida'] });
    },
  });
}
