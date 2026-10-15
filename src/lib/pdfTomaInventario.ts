import { exportarPdf } from './pdf';
import { formatearFecha, formatearNumero } from './formato';
import { alcanceDeToma, type DetalleToma, type RenglonToma } from '@/tipos/inventario';

/** «A · fila 3», o lo que haya cargado. */
export function ubicacionDe(r: Pick<RenglonToma, 'estanteriaNombre' | 'fila'>): string {
  if (!r.estanteriaNombre) return 'Sin ubicación';
  return r.fila !== null ? `${r.estanteriaNombre} · fila ${r.fila}` : r.estanteriaNombre;
}

/**
 * La planilla para contar en papel: ordenada como se recorre el pañol, con la
 * columna de lo contado vacía. No dice cuánto figura, a propósito: el que
 * cuenta escribe lo que ve, no lo que espera ver.
 */
export async function descargarPlanilla({ toma, renglones }: DetalleToma): Promise<void> {
  await exportarPdf({
    titulo: `Toma de inventario ${toma.numero}`,
    subtitulo: `${alcanceDeToma(toma)} · ${renglones.length} materiales · abierta el ${formatearFecha(toma.abiertaEn)}`,
    encabezados: ['Ubicación', 'Material', 'Unidad', 'Contado'],
    filas: renglones.map((r) => [ubicacionDe(r), r.materialNombre, r.unidad, '']),
    nombreArchivo: `${toma.numero}-planilla.pdf`,
    leyenda: 'Contá lo que hay en el estante y anotalo. Después se carga en el sistema.',
  });
}

const RESULTADO: Record<string, string> = {
  AJUSTADO: 'Ajustado',
  SIN_DIFERENCIA: 'Sin diferencia',
  RECONTAR: 'Volver a contar',
};

/** El informe de lo contado: qué figuraba, qué se contó, la diferencia y qué se hizo. */
export async function descargarInforme({ toma, renglones, resumen }: DetalleToma): Promise<void> {
  const contados = renglones.filter((r) => r.contado !== null);
  const diferencia = (r: RenglonToma) => (r.contado ?? 0) - (r.stockAlContar ?? 0);
  await exportarPdf({
    titulo: `Toma de inventario ${toma.numero}`,
    subtitulo:
      `${alcanceDeToma(toma)} · ${resumen.contados} de ${resumen.total} contados · ` +
      `${resumen.ajustados} ajustados · ${resumen.sinDiferencia} sin diferencia`,
    encabezados: ['Ubicación', 'Material', 'Figuraba', 'Contado', 'Diferencia', 'Resultado'],
    filas: contados.map((r) => {
      const d = diferencia(r);
      return [
        ubicacionDe(r),
        `${r.materialNombre} (${r.unidad})`,
        formatearNumero(r.stockAlContar ?? 0),
        formatearNumero(r.contado ?? 0),
        d === 0 ? '—' : `${d > 0 ? '+' : ''}${formatearNumero(d)}`,
        r.resultado ? RESULTADO[r.resultado] : 'Sin confirmar',
      ];
    }),
    nombreArchivo: `${toma.numero}-informe.pdf`,
    orientacion: 'landscape',
    resaltarFilas: contados.map((r) => Math.abs(diferencia(r)) > 0.0005),
    leyenda:
      resumen.sinContar > 0
        ? `${resumen.sinContar} materiales sin contar: su stock no se tocó.`
        : 'Se contaron todos los materiales.',
  });
}
