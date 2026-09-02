/** Lado mayor al que se reduce la imagen. Suficiente para ver una máquina. */
const LADO_MAXIMO = 1600;

/** Calidad del JPEG. 0.8 es donde deja de notarse la diferencia a simple vista. */
const CALIDAD = 0.8;

export interface ImagenComprimida {
  base64: string;
  nombreArchivo: string;
  /** Para poder mostrar cuánto se achicó. */
  bytesOriginales: number;
  bytesFinales: number;
}

/**
 * Achica una foto antes de subirla.
 *
 * Las fotos de la planta son de celular: 192 MB entre las 503, con una media de
 * casi 400 KB cada una. Subirlas tal cual llenaría en poco tiempo el giga del
 * plan gratuito de Supabase, y además haría lenta cada pantalla que las muestre.
 * Redimensionadas a 1600 px y con calidad 80 quedan en una fracción, sin que se
 * note en pantalla.
 *
 * Se hace en el navegador y no en el servidor a propósito: así viaja menos por
 * la red, y el servidor —que en el plan gratuito de Render tiene poca memoria—
 * no tiene que procesar imágenes.
 */
export async function comprimirImagen(archivo: File): Promise<ImagenComprimida> {
  const bitmap = await crearBitmap(archivo);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;

  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('El navegador no pudo procesar la imagen.');
  contexto.drawImage(bitmap, 0, 0, ancho, alto);

  const dataUri = lienzo.toDataURL('image/jpeg', CALIDAD);
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);

  return {
    base64,
    // Siempre .jpg: el canvas devuelve JPEG sea cual sea el formato de entrada,
    // y dejar el nombre original haría que un .png se guarde con esa extensión
    // conteniendo un JPEG.
    nombreArchivo: archivo.name.replace(/\.[^.]+$/, '') + '.jpg',
    bytesOriginales: archivo.size,
    // base64 abulta un tercio; esto es el peso real del archivo.
    bytesFinales: Math.round((base64.length * 3) / 4),
  };
}

/**
 * Decodifica el archivo a algo dibujable.
 *
 * `createImageBitmap` es lo más rápido y no siempre está: en Safari viejo hay
 * que caer al `<img>` de toda la vida.
 */
async function crearBitmap(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(archivo);
    } catch {
      // Formato que el navegador no sabe decodificar así; se prueba con <img>.
    }
  }

  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No se pudo leer la imagen. ¿Es un archivo de foto válido?'));
    };
    img.src = url;
  });
}

/** Para mostrar tamaños en un mensaje legible. */
export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
