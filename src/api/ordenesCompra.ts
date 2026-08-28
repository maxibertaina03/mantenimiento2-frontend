import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import { clavesMateriales } from './materiales';
import type { RespuestaPaginada } from '@/tipos/comunes';
import type {
  ActualizarOrdenInput,
  CrearOrdenInput,
  EstadoOrdenCompra,
  OrdenCompra,
  RecibirOrdenInput,
} from '@/tipos/ordenCompra';

export const clavesOrdenes = {
  base: ['ordenes-compra'] as const,
  lista: (pagina: number, limite: number, buscar: string, estado: string) =>
    ['ordenes-compra', 'lista', pagina, limite, buscar, estado] as const,
  detalle: (id: string) => ['ordenes-compra', 'detalle', id] as const,
};

export function useOrdenes(pagina = 1, limite = 20, buscar = '', estado: EstadoOrdenCompra | '' = '') {
  return useQuery({
    queryKey: clavesOrdenes.lista(pagina, limite, buscar, estado),
    queryFn: () =>
      apiRequest<RespuestaPaginada<OrdenCompra>>('/ordenes-compra', {
        query: { pagina, limite, buscar: buscar || undefined, estado: estado || undefined },
      }),
  });
}

export function useOrden(id: string) {
  return useQuery({
    queryKey: clavesOrdenes.detalle(id),
    queryFn: () => apiRequest<OrdenCompra>(`/ordenes-compra/${id}`),
    enabled: !!id,
  });
}

export function useCrearOrden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearOrdenInput) =>
      apiRequest<OrdenCompra>('/ordenes-compra', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesOrdenes.base }),
  });
}

export function useActualizarOrden(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActualizarOrdenInput) =>
      apiRequest<OrdenCompra>(`/ordenes-compra/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesOrdenes.base }),
  });
}

/**
 * Emite una orden recibiendo el id al momento de llamarla.
 * Hace falta en el alta: ahí el id recién existe después de crear la orden.
 */
export function useEmitirOrdenPorId() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<OrdenCompra>(`/ordenes-compra/${id}/emitir`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesOrdenes.base }),
  });
}

export function useEmitirOrden(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<OrdenCompra>(`/ordenes-compra/${id}/emitir`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesOrdenes.base }),
  });
}

export function useRecibirOrden(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecibirOrdenInput) =>
      apiRequest<OrdenCompra>(`/ordenes-compra/${id}/recibir`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clavesOrdenes.base });
      // La recepción genera movimientos y cambia el stock: hay que refrescar
      // materiales y movimientos, no solo las órdenes.
      qc.invalidateQueries({ queryKey: clavesMateriales.base });
      qc.invalidateQueries({ queryKey: ['movimientos'] });
    },
  });
}

export function useAnularOrden(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<OrdenCompra>(`/ordenes-compra/${id}/anular`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesOrdenes.base }),
  });
}

export function useEliminarOrden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/ordenes-compra/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesOrdenes.base }),
  });
}

export interface ResultadoEnvio {
  para: string[];
  copia: string[];
  responderA: string | null;
}

/**
 * Envía la orden por correo desde el servidor, con el PDF adjunto.
 *
 * Solo viaja el PDF: los destinatarios y el texto los arma el backend con los
 * datos de la orden. Si el servidor no tiene el correo configurado responde
 * 503 y la pantalla ofrece el envío manual.
 */
export function useEnviarOrdenPorCorreo() {
  return useMutation({
    mutationFn: ({ id, pdfBase64 }: { id: string; pdfBase64: string }) =>
      apiRequest<ResultadoEnvio>(`/ordenes-compra/${id}/enviar-correo`, {
        method: 'POST',
        body: { pdfBase64 },
      }),
  });
}
