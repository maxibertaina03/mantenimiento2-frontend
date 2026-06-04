/**
 * Generación y descarga de archivos CSV (compatibles con Excel).
 */

/** Escapa un valor para CSV: comillas, comas y saltos de línea. */
function escaparCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  if (/[";\n\r]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/**
 * Arma el contenido CSV a partir de encabezados y filas.
 * Usa ";" como separador (Excel en es-AR lo abre en columnas directamente).
 */
export function generarCsv(encabezados: string[], filas: unknown[][]): string {
  const sep = ';';
  const lineas = [encabezados.map(escaparCelda).join(sep)];
  for (const fila of filas) {
    lineas.push(fila.map(escaparCelda).join(sep));
  }
  return lineas.join('\r\n');
}

/**
 * Dispara la descarga de un CSV en el navegador.
 * Antepone BOM para que Excel respete los acentos (UTF-8).
 */
export function descargarCsv(nombreArchivo: string, contenido: string): void {
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Sufijo de fecha para los nombres de archivo: aaaa-mm-dd. */
export function sufijoFechaArchivo(): string {
  return new Date().toISOString().slice(0, 10);
}
