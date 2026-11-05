import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import { clavesMateriales } from './materiales';
import type {
  Calendario,
  CompletarTareaInput,
  CrearRutinaInput,
  CrearTareaInput,
  Rutina,
  AlcanceTablero,
  Tablero,
  Tarea,
} from '@/tipos/tarea';

export const clavesCalendario = {
  base: ['calendario'] as const,
  mes: (desde: string, hasta: string, asignadoAId?: string) =>
    ['calendario', 'mes', desde, hasta, asignadoAId ?? ''] as const,
  mias: ['calendario', 'mias'] as const,
  rutinas: (todas: boolean) => ['calendario', 'rutinas', todas] as const,
  tablero: (alcance: AlcanceTablero) => ['calendario', 'tablero', alcance] as const,
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

/**
 * Lo que tengo que hacer hoy, y lo que quedó pendiente de antes: lo mío y lo
 * que no es de nadie, que lo puede hacer cualquiera de mantenimiento.
 */
export function useMisTareas(habilitado = true) {
  return useQuery({
    enabled: habilitado,
    queryKey: clavesCalendario.mias,
    queryFn: () => apiRequest<Tarea[]>('/calendario/mias'),
  });
}

/**
 * El tablero: pendiente, en proceso y listo. Se refresca solo cada 20 s, así
 * todos ven lo mismo sin recargar: lo que tomó un compañero aparece en proceso.
 */
export function useTablero(alcance: AlcanceTablero) {
  return useQuery({
    queryKey: clavesCalendario.tablero(alcance),
    queryFn: () => apiRequest<Tablero>('/calendario/tablero', { query: { alcance } }),
    refetchInterval: 20_000,
  });
}

/**
 * Tomar o soltar una tarea en el tablero. La tarjeta se mueve en el acto; si
 * el servidor dice que no (la tomó otro, ya no es tuya), vuelve a su lugar.
 */
function useMoverEnTablero(accion: 'tomar' | 'soltar') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tarea: Tarea) =>
      apiRequest<Tarea>(`/calendario/${tarea.id}/${accion}`, { method: 'POST' }),
    onMutate: async (tarea: Tarea) => {
      const clave = ['calendario', 'tablero'];
      await qc.cancelQueries({ queryKey: clave });
      const antes = qc.getQueriesData<Tablero>({ queryKey: clave });
      qc.setQueriesData<Tablero>({ queryKey: clave }, (tablero) => {
        if (!tablero) return tablero;
        const sinElla = (lista: Tarea[]) => lista.filter((t) => t.id !== tarea.id);
        const movida: Tarea = {
          ...tarea,
          estado: accion === 'tomar' ? 'EN_PROCESO' : 'PENDIENTE',
          enProcesoDesde: accion === 'tomar' ? new Date().toISOString() : null,
        };
        return {
          ...tablero,
          pendientes:
            accion === 'soltar' ? [...sinElla(tablero.pendientes), movida] : sinElla(tablero.pendientes),
          enProceso:
            accion === 'tomar' ? [...sinElla(tablero.enProceso), movida] : sinElla(tablero.enProceso),
        };
      });
      return { antes };
    },
    onError: (_e, _t, contexto) => {
      for (const [clave, datos] of contexto?.antes ?? []) qc.setQueryData(clave, datos);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: clavesCalendario.base }),
  });
}

export const useTomarTarea = () => useMoverEnTablero('tomar');
export const useSoltarTarea = () => useMoverEnTablero('soltar');

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

/**
 * Dar por hechas varias juntas, «sin novedad»: las de todos los días. Cada una
 * genera su orden de trabajo; las que no se pueden vuelven en `errores`.
 */
export function useCompletarSinNovedad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tareaIds: string[]) =>
      apiRequest<{ hechas: number; errores: { tareaId: string; titulo: string; motivo: string }[] }>(
        '/calendario/hechas-sin-novedad',
        { method: 'POST', body: { tareaIds } },
      ),
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

/**
 * La tarea del calendario del service vigente de un plan (la crea si hace
 * falta). Dar un service por hecho es completar esta tarea: así el calendario,
 * la orden de trabajo y la próxima fecha del plan cuentan lo mismo.
 */
export function useTareaDelPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      apiRequest<Tarea>(`/calendario/planes/${planId}/tarea`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clavesCalendario.base }),
  });
}

/** Postergar: el plan se mueve con la tarea, así que se refresca todo. */
export function usePostergarTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fecha, motivo }: { id: string; fecha: string; motivo: string }) =>
      apiRequest<Tarea>(`/calendario/${id}/postergar`, { method: 'POST', body: { fecha, motivo } }),
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
