/**
 * Un sector de la planta: una ubicación como el Saladero, Recibo o la Caldera.
 *
 * Sus trabajos son de dos clases, y se cuentan por separado: los cargados
 * sobre el sector en sí («la instalación eléctrica del Saladero») y los de las
 * máquinas que están ahí.
 */
export interface SectorConActividad {
  id: string;
  nombre: string;
  maquinas: number;
  trabajosDelSector: number;
  trabajosDeSusMaquinas: number;
  ultimoTrabajo: { fecha: string; titulo: string } | null;
  /** Del último año. */
  horasParadaDelSector: number;
  horasParadaDeSusMaquinas: number;
}

export interface TotalesDeTrabajos {
  trabajos: number;
  horasParada: number;
  costoManoObra: number;
}

export interface DetalleDeSector {
  id: string;
  nombre: string;
  maquinas: { id: string; nombre: string; codigo: string | null; estado: string }[];
  delSector: TotalesDeTrabajos;
  deSusMaquinas: TotalesDeTrabajos;
}
