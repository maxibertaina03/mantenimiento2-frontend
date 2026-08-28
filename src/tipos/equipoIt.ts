export type TipoEquipoIt =
  | 'PC'
  | 'NOTEBOOK'
  | 'SERVIDOR'
  | 'CELULAR'
  | 'CAMARA_SEGURIDAD'
  | 'TABLET'
  | 'IMPRESORA'
  | 'MONITOR'
  | 'EQUIPO_RED'
  | 'OTRO';

export type EstadoEquipoIt = 'EN_USO' | 'EN_DEPOSITO' | 'EN_REPARACION' | 'DADO_DE_BAJA';

export type TipoDisco = 'HDD' | 'SSD' | 'NVME' | 'EMMC';

export type TipoAccesoRemoto =
  | 'NINGUNO'
  | 'ANYDESK'
  | 'TEAMVIEWER'
  | 'RDP'
  | 'VNC'
  | 'SSH'
  | 'OTRO';

/** Etiquetas legibles para la UI (el backend usa los enums de arriba). */
export const ETIQUETA_TIPO: Record<TipoEquipoIt, string> = {
  PC: 'PC de escritorio',
  NOTEBOOK: 'Notebook',
  SERVIDOR: 'Servidor',
  CELULAR: 'Celular',
  CAMARA_SEGURIDAD: 'Cámara de seguridad',
  TABLET: 'Tablet',
  IMPRESORA: 'Impresora',
  MONITOR: 'Monitor',
  EQUIPO_RED: 'Equipo de red',
  OTRO: 'Otro',
};

export const ETIQUETA_ESTADO: Record<EstadoEquipoIt, string> = {
  EN_USO: 'En uso',
  EN_DEPOSITO: 'En depósito',
  EN_REPARACION: 'En reparación',
  DADO_DE_BAJA: 'Dado de baja',
};

export const ETIQUETA_ACCESO: Record<TipoAccesoRemoto, string> = {
  NINGUNO: 'Sin acceso remoto',
  ANYDESK: 'AnyDesk',
  TEAMVIEWER: 'TeamViewer',
  RDP: 'Escritorio remoto (RDP)',
  VNC: 'VNC',
  SSH: 'SSH',
  OTRO: 'Otro',
};

/**
 * Tipos que NO son computadoras: no tiene sentido pedirles procesador, RAM ni
 * disco. Espeja la regla del backend (EquiposItService).
 */
const SIN_ESPECIFICACIONES_DE_PC: TipoEquipoIt[] = [
  'CAMARA_SEGURIDAD',
  'MONITOR',
  'IMPRESORA',
  'EQUIPO_RED',
];

export function requiereEspecificacionesDePc(tipo: TipoEquipoIt): boolean {
  return !SIN_ESPECIFICACIONES_DE_PC.includes(tipo);
}

export interface EquipoIt {
  id: string;
  codigoInterno: string | null;
  tipo: TipoEquipoIt;
  estado: EstadoEquipoIt;
  marca: string;
  modelo: string;
  numeroSerie: string | null;
  procesador: string | null;
  memoriaRamGb: number | null;
  discoTipo: TipoDisco | null;
  discoCapacidadGb: number | null;
  sistemaOperativo: string | null;
  direccionIp: string | null;
  direccionMac: string | null;
  nombreEnRed: string | null;
  accesoRemoto: TipoAccesoRemoto;
  accesoRemotoId: string | null;
  ubicacion: string | null;
  proveedorId: string | null;
  proveedorNombre: string | null;
  fechaCompra: string | null;
  garantiaHasta: string | null;
  garantiaVencida: boolean;
  notas: string | null;
  asignadoAId: string | null;
  asignadoANombre: string | null;
  creadoEn: string;
}

export interface AsignacionEquipo {
  id: string;
  usuarioId: string | null;
  usuarioNombre: string | null;
  registradoPorNombre: string | null;
  desde: string;
  hasta: string | null;
  motivo: string | null;
  notas: string | null;
  vigente: boolean;
}

export interface ResumenEquipos {
  porTipo: { tipo: TipoEquipoIt; cantidad: number }[];
  porEstado: { estado: EstadoEquipoIt; cantidad: number }[];
  total: number;
}

export interface CrearEquipoInput {
  codigoInterno?: string;
  tipo: TipoEquipoIt;
  estado?: EstadoEquipoIt;
  marca: string;
  modelo: string;
  numeroSerie?: string;
  procesador?: string;
  memoriaRamGb?: number;
  discoTipo?: TipoDisco;
  discoCapacidadGb?: number;
  sistemaOperativo?: string;
  direccionIp?: string;
  direccionMac?: string;
  nombreEnRed?: string;
  accesoRemoto?: TipoAccesoRemoto;
  accesoRemotoId?: string;
  ubicacion?: string;
  proveedorId?: string;
  fechaCompra?: string;
  garantiaHasta?: string;
  notas?: string;
  asignadoAId?: string;
}

export type ActualizarEquipoInput = Partial<CrearEquipoInput>;

export interface AsignarEquipoInput {
  usuarioId: string | null;
  motivo?: string;
  notas?: string;
}

/** Una fila del CSV, tal cual se manda al backend (sin contraseñas). */
export interface FilaImportacion {
  nombreEquipo?: string;
  tipo?: string;
  modelo?: string;
  estado?: string;
  ubicacion?: string;
  asignadoA?: string;
  accesoRemotoId?: string;
}

export interface ResultadoImportacion {
  creados: number;
  actualizados: number;
  conError: number;
  /** Personas dadas de alta como usuarios sin acceso. */
  usuariosCreados: string[];
  /** Equipos cuya marca no se pudo reconocer y conviene revisar. */
  revisarMarca: string[];
  errores: { fila: number; equipo: string; motivo: string }[];
}
