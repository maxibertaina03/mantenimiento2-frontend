import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';

export type TipoComprobante = 'REMITO' | 'FACTURA' | 'OTRO';

export const TIPOS_COMPROBANTE: { valor: TipoComprobante; etiqueta: string }[] = [
  { valor: 'REMITO', etiqueta: 'Remito' },
  { valor: 'FACTURA', etiqueta: 'Factura' },
  { valor: 'OTRO', etiqueta: 'Otro' },
];

/**
 * Un comprobante adjunto.
 *
 * No trae la dirección del archivo, y no es un olvido: con la ruta cualquiera
 * podría armarse un enlace por fuera del sistema y saltearse el vencimiento.
 * Para ver el archivo se pide un enlace aparte, que dura cinco minutos.
 */
export interface Comprobante {
  id: string;
  tipo: TipoComprobante;
  nombre: string;
  contentType: string;
  tamanoBytes: number;
  esImagen: boolean;
  subidoEn: string;
  subidoPor: string | null;
}

export const clavesComprobantes = {
  de: (ordenId: string) => ['ordenes-compra', ordenId, 'comprobantes'] as const,
};

export function useComprobantes(ordenId: string, habilitado = true) {
  return useQuery({
    queryKey: clavesComprobantes.de(ordenId),
    queryFn: () => apiRequest<Comprobante[]>(`/ordenes-compra/${ordenId}/comprobantes`),
    enabled: !!ordenId && habilitado,
  });
}

/**
 * Pide el enlace para abrir un archivo.
 *
 * Es una mutación y no una consulta a propósito. El enlace vence a los cinco
 * minutos: si React Query lo guardara en memoria y lo reusara, el segundo
 * intento de abrirlo daría un error del almacén que no explica nada.
 */
export function useEnlaceComprobante() {
  return useMutation({
    mutationFn: ({ ordenId, id }: { ordenId: string; id: string }) =>
      apiRequest<{ url: string; vence: string }>(
        `/ordenes-compra/${ordenId}/comprobantes/${id}/enlace`,
      ),
  });
}

export function useAdjuntarComprobante(ordenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: {
      archivoBase64: string;
      nombreArchivo: string;
      tipo: TipoComprobante;
    }) =>
      apiRequest<Comprobante>(`/ordenes-compra/${ordenId}/comprobantes`, {
        method: 'POST',
        body: datos,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesComprobantes.de(ordenId) }),
  });
}

export function useBorrarComprobante(ordenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/ordenes-compra/${ordenId}/comprobantes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesComprobantes.de(ordenId) }),
  });
}
