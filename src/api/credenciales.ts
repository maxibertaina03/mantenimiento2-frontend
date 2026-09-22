import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';

export type TipoCredencial = 'CORREO' | 'ACCESO_REMOTO' | 'EQUIPO' | 'SERVICIO' | 'RED' | 'OTRO';
export type EstadoRotacion = 'sin-rotacion' | 'al-dia' | 'por-vencer' | 'vencida';

export const TIPOS_CREDENCIAL: { valor: TipoCredencial; etiqueta: string }[] = [
  { valor: 'CORREO', etiqueta: 'Casilla de correo' },
  { valor: 'ACCESO_REMOTO', etiqueta: 'Acceso remoto' },
  { valor: 'EQUIPO', etiqueta: 'Equipo' },
  { valor: 'RED', etiqueta: 'Red' },
  { valor: 'SERVICIO', etiqueta: 'Servicio' },
  { valor: 'OTRO', etiqueta: 'Otro' },
];

/**
 * Una credencial tal como llega del servidor.
 *
 * No tiene la contraseña, y no es un olvido: el servidor no la manda en ningún
 * listado. Para verla hay que pedirla, y ese pedido queda registrado.
 */
export interface Credencial {
  id: string;
  nombre: string;
  tipo: TipoCredencial;
  usuario: string | null;
  url: string | null;
  notas: string | null;
  equipoItId: string | null;
  equipoItNombre: string | null;
  rotarCadaDias: number | null;
  rotadaEn: string;
  proximaRotacion: string | null;
  estadoRotacion: EstadoRotacion;
  rotaciones: number;
  vistas: number;
  activo: boolean;
  creadoEn: string;
}

export interface SecretoRevelado {
  id: string;
  nombre: string;
  usuario: string | null;
  secreto: string;
  vistaEn: string;
}

export interface HistorialCredencial {
  rotaciones: { id: string; rotadaEn: string; rotadaPor: string | null; motivo: string | null }[];
  vistas: { id: string; vistaEn: string; usuario: string }[];
}

export interface FiltrosCredenciales {
  buscar?: string;
  tipo?: TipoCredencial | '';
  equipoItId?: string;
  rotacion?: 'vencida' | 'por-vencer' | 'pendiente' | '';
  mostrar?: 'activas' | 'todas';
}

export const clavesCredenciales = {
  base: ['credenciales'] as const,
  lista: (pagina: number, filtros: FiltrosCredenciales) =>
    ['credenciales', 'lista', pagina, filtros] as const,
  historial: (id: string) => ['credenciales', 'historial', id] as const,
};

/**
 * `habilitado` existe porque un hook no se puede llamar condicionalmente: sin
 * esto, una pantalla que no tiene permiso para ver credenciales igual saldría a
 * pedirlas y se comería un 403 que se muestra como un error rojo.
 */
export function useCredenciales(
  pagina = 1,
  limite = 20,
  filtros: FiltrosCredenciales = {},
  habilitado = true,
) {
  return useQuery({
    enabled: habilitado,
    queryKey: clavesCredenciales.lista(pagina, filtros),
    queryFn: () =>
      apiRequest<RespuestaPaginada<Credencial>>('/credenciales', {
        query: {
          pagina,
          limite,
          buscar: filtros.buscar || undefined,
          tipo: filtros.tipo || undefined,
          equipoItId: filtros.equipoItId || undefined,
          rotacion: filtros.rotacion || undefined,
          mostrar: filtros.mostrar || undefined,
        },
      }),
  });
}

export function useHistorialCredencial(id: string, habilitado = true) {
  return useQuery({
    queryKey: clavesCredenciales.historial(id),
    queryFn: () => apiRequest<HistorialCredencial>(`/credenciales/${id}/historial`),
    enabled: !!id && habilitado,
  });
}

export function useCrearCredencial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiRequest<Credencial>('/credenciales', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesCredenciales.base }),
  });
}

export function useActualizarCredencial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      apiRequest<Credencial>(`/credenciales/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesCredenciales.base }),
  });
}

/**
 * Pide la contraseña.
 *
 * Es una mutación y no una consulta a propósito. React Query guarda en memoria
 * el resultado de las consultas y las vuelve a pedir solas al volver a la
 * pestaña: la contraseña quedaría cacheada y el registro de quién la vio se
 * llenaría de vistas que nadie pidió. Como mutación, se pide una vez, cuando
 * alguien aprieta el botón.
 */
export function useRevelarCredencial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<SecretoRevelado>(`/credenciales/${id}/revelar`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesCredenciales.base }),
  });
}

export function useRotarCredencial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, secreto, motivo }: { id: string; secreto: string; motivo?: string }) =>
      apiRequest<Credencial>(`/credenciales/${id}/rotar`, {
        method: 'POST',
        body: { secreto, motivo },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesCredenciales.base }),
  });
}

export function useEliminarCredencial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/credenciales/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesCredenciales.base }),
  });
}
