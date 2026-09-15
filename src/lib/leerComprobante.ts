import { comprimirImagen } from './comprimirImagen';

/**
 * Lado mayor al que se reduce la foto de un comprobante.
 *
 * Más grande que el de las fotos de equipos, y a propósito. Una foto de una
 * bomba se mira; una foto de un remito se LEE: hay que distinguir un 3 de un 8
 * en el número y las cantidades. A 1600 px un remito A4 fotografiado de lejos
 * queda con los números al borde de lo legible.
 */
const LADO_MAXIMO = 2200;
const CALIDAD = 0.85;

export interface ComprobanteParaSubir {
  archivoBase64: string;
  nombreArchivo: string;
  bytes: number;
  esPdf: boolean;
}

export const EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

/** Si el archivo es de un tipo que el sistema acepta. */
export function esAceptado(archivo: File): boolean {
  const ext = (archivo.name.split('.').pop() ?? '').toLowerCase();
  return EXTENSIONES.includes(ext);
}

/**
 * Prepara el archivo para subirlo.
 *
 * Un PDF va tal cual: recomprimirlo no ahorra nada y arriesga romperlo. Una
 * foto se achica en el navegador, igual que las de los equipos, para que no
 * viaje entera por la red ni llene el almacén.
 */
export async function leerComprobante(archivo: File): Promise<ComprobanteParaSubir> {
  const esPdf = archivo.name.toLowerCase().endsWith('.pdf');

  if (esPdf) {
    const base64 = await comoBase64(archivo);
    return {
      archivoBase64: base64,
      nombreArchivo: archivo.name,
      bytes: archivo.size,
      esPdf: true,
    };
  }

  const img = await comprimirImagen(archivo, { lado: LADO_MAXIMO, calidad: CALIDAD });
  return {
    archivoBase64: img.base64,
    nombreArchivo: img.nombreArchivo,
    bytes: img.bytesFinales,
    esPdf: false,
  };
}

/** El archivo tal cual, en base64, sin el prefijo `data:`. */
function comoBase64(archivo: File): Promise<string> {
  return new Promise((listo, fallo) => {
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = String(lector.result ?? '');
      listo(resultado.slice(resultado.indexOf(',') + 1));
    };
    lector.onerror = () => fallo(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
}
