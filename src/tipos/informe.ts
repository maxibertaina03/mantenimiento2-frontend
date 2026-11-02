/** Lo que devuelve /api/informes. Los tramos son la fecha (AAAA-MM-DD) en que empiezan. */

export type Agrupar = 'dia' | 'semana' | 'mes';

export interface PeriodoInforme {
  desde: string;
  hasta: string;
  agrupar: Agrupar;
}

export interface RankingTrabajos {
  nombre: string;
  ordenes: number;
  correctivas: number;
  horasParada: number;
}

export interface InformeTrabajos {
  resumen: {
    abiertas: number;
    cerradas: number;
    anuladas: number;
    siguenAbiertas: number;
    preventivas: number;
    correctivas: number;
    mejoras: number;
    externas: number;
    horasParada: number;
    costoManoObra: number;
    horasHastaCerrar: number | null;
  };
  serie: {
    tramo: string;
    PREVENTIVO: number;
    CORRECTIVO: number;
    MEJORA: number;
    cerradas: number;
  }[];
  equipos: RankingTrabajos[];
  sectores: RankingTrabajos[];
}

export interface InformeCompras {
  resumen: {
    ordenes: number;
    recibidas: number;
    borradores: number;
    anuladas: number;
    conFaltante: number;
    monto: number;
    sinPrecio: number;
    diasDeEntrega: number | null;
  };
  serie: { tramo: string; ordenes: number; monto: number }[];
  proveedores: {
    proveedor: string;
    ordenes: number;
    monto: number;
    diasDeEntrega: number | null;
  }[];
}

export interface ResultadoPersona {
  usuarioId: string;
  nombre: string;
  rol: string;
  otCerradas: number;
  otAbiertas: number;
  tareasHechas: number;
  tareasVencidas: number;
  cumplimiento: number | null;
  postergaciones: number;
  pendientesHechos: number;
  ocCreadas: number;
}

export interface InformePersonal {
  personas: ResultadoPersona[];
  vencidasSinResponsable: number;
}

export interface InformeMio {
  resultado: ResultadoPersona;
  serie: { tramo: string; tareasHechas: number; tareasVencidas: number; otCerradas: number }[];
}

export interface InformePanol {
  resumen: { entradas: number; salidas: number; ajustes: number; quietos: number };
  serie: { tramo: string; entradas: number; salidas: number; ajustes: number }[];
  porMotivo: { motivo: string; movimientos: number }[];
  masUsados: {
    materialId: string;
    material: string;
    unidad: string;
    cantidad: number;
    veces: number;
  }[];
  diasQuieto: number;
  quietos: {
    id: string;
    nombre: string;
    unidad: string;
    stockActual: number;
    ultimoMovimiento: string | null;
  }[];
}
