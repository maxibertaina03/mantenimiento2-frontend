import { nombreDeEquipoIt } from '@/lib/etiquetaQr';
import { ETIQUETA_ESTADO } from '@/tipos/equipoIt';
import type { EstadoEquipoIt } from '@/tipos/equipoIt';

/** Lo que comparten la página de equipos IT y sus modales. */
export const ESTADOS = Object.keys(ETIQUETA_ESTADO) as EstadoEquipoIt[];

/**
 * Cómo se nombra un equipo en pantalla.
 *
 * Marca y modelo salen del catálogo y pueden faltar: en el inventario real, 28
 * de 65 equipos no tienen marca porque decía "Sin especificar". Cuando faltan,
 * el que identifica es el código interno, que es la etiqueta pegada al equipo.
 *
 * La regla vive en `etiquetaQr` porque también la usa la etiqueta impresa: si
 * cada una lo armara por su cuenta, lo pegado en la máquina podría decir algo
 * distinto de lo que dice el sistema.
 */
export const nombreDelEquipo = nombreDeEquipoIt;
