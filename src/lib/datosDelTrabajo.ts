import type { Ejecutor } from '@/tipos/ordenTrabajo';

/** Quién hizo un trabajo y cuánto costó: lo que va en «+ Más datos». */
export interface DatosDelTrabajo {
  ejecutor: Ejecutor;
  proveedorId: string;
  costo: number | undefined;
  horas: number | undefined;
}

export const DATOS_DEL_TRABAJO_VACIOS: DatosDelTrabajo = {
  ejecutor: 'INTERNO',
  proveedorId: '',
  costo: undefined,
  horas: undefined,
};

/** Un trabajo externo tiene que decir qué proveedor lo hizo. */
export function faltaElProveedor(datos: DatosDelTrabajo): boolean {
  return datos.ejecutor === 'EXTERNO' && datos.proveedorId === '';
}

/** Lo que se le manda al servidor: el proveedor solo si fue externo. */
export function paraEnviar(datos: DatosDelTrabajo) {
  return {
    ejecutor: datos.ejecutor,
    proveedorId: datos.ejecutor === 'EXTERNO' ? datos.proveedorId : undefined,
    costoManoObra: datos.costo,
    horasParada: datos.horas,
  };
}
