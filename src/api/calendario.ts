import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import { clavesMateriales } from './materiales';
import type {
  Calendario,
  CompletarTareaInput,
  CrearRutinaInput,
  CrearTareaInput,
  Rutina,
  Tarea,
} from '@/tipos/tarea';

export const clavesCalendario = {
  base: ['calendario'] as const,
  mes: (desde: string, hasta: string, asignadoAId?: string) =>
    ['calendario', 'mes', desde, hasta, asignadoAId ?? ''] as const,
  mias: ['calendario', 'mias'] as const,
  rutinas: (todas: boolean) => ['calendario', 'rutinas', todas] as const,
};

/**
 * Dar una tarea por hecha mueve el stock y crea una orden de trabajo, así que
 * se invalida todo lo que depende de eso. Si no, el pañol y el historial de la
 * máquina se siguen mostrando como estaban.
 */
function invalidarTodo(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: clavesCalendario.base });
  void qc.invalidateQueries({ queryKey: clavesMateriales.base });
  void qc.invalidateQueries({ queryKey: ['ordenes-trabajo'] });
  void qc.invalidateQueries({ queryKey: ['equipos'] });
}

export function useCalendario(desde: string, hasta: string, asignadoAId?: string, habilitado = true) {
  return useQuery({
    enabled: habilitado && !!desde && !!hasta,
    queryKey: clavesCalendario.mes(desde, hasta, asignadoAId),
    queryFn: () =>
      apiRequest<Calendario>('/calendario', {
        query: { desde, hasta, asignadoAId: asignadoAId || undefined },
      }),
  });
}

/** Lo que tengo que hacer hoy, y lo que quedó pendiente de antes. */
export function useMisTareas(habilitado = true) {
  return useQuery({
    enabled: habilitado,
    queryKey: clavesCalendario.mias,
    queryFn: () => apiRequest<Tarea[]>('/calendario/mias'),
  });
}

export function useRutinas(todas = false, habilitado = true) {
  return useQuery({
    enabled: habilitado,
    queryKey: clavesCalendario.rutinas(todas),
    queryFn: () => apiRequest<Rutina[]>('/calendario/rutinas', { query: { todas: todas ? 'true' : undefined } }),
  });
}

export function useCrearTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearTareaInput) =>
      apiRequest<Tarea>('/calendario', { method: 'POST', body: input }),
    onSuccess: () => invalidarTodo(qc),
  });
}

export function useAsignarTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, asignadoAId }: { id: string; asignadoAId: string }) =>
      apiRequest<Tarea>(`/calendario/${id}/asignar`, { method: 'POST', body: { asignadoAId } }),
    onSuccess: () => invalidarTodo(qc),
  });
}

export function useCompletarTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...datos }: { id: string } & CompletarTareaInput) =>
      apiRequest<Tarea>(`/calendario/${id}/completar`, { method: 'POST', body: datos }),
    onSuccess: () => invalidarTodo(qc),
  });
}

export function useCancelarTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<Tarea>(`/calendario/${id}/cancelar`, { method: 'POST' }),
    onSuccess: () => invalidarTodo(qc),
  });
}

export function useCrearRutina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearRutinaInput) =>
      apiRequest<Rutina>('/calendario/rutinas', { method: 'POST', body: input }),
    onSuccess: () => invalidarTodo(qc),
  });
}

export function useCambiarRutina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...cambios }: { id: string } & Partial<CrearRutinaInput> & { activa?: boolean }) =>
      apiRequest<Rutina>(`/calendario/rutinas/${id}`, { method: 'PATCH', body: cambios }),
    onSuccess: () => invalidarTodo(qc),
  });
}
